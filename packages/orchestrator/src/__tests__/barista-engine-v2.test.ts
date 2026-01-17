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
      process: {
        pid: 123,
        write: vi.fn().mockResolvedValue(undefined),
      },
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
    // Reset write mock for each test
    mockLease.terminal.process.write = vi.fn().mockResolvedValue(undefined);

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

      expect(mockTerminalPool.acquireLease).toHaveBeenCalledWith('claude-code', 'barista-1', expect.any(String));
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

  describe('sendInput - Legacy Mode', () => {
    it('should send input to active legacy execution', async () => {
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Send input to active order
      const testMessage = 'test input message';
      await engine.sendInput('order-1', testMessage);

      // Verify write was called on the terminal process
      expect(mockLease.terminal.process.write).toHaveBeenCalledWith(testMessage + '\n');

      // Complete execution
      resolveExecution({ success: true, output: 'done' });
      await executePromise;
    });

    it('should handle non-existent order gracefully', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await engine.sendInput('non-existent-order', 'test');

      expect(warnSpy).toHaveBeenCalledWith(
        '[BaristaEngineV2] No active execution for order to send input: non-existent-order'
      );

      warnSpy.mockRestore();
    });

    it('should handle write errors gracefully', async () => {
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Mock write failure
      mockLease.terminal.process.write.mockImplementation(() => {
        throw new Error('Write failed');
      });

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(engine.sendInput('order-1', 'test')).rejects.toThrow('Write failed');

      errorSpy.mockRestore();

      // Complete execution
      resolveExecution({ success: true, output: 'done' });
      await executePromise;
    });

    it('should handle multiline input', async () => {
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => setTimeout(resolve, 50));

      const multilineInput = 'Line 1\nLine 2\nLine 3';
      await engine.sendInput('order-1', multilineInput);

      expect(mockLease.terminal.process.write).toHaveBeenCalledWith(multilineInput + '\n');

      resolveExecution({ success: true, output: 'done' });
      await executePromise;
    });

    it('should handle unicode input', async () => {
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => setTimeout(resolve, 50));

      const unicodeInput = '안녕하세요 👍 🚀';
      await engine.sendInput('order-1', unicodeInput);

      expect(mockLease.terminal.process.write).toHaveBeenCalledWith(unicodeInput + '\n');

      resolveExecution({ success: true, output: 'done' });
      await executePromise;
    });
  });

  describe('sendInput - Session Mode', () => {
    let mockSession: any;

    beforeEach(() => {
      mockSession = {
        execute: vi.fn().mockResolvedValue(undefined),
        sendInput: vi.fn().mockResolvedValue(undefined),
        cancel: vi.fn().mockResolvedValue(undefined),
      };
    });

    it('should send input to active session execution', async () => {
      // Manually set up a session-based execution
      engine['activeExecutions'].set('order-1', {
        baristaId: 'barista-1',
        session: mockSession,
      });

      const testMessage = 'session input message';
      await engine.sendInput('order-1', testMessage);

      expect(mockSession.sendInput).toHaveBeenCalledWith(testMessage);
    });

    it('should handle session sendInput errors', async () => {
      engine['activeExecutions'].set('order-1', {
        baristaId: 'barista-1',
        session: mockSession,
      });

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockSession.sendInput.mockRejectedValue(new Error('Session send failed'));

      await expect(engine.sendInput('order-1', 'test')).rejects.toThrow('Session send failed');

      errorSpy.mockRestore();
    });
  });

  describe('sendInput - Edge Cases', () => {
    it('should handle execution without session or lease', async () => {
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Manually remove lease to simulate edge case
      const execution = engine['activeExecutions'].get('order-1');
      if (execution) {
        delete execution.lease;
      }

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await engine.sendInput('order-1', 'test');

      expect(warnSpy).toHaveBeenCalledWith(
        '[BaristaEngineV2] No active terminal for order: order-1'
      );

      warnSpy.mockRestore();

      resolveExecution({ success: true, output: 'done' });
      await executePromise;
    });

    it('should handle empty input', async () => {
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => setTimeout(resolve, 50));

      await engine.sendInput('order-1', '');

      expect(mockLease.terminal.process.write).toHaveBeenCalledWith('\n');

      resolveExecution({ success: true, output: 'done' });
      await executePromise;
    });

    it('should handle special characters', async () => {
      const resolveExecution = setupControlledExecution();
      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      await new Promise(resolve => setTimeout(resolve, 50));

      const specialInput = 'Test "quoted" and \'escaped\' and $special & <chars>';
      await engine.sendInput('order-1', specialInput);

      expect(mockLease.terminal.process.write).toHaveBeenCalledWith(specialInput + '\n');

      resolveExecution({ success: true, output: 'done' });
      await executePromise;
    });
  });
});
