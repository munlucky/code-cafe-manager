import { ExecutionContext, ExecutionResult, StepResult } from './types.js';
import { resolveExecutionOrder } from './dag-resolver.js';
import { executeStepWithRetry } from './step-executor.js';
import { executeParallelSteps } from './parallel-executor.js';

/**
 * Main Recipe Executor
 * Orchestrates entire recipe execution with DAG-based ordering
 */

/**
 * Execute a recipe
 */
export async function executeRecipe(
  ctx: ExecutionContext
): Promise<ExecutionResult> {
  const { order, recipe } = ctx;
  const startedAt = new Date();
  const results: StepResult[] = [];

  try {
    // Resolve execution order using DAG
    const stepGroups = resolveExecutionOrder(recipe.steps);

    // Execute step groups in order
    for (const group of stepGroups) {
      // Steps in same group can execute in parallel
      const groupResults = await Promise.all(
        group.steps.map(async (step) => {
          if (step.type === 'parallel') {
            // Delegate to parallel executor
            return executeParallelSteps(
              step.steps || [],
              ctx,
              step.id
            );
          } else if (step.type === 'conditional') {
            // Execute conditional step
            return executeStepWithRetry(step, ctx);
          } else {
            // Execute single step
            return executeStepWithRetry(step, ctx);
          }
        })
      );

      // Store step outputs in context for future steps
      for (const result of groupResults) {
        ctx.stepOutputs.set(result.stepId, {
          output: result.output,
          outputs: result.outputs,
          status: result.status,
        });
      }

      results.push(...groupResults);

      // Check if any step in group failed
      const hasFailure = groupResults.some((r) => r.status === 'failed');
      if (hasFailure) {
        return {
          orderId: order.id,
          status: 'failed',
          steps: results,
          startedAt,
          endedAt: new Date(),
          error: 'One or more steps failed',
        };
      }
    }

    // All steps completed successfully
    return {
      orderId: order.id,
      status: 'completed',
      steps: results,
      startedAt,
      endedAt: new Date(),
    };
  } catch (err) {
    return {
      orderId: order.id,
      status: 'failed',
      steps: results,
      startedAt,
      endedAt: new Date(),
      error: (err as Error).message,
    };
  }
}

// Re-export for convenience
export { ExecutionContext, ExecutionResult, StepResult } from './types.js';
export { resolveExecutionOrder, validateNoCycles } from './dag-resolver.js';
export { executeStepWithRetry } from './step-executor.js';
export { executeParallelSteps } from './parallel-executor.js';
