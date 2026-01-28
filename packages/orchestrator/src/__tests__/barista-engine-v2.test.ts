/**
 * Barista Engine V2 Tests
 * Tests for Terminal Pool integration and Session-based execution
 */

import { BaristaEngineV2 } from '../barista/barista-engine-v2';
import { Barista, BaristaStatus, Order, OrderStatus } from '@codecafe/core';
import { OrderSession } from '../session';

describe('BaristaEngineV2', () => {
  let engine: BaristaEngineV2;
  let mockTerminalPool: any;
  let mockSession: any;

  // Default Mock Data
  const mockBarista: Barista = {
    id: 'barista-1',
    status: BaristaStatus.IDLE,
    currentOrderId: null,
    provider: 'claude-code',
    role: 'planner',
    createdAt: new Date(),
    lastActivityAt: new Date(),
  };

  const mockOrder: Order = {
    id: 'order-1',
    workflowId: 'workflow-1',
    workflowName: 'Test Workflow',
    baristaId: null,
    status: OrderStatus.PENDING,
    counter: '/test/path',
    provider: 'claude-code',
    vars: {},
    createdAt: new Date(),
    startedAt: null,
    endedAt: null,
    steps: [
      {
        id: 'step-1',
        task: 'Test task',
        parameters: { param1: 'value1' },
      },
    ],
  };

  // Helper to control execution flow
  const setupControlledExecution = () => {
    let resolveExecution: (value: any) => void;
    mockSession.execute.mockImplementation(() => {
      return new Promise(resolve => {
        resolveExecution = resolve;
      });
    });
    return (val: any) => resolveExecution(val);
  };

  beforeEach(() => {
    // Initialize mock session
    mockSession = {
      execute: vi.fn().mockResolvedValue(undefined),
      executePrompt: vi.fn().mockResolvedValue(undefined),
      sendInput: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn().mockResolvedValue(undefined),
      getStatus: vi.fn().mockReturnValue({ status: 'idle' }),
      getContext: vi.fn().mockReturnValue({
        getCurrentAttemptNumber: () => 1,
      }),
      retryFromStage: vi.fn().mockResolvedValue(undefined),
      retryFromBeginning: vi.fn().mockResolvedValue(undefined),
      enterFollowup: vi.fn().mockResolvedValue(undefined),
      executeFollowup: vi.fn().mockResolvedValue(undefined),
      finishFollowup: vi.fn().mockResolvedValue(undefined),
      restoreForFollowup: vi.fn().mockResolvedValue(undefined),
      once: vi.fn().mockReturnValue(mockSession),
      on: vi.fn().mockReturnValue(mockSession),
    };

    mockTerminalPool = {
      acquireLease: vi.fn().mockResolvedValue(undefined),
    };

    engine = new BaristaEngineV2(mockTerminalPool as any);

    // Mock sessionManager.createSession to return our mock session
    const sessionManager = engine.getSessionManager();
    vi.spyOn(sessionManager, 'createSession').mockReturnValue(mockSession as any);
    vi.spyOn(sessionManager, 'createSessionWithWorkflow').mockReturnValue(mockSession as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Order Execution', () => {
    it('should execute order successfully', async () => {
      await engine.executeOrder(mockOrder, mockBarista);

      expect(mockSession.execute).toHaveBeenCalled();
    });

    it('should handle execution failure', async () => {
      mockSession.execute.mockRejectedValue(new Error('Execution failed'));

      await expect(engine.executeOrder(mockOrder, mockBarista))
        .rejects.toThrow();
    });
  });

  describe('Context Preparation', () => {
    it('should execute order with session', async () => {
      await engine.executeOrder(mockOrder, mockBarista);

      const sessionManager = engine.getSessionManager();
      expect(sessionManager.createSessionWithWorkflow).toHaveBeenCalled();
      expect(mockSession.execute).toHaveBeenCalled();
    });

    it('should execute order with prompt using session', async () => {
      await engine.executeOrderWithSession(mockOrder, mockBarista, 'default', 'test prompt');

      const sessionManager = engine.getSessionManager();
      expect(sessionManager.createSession).toHaveBeenCalled();
      expect(mockSession.executePrompt).toHaveBeenCalledWith('test prompt', expect.any(String));
    });
  });

  describe('Order Cancellation', () => {
    it('should cancel active order', async () => {
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      // Wait for execution to start
      await new Promise(resolve => setTimeout(resolve, 50));

      const cancelled = await engine.cancelOrder('order-1');

      expect(cancelled).toBe(true);
      expect(mockSession.cancel).toHaveBeenCalled();

      // Resolve execution to clean up
      resolveExecution({ success: true, output: 'cancelled' });
      await executePromise.catch(() => {});
    });

    it('should return false for non-existent order', async () => {
      const cancelled = await engine.cancelOrder('non-existent-order');
      expect(cancelled).toBe(false);
    });

    it('should handle cancellation failure', async () => {
      // Setup active order that will fail to cancel
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Mock cancel failure
      mockSession.cancel.mockRejectedValue(new Error('Cancel failed'));

      const cancelled = await engine.cancelOrder('order-1');
      expect(cancelled).toBe(false);

      resolveExecution({ success: true, output: 'done' });
      await executePromise.catch(() => {});
    });
  });

  describe('Active Executions', () => {
    it('should track active executions', async () => {
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => setTimeout(resolve, 50));

      const activeExecutions = engine.getActiveExecutions();
      expect(activeExecutions.size).toBe(1);
      expect(activeExecutions.get('order-1')?.baristaId).toBe('barista-1');
      expect(activeExecutions.get('order-1')?.session).toBeDefined();

      // Complete execution
      resolveExecution({ success: true, output: 'done' });
      await executePromise;

      expect(engine.getActiveExecutions().size).toBe(0);
    });
  });

  describe('Resource Cleanup', () => {
    it('should dispose resources and cancel active orders', async () => {
      // Setup blocked execution
      mockSession.execute.mockImplementation(() => new Promise(() => {}));

      const executePromise = engine.executeOrder(mockOrder, mockBarista);
      await new Promise(resolve => setTimeout(resolve, 50));

      await engine.dispose();

      expect(mockSession.cancel).toHaveBeenCalled();
      expect(engine.getActiveExecutions().size).toBe(0);
    });
  });

  describe('sendInput', () => {
    it('should send input to active session execution', async () => {
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => setTimeout(resolve, 50));

      const testMessage = 'test input message';
      await engine.sendInput('order-1', testMessage);

      expect(mockSession.sendInput).toHaveBeenCalledWith(testMessage);

      resolveExecution({ success: true, output: 'done' });
      await executePromise.catch(() => {});
    });

    it('should handle non-existent order gracefully', async () => {
      // Should not throw even when order does not exist
      await expect(engine.sendInput('non-existent-order', 'test')).resolves.toBeUndefined();
    });

    it('should handle sendInput errors gracefully', async () => {
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => setTimeout(resolve, 50));

      mockSession.sendInput.mockRejectedValue(new Error('Send failed'));

      await expect(engine.sendInput('order-1', 'test')).rejects.toThrow('Send failed');

      resolveExecution({ success: true, output: 'done' });
      await executePromise.catch(() => {});
    });

    it('should handle empty input', async () => {
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => setTimeout(resolve, 50));

      await engine.sendInput('order-1', '');

      expect(mockSession.sendInput).toHaveBeenCalledWith('');

      resolveExecution({ success: true, output: 'done' });
      await executePromise.catch(() => {});
    });

    it('should handle multiline input', async () => {
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => setTimeout(resolve, 50));

      const multilineInput = 'Line 1\nLine 2\nLine 3';
      await engine.sendInput('order-1', multilineInput);

      expect(mockSession.sendInput).toHaveBeenCalledWith(multilineInput);

      resolveExecution({ success: true, output: 'done' });
      await executePromise.catch(() => {});
    });

    it('should handle unicode input', async () => {
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => setTimeout(resolve, 50));

      const unicodeInput = '안녕하세요 👍 🚀';
      await engine.sendInput('order-1', unicodeInput);

      expect(mockSession.sendInput).toHaveBeenCalledWith(unicodeInput);

      resolveExecution({ success: true, output: 'done' });
      await executePromise.catch(() => {});
    });
  });

  describe('Workflow Execution', () => {
    it('should execute order with workflow config', async () => {
      const orderWithWorkflow: Order = {
        ...mockOrder,
        id: 'order-workflow-1',
        workflowConfig: {
          stages: [
            { id: 'analyze', name: 'Analyze', provider: 'claude-code', prompt: 'Analyze the code' },
            { id: 'code', name: 'Code', provider: 'claude-code', prompt: 'Implement changes' },
          ],
          vars: { projectType: 'typescript' },
        },
      };

      await engine.executeOrder(orderWithWorkflow, mockBarista);

      const sessionManager = engine.getSessionManager();
      expect(sessionManager.createSessionWithWorkflow).toHaveBeenCalled();
      expect(mockSession.execute).toHaveBeenCalled();
    });

    it('should load default workflow when not provided', async () => {
      const orderWithoutWorkflow: Order = {
        ...mockOrder,
        id: 'order-no-workflow',
        workflowConfig: undefined,
      };

      await engine.executeOrder(orderWithoutWorkflow, mockBarista);

      const sessionManager = engine.getSessionManager();
      expect(sessionManager.createSessionWithWorkflow).toHaveBeenCalled();
      expect(mockSession.execute).toHaveBeenCalled();
    });

    it('should handle workflow stage failure', async () => {
      mockSession.execute.mockRejectedValue(new Error('Stage analyze failed'));

      const orderWithWorkflow: Order = {
        ...mockOrder,
        id: 'order-fail-workflow',
        workflowConfig: {
          stages: [
            { id: 'analyze', name: 'Analyze', provider: 'claude-code', prompt: 'Analyze' },
          ],
          vars: {},
        },
      };

      await expect(engine.executeOrder(orderWithWorkflow, mockBarista))
        .rejects.toThrow();
    });
  });

  describe('Retry and Recovery', () => {
    it('should retry from specific stage', async () => {
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => setTimeout(resolve, 50));

      await engine.retryFromStage('order-1', 'stage-2');

      expect(mockSession.retryFromStage).toHaveBeenCalledWith('stage-2');

      resolveExecution({ success: true, output: 'done' });
      await executePromise.catch(() => {});
    });

    it('should retry from beginning', async () => {
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => setTimeout(resolve, 50));

      await engine.retryFromBeginning('order-1', true);

      expect(mockSession.retryFromBeginning).toHaveBeenCalledWith(true);

      resolveExecution({ success: true, output: 'done' });
      await executePromise.catch(() => {});
    });

    it('should return retry options for order with session', async () => {
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Mock getRetryOptions on session
      const mockRetryOptions = [
        { stageId: 'stage-1', stageName: 'Analyze', batchIndex: 0 },
        { stageId: 'stage-2', stageName: 'Code', batchIndex: 1 },
      ];
      mockSession.getRetryOptions = vi.fn().mockReturnValue(mockRetryOptions);

      const options = engine.getRetryOptions('order-1');

      expect(options).toEqual(mockRetryOptions);

      resolveExecution({ success: true, output: 'done' });
      await executePromise.catch(() => {});
    });

    it('should return null retry options for non-existent order', async () => {
      const options = engine.getRetryOptions('non-existent-order');
      expect(options).toBeNull();
    });
  });

  describe('Followup Mode', () => {
    it('should enter followup mode after completion', async () => {
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => setTimeout(resolve, 50));

      await engine.enterFollowup('order-1');

      expect(mockSession.enterFollowup).toHaveBeenCalled();

      resolveExecution({ success: true, output: 'done' });
      await executePromise.catch(() => {});
    });

    it('should execute followup prompt', async () => {
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => setTimeout(resolve, 50));

      await engine.executeFollowup('order-1', 'Add tests for this feature');

      expect(mockSession.executeFollowup).toHaveBeenCalledWith('Add tests for this feature');

      resolveExecution({ success: true, output: 'done' });
      await executePromise.catch(() => {});
    });

    it('should finish followup mode', async () => {
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => setTimeout(resolve, 50));

      await engine.finishFollowup('order-1');

      expect(mockSession.finishFollowup).toHaveBeenCalled();

      resolveExecution({ success: true, output: 'done' });
      await executePromise.catch(() => {});
    });

    it('should check canFollowup correctly', async () => {
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Mock canFollowup on session
      mockSession.canFollowup = vi.fn().mockReturnValue(true);

      const canFollow = engine.canFollowup('order-1');

      expect(canFollow).toBe(true);

      resolveExecution({ success: true, output: 'done' });
      await executePromise.catch(() => {});
    });
  });

  describe('Session Management', () => {
    it('should restore session for followup after app restart', async () => {
      const completedOrder: Order = {
        ...mockOrder,
        id: 'order-completed',
        status: OrderStatus.COMPLETED,
        startedAt: new Date(),
        endedAt: new Date(),
      };

      await engine.restoreSessionForFollowup(
        completedOrder,
        mockBarista,
        'cafe-123',
        '/project/path'
      );

      const sessionManager = engine.getSessionManager();
      expect(sessionManager.createSession).toHaveBeenCalled();
      expect(mockSession.restoreForFollowup).toHaveBeenCalled();
    });
  });
});
