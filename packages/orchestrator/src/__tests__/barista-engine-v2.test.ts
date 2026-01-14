/**
 * Barista Engine V2 Tests
 * Tests for Terminal Pool integration and Role-based execution
 */

import { BaristaEngineV2 } from '../barista/barista-engine-v2';
import { ProviderAdapterFactory } from '../terminal/provider-adapter';
import { Barista, BaristaStatus, Order, OrderStatus } from '@codecafe/core';

describe('BaristaEngineV2', () => {
  let engine: BaristaEngineV2;
  let mockTerminalPool: any;
  let mockRoleManager: any;
  let mockAdapter: any;

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

  const mockLease = {
    terminal: {
      id: 'terminal-1',
      provider: 'claude-code',
      process: { pid: 123 },
      status: 'busy' as const,
      createdAt: new Date(),
      lastUsed: new Date(),
    },
    token: {
      id: 'lease-1',
      terminalId: 'terminal-1',
      baristaId: 'barista-1',
      provider: 'claude-code',
      leasedAt: new Date(),
      expiresAt: new Date(Date.now() + 30000),
      released: false,
    },
    release: vi.fn().mockResolvedValue(undefined),
  };

  const defaultRole = {
    id: 'planner',
    name: 'Planner',
    output_schema: '',
    inputs: ['read_file', 'write_file'],
    template: 'Plan: {{param1}}',
  };

  // Helper to control execution flow
  const setupControlledExecution = () => {
    let resolveExecution: (value: any) => void;
    mockAdapter.execute.mockImplementation(() => {
      return new Promise(resolve => {
        resolveExecution = resolve;
      });
    });
    return (val: any) => resolveExecution(val);
  };

  beforeEach(() => {
    mockTerminalPool = {
      acquireLease: vi.fn().mockResolvedValue(mockLease),
    };

    mockRoleManager = {
      loadRole: vi.fn().mockReturnValue(defaultRole),
    };

    mockAdapter = {
      execute: vi.fn().mockResolvedValue({ success: true, output: 'test output' }),
      kill: vi.fn().mockResolvedValue(undefined),
    };

    (ProviderAdapterFactory as any).get = vi.fn().mockReturnValue(mockAdapter);

    engine = new BaristaEngineV2(mockTerminalPool as any, mockRoleManager);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Order Execution', () => {
    it('should execute order successfully', async () => {
      await engine.executeOrder(mockOrder, mockBarista);

      expect(mockTerminalPool.acquireLease).toHaveBeenCalledWith('claude-code', 'barista-1');
      expect(mockAdapter.execute).toHaveBeenCalled();
      expect(mockLease.release).toHaveBeenCalled();
    });

    it('should handle role not found', async () => {
      mockRoleManager.loadRole.mockReturnValue(null);

      await expect(engine.executeOrder(mockOrder, mockBarista))
        .rejects.toThrow("Role 'planner' not found for barista barista-1");
    });

    it('should execute order without role', async () => {
      const baristaWithoutRole = { ...mockBarista, role: undefined };
      mockRoleManager.loadRole.mockReturnValue(null);

      await engine.executeOrder(mockOrder, baristaWithoutRole);

      expect(mockTerminalPool.acquireLease).toHaveBeenCalled();
      expect(mockAdapter.execute).toHaveBeenCalled();
      expect(mockLease.release).toHaveBeenCalled();
    });

    it('should handle execution failure', async () => {
      mockAdapter.execute.mockRejectedValue(new Error('Execution failed'));

      await expect(engine.executeOrder(mockOrder, mockBarista))
        .rejects.toThrow();

      expect(mockLease.release).toHaveBeenCalled();
    });

    it('should handle step failure', async () => {
      mockAdapter.execute.mockResolvedValue({ success: false, error: 'Step failed' });

      await expect(engine.executeOrder(mockOrder, mockBarista))
        .rejects.toThrow('Step step-1 failed: Step failed');

      expect(mockLease.release).toHaveBeenCalled();
    });
  });

  describe('Context Preparation', () => {
    it('should prepare context with role template', async () => {
      const mockRole = {
        ...defaultRole,
        inputs: ['skill1', 'skill2'],
        template: 'Plan for {{param1}} with {{param2}}',
      };
      mockRoleManager.loadRole.mockReturnValue(mockRole);

      const orderWithParams: Order = {
        ...mockOrder,
        steps: [{
          id: 'step-1',
          task: 'Test task',
          parameters: { param1: 'value1', param2: 'value2' },
        }],
      };

      await engine.executeOrder(orderWithParams, mockBarista);

      const context = mockAdapter.execute.mock.calls[0][1];
      expect(context).toMatchObject({
        stepId: 'step-1',
        task: 'Test task',
        parameters: { param1: 'value1', param2: 'value2' },
        role: {
          id: 'planner',
          name: 'Planner',
          skills: ['skill1', 'skill2'],
        },
        systemPrompt: 'Plan for value1 with value2',
      });
    });

    it('should prepare context without role', async () => {
      const baristaWithoutRole = { ...mockBarista, role: undefined };
      mockRoleManager.loadRole.mockReturnValue(null);

      await engine.executeOrder(mockOrder, baristaWithoutRole);

      const context = mockAdapter.execute.mock.calls[0][1];
      expect(context).toMatchObject({
        stepId: 'step-1',
        task: 'Test task',
        parameters: { param1: 'value1' },
      });
      expect(context.role).toBeUndefined();
      expect(context.systemPrompt).toBeUndefined();
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
      expect(mockAdapter.kill).toHaveBeenCalledWith(mockLease.terminal.process);
      expect(mockLease.release).toHaveBeenCalled();

      // Resolve execution to clean up
      resolveExecution({ success: true, output: 'cancelled' });
      await executePromise;
    });

    it('should return false for non-existent order', async () => {
      const cancelled = await engine.cancelOrder('non-existent-order');
      expect(cancelled).toBe(false);
    });

    it('should handle cancellation failure', async () => {
      // Setup active order that will fail to kill
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Mock kill failure
      mockAdapter.kill.mockRejectedValue(new Error('Kill failed'));

      const cancelled = await engine.cancelOrder('order-1');
      expect(cancelled).toBe(false);

      resolveExecution({ success: true, output: 'done' });
      await executePromise;
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

      // Complete execution
      resolveExecution({ success: true, output: 'done' });
      await executePromise;

      expect(engine.getActiveExecutions().size).toBe(0);
    });
  });

  describe('Resource Cleanup', () => {
    it('should dispose resources and cancel active orders', async () => {
      // Setup blocked execution
      mockAdapter.execute.mockImplementation(() => new Promise(() => {}));

      const executePromise = engine.executeOrder(mockOrder, mockBarista);
      await new Promise(resolve => setTimeout(resolve, 50));

      await engine.dispose();

      expect(mockAdapter.kill).toHaveBeenCalled();
      expect(mockLease.release).toHaveBeenCalled();
      expect(engine.getActiveExecutions().size).toBe(0);
    });
  });
});
