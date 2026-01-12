/**
 * Terminal Pool Tests
 * Tests for Gap 2 (Concurrency) and Gap 5 (Crash Recovery)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalPool } from '../terminal/terminal-pool';
import { ProviderAdapterFactory } from '../terminal/provider-adapter';
import { MockProviderAdapter } from '../terminal/provider-adapter';

// Mock ProviderAdapterFactory
vi.mock('../terminal/provider-adapter', () => ({
  ProviderAdapterFactory: {
    get: vi.fn(),
  },
}));

describe('TerminalPool', () => {
  let terminalPool: TerminalPool;
  let mockAdapter: MockProviderAdapter;

  const mockConfig = {
    perProvider: {
      'claude-code': {
        size: 2,
        timeout: 30000,
        maxRetries: 3,
      },
    },
  };

  beforeEach(() => {
    mockAdapter = {
      spawn: vi.fn().mockResolvedValue({ pid: 123 }),
      kill: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue({ success: true, output: 'test' }),
      onExit: vi.fn(),
    };

    (ProviderAdapterFactory.get as any).mockReturnValue(mockAdapter);
    terminalPool = new TerminalPool(mockConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Gap 2: Concurrency Model', () => {
    it('should acquire and release lease successfully', async () => {
      const baristaId = 'barista-1';
      const provider = 'claude-code';

      const lease = await terminalPool.acquireLease(provider, baristaId);

      expect(lease).toBeDefined();
      expect(lease.terminal).toBeDefined();
      expect(lease.token).toBeDefined();
      expect(lease.token.baristaId).toBe(baristaId);
      expect(lease.token.provider).toBe(provider);
      expect(lease.token.released).toBe(false);

      // Release lease
      await lease.release();
      expect(lease.token.released).toBe(true);
    });

    it('should enforce pool size limit', async () => {
      const provider = 'claude-code';
      const leases = [];

      // Acquire up to pool size
      for (let i = 0; i < 2; i++) {
        const lease = await terminalPool.acquireLease(provider, `barista-${i}`);
        leases.push(lease);
      }

      // Third acquisition should timeout (pool size is 2)
      await expect(
        terminalPool.acquireLease(provider, 'barista-3', 100) // Short timeout
      ).rejects.toThrow();

      // Release one lease
      await leases[0].release();

      // Now should be able to acquire
      const newLease = await terminalPool.acquireLease(provider, 'barista-4');
      expect(newLease).toBeDefined();
      await newLease.release();
    });

    it('should track pool metrics', async () => {
      const provider = 'claude-code';
      const metrics = terminalPool.getMetrics();

      expect(metrics.providers[provider]).toBeDefined();
      expect(metrics.providers[provider].totalTerminals).toBe(0);
      expect(metrics.providers[provider].idleTerminals).toBe(0);
      expect(metrics.providers[provider].busyTerminals).toBe(0);
      expect(metrics.providers[provider].crashedTerminals).toBe(0);
      expect(metrics.providers[provider].activeLeases).toBe(0);

      // Acquire lease
      const lease = await terminalPool.acquireLease(provider, 'barista-1');
      const metricsAfter = terminalPool.getMetrics();

      expect(metricsAfter.providers[provider].totalTerminals).toBe(1);
      expect(metricsAfter.providers[provider].idleTerminals).toBe(0);
      expect(metricsAfter.providers[provider].busyTerminals).toBe(1);
      expect(metricsAfter.providers[provider].activeLeases).toBe(1);

      await lease.release();
    });
  });

  describe('Gap 5: Crash Recovery', () => {
    it('should handle terminal crash during active lease', async () => {
      const provider = 'claude-code';
      const baristaId = 'barista-1';

      // Setup mock exit handler
      let exitHandler: any;
      mockAdapter.onExit.mockImplementation((process, handler) => {
        exitHandler = handler;
      });

      // Acquire lease
      const lease = await terminalPool.acquireLease(provider, baristaId);
      const terminalId = lease.terminal.id;

      // Simulate crash
      const crashPromise = new Promise<void>((resolve) => {
        // Wait for crash handling
        setTimeout(resolve, 100);
      });

      // Trigger crash
      if (exitHandler) {
        exitHandler({ exitCode: 1 });
      }

      await crashPromise;

      // Terminal should be marked as crashed
      const status = terminalPool.getStatus();
      expect(status[provider].crashed).toBe(1);

      // Adapter should be called for restart attempts
      expect(mockAdapter.spawn).toHaveBeenCalledTimes(2); // Initial + restart attempt
    });

    it('should release semaphore on crash recovery failure', async () => {
      const provider = 'claude-code';
      const baristaId = 'barista-1';

      // Setup mock to fail all restart attempts
      mockAdapter.spawn.mockRejectedValue(new Error('Spawn failed'));

      // Setup mock exit handler
      let exitHandler: any;
      mockAdapter.onExit.mockImplementation((process, handler) => {
        exitHandler = handler;
      });

      // Acquire lease
      const lease = await terminalPool.acquireLease(provider, baristaId);

      // Trigger crash
      if (exitHandler) {
        exitHandler({ exitCode: 1 });
      }

      // Wait for crash recovery to fail
      await new Promise(resolve => setTimeout(resolve, 500));

      // Semaphore should be released (can acquire new lease)
      mockAdapter.spawn.mockResolvedValueOnce({ pid: 456 }); // Allow new spawn
      const newLease = await terminalPool.acquireLease(provider, 'barista-2');
      expect(newLease).toBeDefined();
      await newLease.release();
    });

    it('should handle normal exit gracefully', async () => {
      const provider = 'claude-code';
      const baristaId = 'barista-1';

      // Setup mock exit handler
      let exitHandler: any;
      mockAdapter.onExit.mockImplementation((process, handler) => {
        exitHandler = handler;
      });

      // Acquire and release lease
      const lease = await terminalPool.acquireLease(provider, baristaId);
      await lease.release();

      // Trigger normal exit
      if (exitHandler) {
        exitHandler({ exitCode: 0 });
      }

      // Terminal should be idle
      const status = terminalPool.getStatus();
      expect(status[provider].idle).toBe(1);
      expect(status[provider].crashed).toBe(0);
    });
  });

  describe('Pool Management', () => {
    it('should get pool status', () => {
      const status = terminalPool.getStatus();
      expect(status['claude-code']).toBeDefined();
      expect(status['claude-code'].total).toBe(0);
      expect(status['claude-code'].idle).toBe(0);
      expect(status['claude-code'].busy).toBe(0);
      expect(status['claude-code'].crashed).toBe(0);
    });

    it('should dispose resources', async () => {
      const provider = 'claude-code';

      // Acquire some leases
      const lease1 = await terminalPool.acquireLease(provider, 'barista-1');
      const lease2 = await terminalPool.acquireLease(provider, 'barista-2');

      // Dispose
      await terminalPool.dispose();

      // Adapter kill should be called for each terminal
      expect(mockAdapter.kill).toHaveBeenCalledTimes(2);

      // Try to acquire after dispose (should fail or create new)
      mockAdapter.spawn.mockResolvedValueOnce({ pid: 789 });
      const newPool = new TerminalPool(mockConfig);
      const newLease = await newPool.acquireLease(provider, 'barista-3');
      expect(newLease).toBeDefined();
      await newLease.release();
      await newPool.dispose();
    });
  });
});