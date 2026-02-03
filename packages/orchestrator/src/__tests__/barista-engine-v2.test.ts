/**
 * Barista Engine V2 Tests
 * Tests for Terminal Pool integration and Session-based execution
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { BaristaEngineV2 } from '../barista/barista-engine-v2';
import { Barista, BaristaStatus, Order, OrderStatus } from '@codecafe/core';
import { OrderSession } from '../session';

/**
 * MockSession class that extends EventEmitter to properly simulate session events
 */
class MockSession extends EventEmitter {
  execute = vi.fn();
  executePrompt = vi.fn();
  sendInput = vi.fn();
  cancel = vi.fn();
  getStatus = vi.fn().mockReturnValue({ status: 'idle' });
  getContext = vi.fn().mockReturnValue({
    getCurrentAttemptNumber: () => 1,
  });
  getFailedState = vi.fn().mockReturnValue(null);
  getRetryOptions = vi.fn().mockReturnValue(null);
  canFollowup = vi.fn().mockReturnValue(false);
  retryFromStage = vi.fn();
  retryFromBeginning = vi.fn();
  enterFollowup = vi.fn();
  executeFollowup = vi.fn();
  finishFollowup = vi.fn();
  restoreForFollowup = vi.fn();
  setWorkflow = vi.fn();
  dispose = vi.fn();

  constructor() {
    super();
    // Default implementations that resolve immediately
    this.execute.mockResolvedValue(undefined);
    this.executePrompt.mockResolvedValue(undefined);
    this.sendInput.mockResolvedValue(undefined);
    this.cancel.mockResolvedValue(undefined);
    this.retryFromStage.mockResolvedValue(undefined);
    this.retryFromBeginning.mockResolvedValue(undefined);
    this.enterFollowup.mockResolvedValue(undefined);
    this.executeFollowup.mockResolvedValue(undefined);
    this.finishFollowup.mockResolvedValue(undefined);
    this.restoreForFollowup.mockResolvedValue(undefined);
    this.dispose.mockResolvedValue(undefined);
  }
}

