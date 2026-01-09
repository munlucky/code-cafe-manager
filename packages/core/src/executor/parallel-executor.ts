import { RecipeStep, BaristaStatus } from '../types.js';
import { ExecutionContext, StepResult } from './types.js';
import { executeStepWithRetry } from './step-executor.js';

/**
 * Parallel Executor
 * Executes multiple steps in parallel with barista pool constraints
 */

/**
 * Split array into chunks
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Execute parallel steps
 * Respects barista pool size constraints
 * If any step fails, the entire parallel group fails
 */
export async function executeParallelSteps(
  steps: RecipeStep[],
  ctx: ExecutionContext,
  parallelStepId: string
): Promise<StepResult> {
  const startedAt = new Date();
  const results: StepResult[] = [];

  // Check if steps is empty
  if (!steps || steps.length === 0) {
    return {
      stepId: parallelStepId,
      status: 'success',
      startedAt,
      endedAt: new Date(),
    };
  }

  // Validate no nested parallel steps (M2 limitation)
  for (const step of steps) {
    if (step.type === 'parallel') {
      return {
        stepId: parallelStepId,
        status: 'failed',
        startedAt,
        endedAt: new Date(),
        error: 'Nested parallel steps are not supported in M2',
      };
    }
  }

  try {
    // Calculate available baristas
    const availableBaristas = ctx.baristaManager
      .getAllBaristas()
      .filter((b) => b.status === BaristaStatus.IDLE).length;

    const batchSize = Math.max(1, availableBaristas);

    // Split steps into batches based on available baristas
    const batches = chunkArray(steps, batchSize);

    // Execute batches sequentially, but steps within batch in parallel
    for (const batch of batches) {
      const batchResults = await Promise.allSettled(
        batch.map((step) => executeStepWithRetry(step, ctx))
      );

      // Check results
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);

          // If any step failed, entire parallel group fails
          if (result.value.status === 'failed') {
            return {
              stepId: parallelStepId,
              status: 'failed',
              startedAt,
              endedAt: new Date(),
              error: `Step "${result.value.stepId}" failed: ${result.value.error}`,
            };
          }
        } else {
          // Promise rejected
          return {
            stepId: parallelStepId,
            status: 'failed',
            startedAt,
            endedAt: new Date(),
            error: `Step execution failed: ${result.reason}`,
          };
        }
      }
    }

    // All steps succeeded
    return {
      stepId: parallelStepId,
      status: 'success',
      startedAt,
      endedAt: new Date(),
      output: `Executed ${results.length} parallel steps successfully`,
    };
  } catch (err) {
    return {
      stepId: parallelStepId,
      status: 'failed',
      startedAt,
      endedAt: new Date(),
      error: (err as Error).message,
    };
  }
}
