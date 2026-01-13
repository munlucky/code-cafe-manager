/**
 * Barista Engine V2 Tests
 * Tests for Terminal Pool integration and Role-based execution
 */

// Test framework imports removed for type checking
import { BaristaEngineV2 } from '../barista/barista-engine-v2';
import { TerminalPool } from '../terminal/terminal-pool';
import { ProviderAdapterFactory } from '../terminal/provider-adapter';
import { RoleManager } from '../role/role-manager';
import { Barista, BaristaStatus, Order, OrderStatus } from '@codecafe/core';
import { Step } from '@codecafe/core';

// Mock dependencies - commented out for type checking
// vi.mock('../terminal/terminal-pool');
// vi.mock('../terminal/provider-adapter');
// vi.mock('../role/role-manager');

describe('BaristaEngineV2', () => {
  let engine: BaristaEngineV2;
  let mockTerminalPool: any;
  let mockRoleManager: any;
  let mockAdapter: any;

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

  beforeEach(() => {
    // Setup mocks - simplified for type checking
    mockTerminalPool = {
      acquireLease: vi.fn().mockResolvedValue(mockLease),
    };

    mockRoleManager = {
      loadRole: vi.fn().mockReturnValue(null),
    };

    mockAdapter = {
      execute: vi.fn().mockResolvedValue({ success: true, output: 'test output' }),
      kill: vi.fn().mockResolvedValue(undefined),
    };

    // Mock static methods
    (ProviderAdapterFactory as any).get = vi.fn().mockReturnValue(mockAdapter);

    engine = new BaristaEngineV2(mockTerminalPool as any, mockRoleManager);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Order Execution', () => {
    it('should execute order successfully', async () => {
      const mockRole = {
        id: 'planner',
        name: 'Planner',
        output_schema: '',
        inputs: ['read_file', 'write_file'],
        template: 'Plan: {{param1}}',
      };

      mockRoleManager.loadRole.mockReturnValue(mockRole);

      await engine.executeOrder(mockOrder, mockBarista);

      // Should acquire lease
      expect(mockTerminalPool.acquireLease).toHaveBeenCalledWith(
        'claude-code',
        'barista-1'
      );

      // Should execute step
      expect(mockAdapter.execute).toHaveBeenCalled();

      // Should release lease
      expect(mockLease.release).toHaveBeenCalled();
    });

    it('should handle role not found', async () => {
      mockRoleManager.loadRole.mockReturnValue(null);

      await expect(
        engine.executeOrder(mockOrder, mockBarista)
      ).rejects.toThrow("Role 'planner' not found for barista barista-1");
    });

    it('should execute order without role', async () => {
      const baristaWithoutRole = { ...mockBarista, role: undefined };
      mockRoleManager.loadRole.mockReturnValue(null); // No role to load

      await engine.executeOrder(mockOrder, baristaWithoutRole);

      // Should still execute
      expect(mockTerminalPool.acquireLease).toHaveBeenCalled();
      expect(mockAdapter.execute).toHaveBeenCalled();
      expect(mockLease.release).toHaveBeenCalled();
    });

    it('should handle execution failure', async () => {
      mockRoleManager.loadRole.mockReturnValue({
        id: 'planner',
        name: 'Planner',
        output_schema: '',
        inputs: [],
        template: '',
      });

      mockAdapter.execute.mockRejectedValue(new Error('Execution failed'));

      await expect(
        engine.executeOrder(mockOrder, mockBarista)
      ).rejects.toThrow();

      // Should still release lease on failure
      expect(mockLease.release).toHaveBeenCalled();
    });

    it('should handle step failure', async () => {
      const mockRole = {
        id: 'planner',
        name: 'Planner',
        output_schema: '',
        inputs: [],
        template: '',
      };

      mockRoleManager.loadRole.mockReturnValue(mockRole);
      mockAdapter.execute.mockResolvedValue({ success: false, error: 'Step failed' });

      await expect(
        engine.executeOrder(mockOrder, mockBarista)
      ).rejects.toThrow('Step step-1 failed: Step failed');

      expect(mockLease.release).toHaveBeenCalled();
    });
  });

  describe('Context Preparation', () => {
    it('should prepare context with role template', async () => {
      const mockRole = {
        id: 'planner',
        name: 'Planner',
        output_schema: '',
        inputs: ['skill1', 'skill2'],
        template: 'Plan for {{param1}} with {{param2}}',
      };

      mockRoleManager.loadRole.mockReturnValue(mockRole);

      const stepWithParams: Step = {
        id: 'step-1',
        task: 'Test task',
        parameters: { param1: 'value1', param2: 'value2' },
      };

      const orderWithParams: Order = {
        ...mockOrder,
        steps: [stepWithParams],
      };

      await engine.executeOrder(orderWithParams, mockBarista);

      // Check that execute was called with proper context
      expect(mockAdapter.execute).toHaveBeenCalled();
      const callArgs = mockAdapter.execute.mock.calls[0];
      const context = callArgs[1]; // Second argument is context

      expect(context.stepId).toBe('step-1');
      expect(context.task).toBe('Test task');
      expect(context.parameters).toEqual({ param1: 'value1', param2: 'value2' });
      expect(context.role).toBeDefined();
      expect(context.role.id).toBe('planner');
      expect(context.role.name).toBe('Planner');
      expect(context.role.skills).toEqual(['skill1', 'skill2']);
      expect(context.systemPrompt).toBe('Plan for value1 with value2');
    });

    it('should prepare context without role', async () => {
      const baristaWithoutRole = { ...mockBarista, role: undefined };
      mockRoleManager.loadRole.mockReturnValue(null);

      await engine.executeOrder(mockOrder, baristaWithoutRole);

      const callArgs = mockAdapter.execute.mock.calls[0];
      const context = callArgs[1];

      expect(context.stepId).toBe('step-1');
      expect(context.task).toBe('Test task');
      expect(context.parameters).toEqual({ param1: 'value1' });
      expect(context.role).toBeUndefined();
      expect(context.systemPrompt).toBeUndefined();
    });
  });

  describe('Order Cancellation', () => {
    it('should cancel active order', async () => {
      // First execute an order to make it active
      mockRoleManager.loadRole.mockReturnValue({
        id: 'planner',
        name: 'Planner',
        output_schema: '',
        inputs: [],
        template: '',
      });

      // Mock execute to not complete immediately
      let executeResolve: any;
      mockAdapter.execute.mockImplementation(() => {
        return new Promise(resolve => {
          executeResolve = resolve;
        });
      });

      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      // Wait a bit for execution to start
      await new Promise(resolve => setTimeout(resolve, 100));

      // Cancel the order
      const cancelled = await engine.cancelOrder('order-1');
      expect(cancelled).toBe(true);

      // Should kill process
      expect(mockAdapter.kill).toHaveBeenCalledWith(mockLease.terminal.process);

      // Should release lease
      expect(mockLease.release).toHaveBeenCalled();

      // Resolve the execution promise
      executeResolve({ success: true, output: 'cancelled' });
      await executePromise;
    });

    it('should return false for non-existent order', async () => {
      const cancelled = await engine.cancelOrder('non-existent-order');
      expect(cancelled).toBe(false);
    });

    it('should handle cancellation failure', async () => {
      // Make an order active
      mockRoleManager.loadRole.mockReturnValue({
        id: 'planner',
        name: 'Planner',
        output_schema: '',
        inputs: [],
        template: '',
      });

      mockAdapter.execute.mockResolvedValue({ success: true, output: 'test' });

      await engine.executeOrder(mockOrder, mockBarista);

      // Mock kill to fail
      mockAdapter.kill.mockRejectedValue(new Error('Kill failed'));

      const cancelled = await engine.cancelOrder('order-1');
      expect(cancelled).toBe(false);
    });
  });

  describe('Active Executions', () => {
    it('should track active executions', async () => {
      mockRoleManager.loadRole.mockReturnValue({
        id: 'planner',
        name: 'Planner',
        output_schema: '',
        inputs: [],
        template: '',
      });

      // Mock execute to not complete immediately
      let executeResolve: any;
      mockAdapter.execute.mockImplementation(() => {
        return new Promise(resolve => {
          executeResolve = resolve;
        });
      });

      const executePromise = engine.executeOrder(mockOrder, mockBarista);

      // Wait a bit for execution to start
      await new Promise(resolve => setTimeout(resolve, 50));

      // Check active executions
      const activeExecutions = engine.getActiveExecutions();
      expect(activeExecutions.size).toBe(1);
      expect(activeExecutions.get('order-1')).toBeDefined();
      expect(activeExecutions.get('order-1')?.baristaId).toBe('barista-1');

      // Complete execution
      executeResolve({ success: true, output: 'done' });
      await executePromise;

      // Should no longer be active
      const afterExecutions = engine.getActiveExecutions();
      expect(afterExecutions.size).toBe(0);
    });
  });

  describe('Resource Cleanup', () => {
    it('should dispose resources', async () => {
      // Add some active executions
      mockRoleManager.loadRole.mockReturnValue({
        id: 'planner',
        name: 'Planner',
        output_schema: '',
        inputs: [],
        template: '',
      });

      // Mock execute to not complete
      mockAdapter.execute.mockImplementation(() => new Promise(() => {}));

      const executePromise = engine.executeOrder(mockOrder, mockBarista);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Dispose
      await engine.dispose();

      // Should cancel all active orders
      expect(mockAdapter.kill).toHaveBeenCalled();
      expect(mockLease.release).toHaveBeenCalled();

      // Active executions should be cleared
      const activeExecutions = engine.getActiveExecutions();
      expect(activeExecutions.size).toBe(0);
    });
  });
});