describe('BaristaEngineV2', () => {
  let engine: BaristaEngineV2;
  let mockTerminalPool: any;
  let mockSession: MockSession;

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

  // Helper to control execution flow and emit session:started event
  const setupControlledExecution = () => {
    let resolveExecution: (value: any) => void;
    mockSession.execute.mockImplementation(() => {
      // Emit session:started event after a microtask to ensure listeners are set up
      queueMicrotask(() => {
        mockSession.emit('session:started', { orderId: mockOrder.id, cafeId: 'default' });
      });
      return new Promise(resolve => {
        resolveExecution = resolve;
      });
    });
    return (val: any) => resolveExecution(val);
  };

  beforeEach(() => {
    // Initialize mock session with EventEmitter capabilities
    mockSession = new MockSession();

    mockTerminalPool = {
      acquireLease: vi.fn().mockResolvedValue(undefined),
    };

    engine = new BaristaEngineV2(mockTerminalPool as any);

    // Mock sessionManager methods to return our mock session
    // and set up event forwarding like the real createSession does
    const sessionManager = engine.getSessionManager();

    const setupSessionEvents = () => {
      // Forward session events to session manager (mimicking real behavior)
      mockSession.on('session:started', (data: unknown) => sessionManager.emit('session:started', data));
      mockSession.on('session:completed', (data: unknown) => sessionManager.emit('session:completed', data));
      mockSession.on('session:failed', (data: unknown) => sessionManager.emit('session:failed', data));
      mockSession.on('session:awaiting', (data: unknown) => sessionManager.emit('session:awaiting', data));
      mockSession.on('output', (data: unknown) => sessionManager.emit('output', data));
      mockSession.on('stage:started', (data: unknown) => sessionManager.emit('stage:started', data));
      mockSession.on('stage:completed', (data: unknown) => sessionManager.emit('stage:completed', data));
      mockSession.on('stage:failed', (data: unknown) => sessionManager.emit('stage:failed', data));
    };

    vi.spyOn(sessionManager, 'createSession').mockImplementation(() => {
      setupSessionEvents();
      return mockSession as unknown as OrderSession;
    });
    vi.spyOn(sessionManager, 'createSessionWithWorkflow').mockImplementation(() => {
      setupSessionEvents();
      return mockSession as unknown as OrderSession;
    });
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
      await new Promise(resolve => engine.once('order:started', resolve));

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

      await new Promise(resolve => engine.once('order:started', resolve));

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

      await new Promise(resolve => engine.once('order:started', resolve));

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
      // Setup blocked execution that emits session:started
      mockSession.execute.mockImplementation(() => {
        // Emit session:started event
        queueMicrotask(() => {
          mockSession.emit('session:started', { orderId: mockOrder.id, cafeId: 'default' });
        });
        return new Promise(() => {});  // Never resolves
      });

      engine.executeOrder(mockOrder, mockBarista);
      await new Promise(resolve => engine.once('order:started', resolve));

      await engine.dispose();

      expect(mockSession.cancel).toHaveBeenCalled();
      expect(engine.getActiveExecutions().size).toBe(0);
    });
  });

  describe('sendInput', () => {
    it('should send input to active session execution', async () => {
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => engine.once('order:started', resolve));

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

      await new Promise(resolve => engine.once('order:started', resolve));

      mockSession.sendInput.mockRejectedValue(new Error('Send failed'));

      await expect(engine.sendInput('order-1', 'test')).rejects.toThrow('Send failed');

      resolveExecution({ success: true, output: 'done' });
      await executePromise.catch(() => {});
    });

    it('should handle empty input', async () => {
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => engine.once('order:started', resolve));

      await engine.sendInput('order-1', '');

      expect(mockSession.sendInput).toHaveBeenCalledWith('');

      resolveExecution({ success: true, output: 'done' });
      await executePromise.catch(() => {});
    });

    it('should handle multiline input', async () => {
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => engine.once('order:started', resolve));

      const multilineInput = 'Line 1\nLine 2\nLine 3';
      await engine.sendInput('order-1', multilineInput);

      expect(mockSession.sendInput).toHaveBeenCalledWith(multilineInput);

      resolveExecution({ success: true, output: 'done' });
      await executePromise.catch(() => {});
    });

    it('should handle unicode input', async () => {
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => engine.once('order:started', resolve));

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

      await new Promise(resolve => engine.once('order:started', resolve));

      await engine.retryFromStage('order-1', 'stage-2');

      expect(mockSession.retryFromStage).toHaveBeenCalledWith('stage-2');

      resolveExecution({ success: true, output: 'done' });
      await executePromise.catch(() => {});
    });

    it('should retry from beginning', async () => {
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => engine.once('order:started', resolve));

      await engine.retryFromBeginning('order-1', true);

      expect(mockSession.retryFromBeginning).toHaveBeenCalledWith(true);

      resolveExecution({ success: true, output: 'done' });
      await executePromise.catch(() => {});
    });

    it('should return retry options for order with session', async () => {
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => engine.once('order:started', resolve));

      // Mock getFailedState to return retryOptions (engine uses session.getFailedState().retryOptions)
      const mockRetryOptions = [
        { stageId: 'stage-1', stageName: 'Analyze', batchIndex: 0 },
        { stageId: 'stage-2', stageName: 'Code', batchIndex: 1 },
      ];
      mockSession.getFailedState.mockReturnValue({ retryOptions: mockRetryOptions });

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

      await new Promise(resolve => engine.once('order:started', resolve));

      await engine.enterFollowup('order-1');

      expect(mockSession.enterFollowup).toHaveBeenCalled();

      resolveExecution({ success: true, output: 'done' });
      await executePromise.catch(() => {});
    });

    it('should execute followup prompt', async () => {
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => engine.once('order:started', resolve));

      await engine.executeFollowup('order-1', 'Add tests for this feature');

      expect(mockSession.executeFollowup).toHaveBeenCalledWith('Add tests for this feature');

      resolveExecution({ success: true, output: 'done' });
      await executePromise.catch(() => {});
    });

    it('should finish followup mode', async () => {
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => engine.once('order:started', resolve));

      await engine.finishFollowup('order-1');

      expect(mockSession.finishFollowup).toHaveBeenCalled();

      resolveExecution({ success: true, output: 'done' });
      await executePromise.catch(() => {});
    });

    it('should check canFollowup correctly', async () => {
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => engine.once('order:started', resolve));

      // Mock getStatus to return 'completed' (engine checks session.getStatus().status === 'completed' || 'followup')
      mockSession.getStatus.mockReturnValue({ status: 'completed' });

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
