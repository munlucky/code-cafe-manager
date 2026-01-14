/**
 * Terminal Pool Tests
 * Tests for Gap 2 (Concurrency) and Gap 5 (Crash Recovery)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalPool } from '../terminal/terminal-pool';
import { ProviderAdapterFactory, MockProviderAdapter } from '../terminal/provider-adapter';

// Mock ProviderAdapterFactory
vi.mock('../terminal/provider-adapter', () => ({
  ProviderAdapterFactory: {
    get: vi.fn(),
  },
}));

describe('TerminalPool', () => {
  const PROVIDER_ID = 'claude-code';
  const BARISTA_ID = 'barista-1';
  const POOL_SIZE = 2;

  let terminalPool: TerminalPool;
  let mockAdapter: MockProviderAdapter;
  let exitCallback: (payload: { exitCode: number }) => void;

  const mockConfig = {
    perProvider: {
      [PROVIDER_ID]: {
        size: POOL_SIZE,
        timeout: 30000,
        maxRetries: 3,
      },
    },
  };

  beforeEach(() => {
    // Reset exit callback
    exitCallback = () => {};

    mockAdapter = {
      spawn: vi.fn().mockResolvedValue({ pid: 123 }),
      kill: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue({ success: true, output: 'test' }),
      onExit: vi.fn().mockImplementation((_, handler) => {
        exitCallback = handler;
      }),
    };

    vi.mocked(ProviderAdapterFactory.get).mockReturnValue(mockAdapter);
    terminalPool = new TerminalPool(mockConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Helper to trigger terminal exit
  function triggerTerminalExit(exitCode = 1) {
    if (exitCallback) {
      exitCallback({ exitCode });
    }
  }

  describe('Gap 2: Concurrency Model', () => {
    it('should acquire and release lease successfully', async () => {
      const lease = await terminalPool.acquireLease(PROVIDER_ID, BARISTA_ID);

      expect(lease).toBeDefined();
      expect(lease.token).toMatchObject({
        baristaId: BARISTA_ID,
        provider: PROVIDER_ID,
        released: false,
      });

      // Release lease
      await lease.release();
      expect(lease.token.released).toBe(true);
    });

    it('should enforce pool size limit', async () => {
      const leases = [];

      // Acquire up to pool size
      for (let i = 0; i < POOL_SIZE; i++) {
        const lease = await terminalPool.acquireLease(PROVIDER_ID, `barista-${i}`);
        leases.push(lease);
      }

      // Third acquisition should timeout (pool size is 2)
      await expect(
        terminalPool.acquireLease(PROVIDER_ID, 'barista-overflow', 100)
      ).rejects.toThrow();

      // Release one lease
      await leases[0].release();

      // Now should be able to acquire
      const newLease = await terminalPool.acquireLease(PROVIDER_ID, 'barista-new');
      expect(newLease).toBeDefined();
      await newLease.release();
    });

    it('should track pool metrics', async () => {
      const initialMetrics = terminalPool.getMetrics();
      expect(initialMetrics.providers[PROVIDER_ID]).toMatchObject({
        totalTerminals: 0,
        activeLeases: 0,
      });

      // Acquire lease
      const lease = await terminalPool.acquireLease(PROVIDER_ID, BARISTA_ID);

      const activeMetrics = terminalPool.getMetrics();
      expect(activeMetrics.providers[PROVIDER_ID]).toMatchObject({
        totalTerminals: 1,
        activeLeases: 1,
      });

      await lease.release();
    });
  });

  describe('Gap 5: Crash Recovery', () => {
    it('should handle terminal crash during active lease', async () => {
      const lease = await terminalPool.acquireLease(PROVIDER_ID, BARISTA_ID);

      // Trigger crash
      triggerTerminalExit(1);

      // Wait for crash handling
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Terminal should be auto-restarted (crashed terminal is deleted after successful restart)
      const status = terminalPool.getStatus();
      expect(status[PROVIDER_ID].crashed).toBe(0);
      expect(status[PROVIDER_ID].total).toBeGreaterThanOrEqual(1);

      // Adapter should be called for restart attempts
      expect(mockAdapter.spawn).toHaveBeenCalledTimes(2); // Initial + restart attempt
    });

    it('should release semaphore on crash recovery failure', async () => {
      await terminalPool.acquireLease(PROVIDER_ID, BARISTA_ID);

      // Setup mock to fail all restart attempts (after initial spawn)
      mockAdapter.spawn.mockRejectedValue(new Error('Spawn failed'));

      // Trigger crash
      triggerTerminalExit(1);

      // Wait for crash recovery to fail
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Semaphore should be released (can acquire new lease)
      mockAdapter.spawn.mockResolvedValueOnce({ pid: 456 }); // Allow new spawn

      const newLease = await terminalPool.acquireLease(PROVIDER_ID, 'barista-2');
      expect(newLease).toBeDefined();
      await newLease.release();
    });

    it('should handle normal exit gracefully', async () => {
      const lease = await terminalPool.acquireLease(PROVIDER_ID, BARISTA_ID);
      await lease.release();

      // Trigger normal exit
      triggerTerminalExit(0);

      // Terminal should be idle
      const status = terminalPool.getStatus();
      expect(status[PROVIDER_ID].idle).toBe(1);
      expect(status[PROVIDER_ID].crashed).toBe(0);
    });
  });

  describe('Pool Management', () => {
    it('should get pool status', () => {
      const status = terminalPool.getStatus();
      expect(status[PROVIDER_ID]).toEqual({
        total: 0,
        idle: 0,
        busy: 0,
        crashed: 0,
      });
    });

    it('should dispose resources', async () => {
      // Acquire some leases
      await terminalPool.acquireLease(PROVIDER_ID, 'barista-1');
      await terminalPool.acquireLease(PROVIDER_ID, 'barista-2');

      // Dispose
      await terminalPool.dispose();

      // Adapter kill should be called for each terminal
      expect(mockAdapter.kill).toHaveBeenCalledTimes(2);
    });
  });
});
