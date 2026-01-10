import { RecipeStep, BaristaStatus } from '../types.js';
import { ExecutionContext, StepResult } from './types.js';
import { collectContext } from './context-collector.js';
import {
  processTemplateObject,
  evaluateCondition,
  TemplateContext,
} from './template-engine.js';
import { readFile } from 'fs/promises';
import { resolve } from 'path';

/**
 * Step Executor
 * Executes individual recipe steps with retry and timeout support
 */

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a step with retry logic (exponential backoff)
 */
export async function executeStepWithRetry(
  step: RecipeStep,
  ctx: ExecutionContext
): Promise<StepResult> {
  const maxRetries = step.retry ?? 0;
  const timeout = step.timeout_sec ?? 7200; // Default 2 hours
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await executeStepWithTimeout(step, ctx, timeout);
      if (attempt > 0) {
        result.retryCount = attempt;
      }
      return result;
    } catch (err) {
      lastError = err as Error;

      // If not the last attempt, wait before retry
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, 8s...
        await sleep(backoffMs);
      }
    }
  }

  // All retries failed
  return {
    stepId: step.id,
    status: 'failed',
    startedAt: new Date(),
    endedAt: new Date(),
    error: lastError?.message || 'Unknown error',
    retryCount: maxRetries,
  };
}

/**
 * Execute a step with timeout
 */
async function executeStepWithTimeout(
  step: RecipeStep,
  ctx: ExecutionContext,
  timeoutSec: number
): Promise<StepResult> {
  return new Promise((resolve, reject) => {
    let timeoutHandle: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    };

    // Set timeout
    timeoutHandle = setTimeout(() => {
      cleanup();
      reject(new Error(`Step "${step.id}" timed out after ${timeoutSec}s`));
    }, timeoutSec * 1000);

    // Execute step
    executeStepCore(step, ctx)
      .then((result) => {
        cleanup();
        resolve(result);
      })
      .catch((err) => {
        cleanup();
        reject(err);
      });
  });
}

/**
 * Core step execution logic based on step type
 */
async function executeStepCore(
  step: RecipeStep,
  ctx: ExecutionContext
): Promise<StepResult> {
  const startedAt = new Date();

  try {
    // Process template variables in step
    const processedStep = processStepTemplates(step, ctx);

    switch (processedStep.type) {
      case 'ai.interactive':
      case 'ai.prompt':
        return await executeAIStep(processedStep, ctx, startedAt);

      case 'shell':
        return await executeShellStep(processedStep, ctx, startedAt);

      case 'context.collect':
        return await executeContextCollectStep(processedStep, ctx, startedAt);

      case 'conditional':
        return await executeConditionalStep(processedStep, ctx, startedAt);

      case 'data.passthrough':
        return await executeDataPassthroughStep(processedStep, ctx, startedAt);

      case 'parallel':
        // Parallel steps are handled by parallel-executor
        throw new Error('Parallel steps should be handled by ParallelExecutor');

      default:
        throw new Error(`Unknown step type: ${(step as any).type}`);
    }
  } catch (err) {
    return {
      stepId: step.id,
      status: 'failed',
      startedAt,
      endedAt: new Date(),
      error: (err as Error).message,
    };
  }
}

/**
 * Process template variables in step
 */
function processStepTemplates(step: RecipeStep, ctx: ExecutionContext): RecipeStep {
  // Build template context from step outputs
  const templateContext: TemplateContext = {
    order: ctx.order,
    recipe: ctx.recipe,
    // Add order.vars to context for direct variable access
    ...ctx.order.vars,
  };

  // Add step outputs
  for (const [stepId, outputs] of ctx.stepOutputs.entries()) {
    templateContext[stepId] = {
      output: outputs.output || '',
      outputs: outputs.outputs || {},
    };
  }

  // Process templates in step
  return processTemplateObject(step, templateContext) as RecipeStep;
}

/**
 * Execute AI step (interactive or prompt)
 */
