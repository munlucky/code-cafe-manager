import { RecipeStep, BaristaStatus } from '../types.js';
import { ExecutionContext, StepResult } from './types.js';

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
    switch (step.type) {
      case 'ai.interactive':
      case 'ai.prompt':
        return await executeAIStep(step, ctx, startedAt);

      case 'shell':
        return await executeShellStep(step, ctx, startedAt);

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
      // TODO: Load agent prompt from reference
      // For now, just use the prompt field
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

  // TODO: Execute shell command
  // For now, just simulate
  throw new Error('Shell step execution not yet implemented');
}
