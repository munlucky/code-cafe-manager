import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { executeParallelSteps } from '../executor/parallel-executor.js';
import { RecipeStep, BaristaStatus, ProviderType } from '../types.js';
import { BaristaManager } from '../barista.js';
import { ExecutionContext } from '../executor/types.js';

// Mock executeStepWithRetry
jest.mock('../executor/step-executor.js', () => ({
  executeStepWithRetry: jest.fn(),
}));

import { executeStepWithRetry } from '../executor/step-executor.js';

describe('Parallel Executor', () => {
  let baristaManager: BaristaManager;
  let mockProviderFactory: any;
  let context: ExecutionContext;

  beforeEach(() => {
    baristaManager = new BaristaManager(4);
    mockProviderFactory = {
      create: jest.fn(),
    };

    context = {
      order: {
        id: 'test-order',
        recipeId: 'test-recipe',
        recipeName: 'Test Recipe',
        baristaId: null,
        status: 'PENDING' as any,
        counter: '/test/path',
        provider: 'claude-code' as ProviderType,
        vars: {},
        createdAt: new Date(),
        startedAt: null,
        endedAt: null,
      },
      recipe: {
        name: 'test-recipe',
        version: '1.0.0',
        defaults: {
          provider: 'claude-code' as ProviderType,
          workspace: {
            mode: 'in-place' as any,
          },
        },
        inputs: {
          counter: '/test/path',
        },
        vars: {},
        steps: [],
      },
      baristaManager,
      providerFactory: mockProviderFactory,
    };

    // Create some baristas
    baristaManager.createBarista('claude-code' as ProviderType);
    baristaManager.createBarista('claude-code' as ProviderType);
  });

  it('should handle empty steps', async () => {
    const result = await executeParallelSteps([], context, 'parallel-1');

    expect(result.status).toBe('success');
    expect(result.stepId).toBe('parallel-1');
  });

  it('should reject nested parallel steps', async () => {
    const steps: RecipeStep[] = [
      {
        id: 'nested-parallel',
        type: 'parallel',
        steps: [],
      },
    ];

    const result = await executeParallelSteps(steps, context, 'parallel-1');

    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/nested parallel/i);
  });

  it('should execute steps in batches based on available baristas', async () => {
    const mockExecute = executeStepWithRetry as jest.MockedFunction<typeof executeStepWithRetry>;
    mockExecute.mockResolvedValue({
      stepId: 'test',
      status: 'success',
      startedAt: new Date(),
      endedAt: new Date(),
    });

    const steps: RecipeStep[] = [
      { id: 'step1', type: 'ai.prompt', prompt: 'test1' },
      { id: 'step2', type: 'ai.prompt', prompt: 'test2' },
      { id: 'step3', type: 'ai.prompt', prompt: 'test3' },
      { id: 'step4', type: 'ai.prompt', prompt: 'test4' },
      { id: 'step5', type: 'ai.prompt', prompt: 'test5' },
    ];

    const result = await executeParallelSteps(steps, context, 'parallel-1');

    expect(result.status).toBe('success');
    expect(mockExecute).toHaveBeenCalledTimes(5);
  });

  it('should fail if any step fails', async () => {
    const mockExecute = executeStepWithRetry as jest.MockedFunction<typeof executeStepWithRetry>;
    mockExecute
      .mockResolvedValueOnce({
        stepId: 'step1',
        status: 'success',
        startedAt: new Date(),
        endedAt: new Date(),
      })
      .mockResolvedValueOnce({
        stepId: 'step2',
        status: 'failed',
        startedAt: new Date(),
        endedAt: new Date(),
        error: 'Test error',
      });

    const steps: RecipeStep[] = [
      { id: 'step1', type: 'ai.prompt', prompt: 'test1' },
      { id: 'step2', type: 'ai.prompt', prompt: 'test2' },
    ];

    const result = await executeParallelSteps(steps, context, 'parallel-1');

    expect(result.status).toBe('failed');
    expect(result.error).toContain('step2');
  });

  it('should respect barista pool size', async () => {
    const mockExecute = executeStepWithRetry as jest.MockedFunction<typeof executeStepWithRetry>;

    let concurrentCalls = 0;
    let maxConcurrent = 0;

    mockExecute.mockImplementation(async () => {
      concurrentCalls++;
      maxConcurrent = Math.max(maxConcurrent, concurrentCalls);

      await new Promise(resolve => setTimeout(resolve, 10));

      concurrentCalls--;
      return {
        stepId: 'test',
        status: 'success',
        startedAt: new Date(),
        endedAt: new Date(),
      };
    });

    const steps: RecipeStep[] = [
      { id: 'step1', type: 'ai.prompt', prompt: 'test1' },
      { id: 'step2', type: 'ai.prompt', prompt: 'test2' },
      { id: 'step3', type: 'ai.prompt', prompt: 'test3' },
      { id: 'step4', type: 'ai.prompt', prompt: 'test4' },
      { id: 'step5', type: 'ai.prompt', prompt: 'test5' },
    ];

    await executeParallelSteps(steps, context, 'parallel-1');

    // With 2 idle baristas, max concurrent should be 2
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });
});