async function executeAIStep(
  step: RecipeStep,
  ctx: ExecutionContext,
  startedAt: Date
): Promise<StepResult> {
  const { order, recipe, baristaManager, providerFactory } = ctx;

  // Find available barista
  const provider = step.provider || recipe.defaults.provider;
  const barista = baristaManager.findIdleBarista(provider);

  if (!barista) {
    throw new Error(`No idle barista available for provider: ${provider}`);
  }

  // Update barista status
  baristaManager.updateBaristaStatus(barista.id, BaristaStatus.RUNNING, order.id);

  try {
    // Create provider instance
    const providerInstance = providerFactory.create(provider, {
      workingDir: order.counter,
    });

    // Build prompt
    let prompt = step.prompt || '';

    // If agent_ref is provided, load agent prompt
    if (step.agent_ref) {
      try {
        if (step.agent_ref.type === 'local' && step.agent_ref.path) {
          const agentPath = resolve(order.counter, step.agent_ref.path);
          const agentContent = await readFile(agentPath, 'utf-8');

          // If prompt is provided, append it to agent content
          if (prompt) {
            prompt = `${agentContent}\n\n---\n\n${prompt}`;
          } else {
            prompt = agentContent;
          }
        } else {
          // TODO: Support github and url types
          throw new Error(`Unsupported agent_ref type: ${step.agent_ref.type}`);
        }
      } catch (err) {
        throw new Error(`Failed to load agent from ${step.agent_ref.path}: ${(err as Error).message}`);
      }
    }

    // Run provider
    let output = '';
    providerInstance.on('data', (data: string) => {
      output += data;
    });

    await new Promise<void>((resolve, reject) => {
      providerInstance.on('exit', (code: number) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Provider exited with code ${code}`));
        }
      });

      providerInstance.on('error', (err: Error) => {
        reject(err);
      });

      // Start provider
      providerInstance.run({
        prompt,
        interactive: step.type === 'ai.interactive',
      });
    });

    // Update barista status
    baristaManager.updateBaristaStatus(barista.id, BaristaStatus.IDLE, null);

    return {
      stepId: step.id,
      status: 'success',
      startedAt,
      endedAt: new Date(),
      output: output.slice(0, 1000), // Limit output size
    };
  } catch (err) {
    // Update barista status on error
    baristaManager.updateBaristaStatus(barista.id, BaristaStatus.IDLE, null);
    throw err;
  }
}

/**
 * Execute shell step
 */
async function executeShellStep(
  step: RecipeStep,
  ctx: ExecutionContext,
  startedAt: Date
): Promise<StepResult> {
  const { order } = ctx;

  if (!step.command) {
    throw new Error(`Shell step "${step.id}" missing command`);
  }

  // Dynamic import for child_process
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  try {
    const { stdout, stderr } = await execAsync(step.command, {
      cwd: order.counter,
      timeout: (step.timeout_sec || 7200) * 1000,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : '');

    return {
      stepId: step.id,
      status: 'success',
      startedAt,
      endedAt: new Date(),
      output: output.slice(0, 10000), // Limit to 10KB
    };
  } catch (err: any) {
    return {
      stepId: step.id,
      status: 'failed',
      startedAt,
      endedAt: new Date(),
      error: err.message || 'Shell command failed',
      output: err.stdout ? err.stdout.slice(0, 10000) : undefined,
    };
  }
}

/**
 * Execute context collection step
 */
async function executeContextCollectStep(
  step: RecipeStep,
  ctx: ExecutionContext,
  startedAt: Date
): Promise<StepResult> {
  if (!step.collect || step.collect.length === 0) {
    throw new Error(`Context collect step "${step.id}" missing collect items`);
  }

  try {
    const context = await collectContext(step.collect, ctx.order.counter);

    return {
      stepId: step.id,
      status: 'success',
      startedAt,
      endedAt: new Date(),
      output: JSON.stringify(context, null, 2),
      outputs: context,
    };
  } catch (err: any) {
    return {
      stepId: step.id,
      status: 'failed',
      startedAt,
      endedAt: new Date(),
      error: err.message || 'Context collection failed',
    };
  }
}

/**
 * Execute conditional step
 */
async function executeConditionalStep(
  step: RecipeStep,
  ctx: ExecutionContext,
  startedAt: Date
): Promise<StepResult> {
  if (!step.condition) {
    throw new Error(`Conditional step "${step.id}" missing condition`);
  }

  // Build template context
  const templateContext: TemplateContext = {
    order: ctx.order,
    recipe: ctx.recipe,
    // Add order.vars to context for direct variable access
    ...ctx.order.vars,
  };

  for (const [stepId, outputs] of ctx.stepOutputs.entries()) {
    templateContext[stepId] = {
      output: outputs.output || '',
      outputs: outputs.outputs || {},
    };
  }

  // Evaluate condition
  const conditionResult = evaluateCondition(step.condition, templateContext);

  // Select steps to execute
  const stepsToExecute = conditionResult ? step.when_true : step.when_false;

  if (!stepsToExecute || stepsToExecute.length === 0) {
    return {
      stepId: step.id,
      status: 'success',
      startedAt,
      endedAt: new Date(),
      output: `Condition evaluated to ${conditionResult}, no steps to execute`,
    };
  }

  // Execute selected steps
  // Import dynamically to avoid circular dependency
  const { executeParallelSteps } = await import('./parallel-executor.js');

  const result = await executeParallelSteps(stepsToExecute, ctx, step.id);

  return {
    ...result,
    stepId: step.id,
    output: `Condition: ${conditionResult}\n${result.output || ''}`,
  };
}

/**
 * Execute data passthrough step
 */
async function executeDataPassthroughStep(
  step: RecipeStep,
  ctx: ExecutionContext,
  startedAt: Date
): Promise<StepResult> {
  // Simply pass through input data as outputs
  const outputs = step.inputs || {};

  return {
    stepId: step.id,
    status: 'success',
    startedAt,
    endedAt: new Date(),
    output: JSON.stringify(outputs, null, 2),
    outputs,
  };
}
