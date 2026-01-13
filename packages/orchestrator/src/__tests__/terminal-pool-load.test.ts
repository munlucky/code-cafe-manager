/**
 * Terminal Pool Load Tests
 * P3: Performance testing and p99 metrics measurement
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

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedArray: number[], p: number): number {
  if (sortedArray.length === 0) return 0;
  const index = Math.ceil((sortedArray.length * p) / 100) - 1;
  return sortedArray[Math.max(0, index)];
}

/**
 * Wait for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Terminal Pool Load Tests', () => {
  let terminalPool: TerminalPool;
  let mockAdapter: MockProviderAdapter;

  const mockConfig = {
    perProvider: {
      'claude-code': {
        size: 10,
        timeout: 30000,
        maxRetries: 3,
      },
    },
  };

  beforeEach(async () => {
    // Dispose previous pool if exists
    if (terminalPool) {
      await terminalPool.dispose();
    }

    // Mock adapter with realistic delays
    mockAdapter = {
      spawn: vi.fn().mockImplementation(async () => {
        await sleep(10); // Simulate spawn delay
        return { pid: Math.floor(Math.random() * 10000) };
      }),
      kill: vi.fn().mockImplementation(async () => {
        await sleep(5); // Simulate kill delay
      }),
      execute: vi.fn().mockImplementation(async () => {
        await sleep(50); // Simulate execution delay
        return { success: true, output: 'test output' };
      }),
      onExit: vi.fn(),
    };

    (ProviderAdapterFactory.get as any).mockReturnValue(mockAdapter);
    terminalPool = new TerminalPool(mockConfig);
  });

  afterEach(async () => {
    await terminalPool.dispose();
    vi.clearAllMocks();
  });

  describe('P99 Metrics Measurement', () => {
    it('should measure p99 wait time under light load (10 requests)', async () => {
      const provider = 'claude-code';
      const numRequests = 10;
      const waitTimes: number[] = [];

      // Sequential requests (light load)
      for (let i = 0; i < numRequests; i++) {
        const startTime = Date.now();
        const lease = await terminalPool.acquireLease(provider, `barista-${i}`);
        const waitTime = Date.now() - startTime;
        waitTimes.push(waitTime);

        // Simulate work
        await sleep(20);

        await lease.release();
      }

      // Calculate metrics
      waitTimes.sort((a, b) => a - b);
      const p50 = percentile(waitTimes, 50);
      const p95 = percentile(waitTimes, 95);
      const p99 = percentile(waitTimes, 99);
      const avg = waitTimes.reduce((sum, t) => sum + t, 0) / waitTimes.length;

      console.log('\n📊 Light Load (10 sequential requests):');
      console.log(`  Average wait time: ${avg.toFixed(2)}ms`);
      console.log(`  P50 wait time: ${p50}ms`);
      console.log(`  P95 wait time: ${p95}ms`);
      console.log(`  P99 wait time: ${p99}ms`);

      // Assertions
      expect(p99).toBeLessThan(100); // Should be very fast under light load
      expect(waitTimes.every((t) => t >= 0)).toBe(true);
    });

    it('should measure p99 wait time under moderate load (50 concurrent requests)', async () => {
      const provider = 'claude-code';
      const numRequests = 50;
      const waitTimes: number[] = [];

      // Concurrent requests (moderate load)
      const promises = Array.from({ length: numRequests }, async (_, i) => {
        const startTime = Date.now();
        const lease = await terminalPool.acquireLease(provider, `barista-${i}`);
        const waitTime = Date.now() - startTime;
        waitTimes.push(waitTime);

        // Simulate work
        await sleep(30);

        await lease.release();
      });

      await Promise.all(promises);

      // Calculate metrics
      waitTimes.sort((a, b) => a - b);
      const p50 = percentile(waitTimes, 50);
      const p95 = percentile(waitTimes, 95);
      const p99 = percentile(waitTimes, 99);
      const avg = waitTimes.reduce((sum, t) => sum + t, 0) / waitTimes.length;
      const max = Math.max(...waitTimes);

      console.log('\n📊 Moderate Load (50 concurrent requests):');
      console.log(`  Average wait time: ${avg.toFixed(2)}ms`);
      console.log(`  P50 wait time: ${p50}ms`);
      console.log(`  P95 wait time: ${p95}ms`);
      console.log(`  P99 wait time: ${p99}ms`);
      console.log(`  Max wait time: ${max}ms`);

      // Assertions - with pool size 10, some requests will wait
      expect(p50).toBeLessThan(200);
      expect(p99).toBeLessThan(500); // Should still be reasonable
      expect(waitTimes.every((t) => t >= 0)).toBe(true);
    });

    it('should measure p99 wait time under heavy load (100 concurrent requests)', async () => {
      const provider = 'claude-code';
      const numRequests = 100;
      const waitTimes: number[] = [];
      const startTimes: number[] = [];

      // Track overall throughput
      const overallStart = Date.now();

      // Concurrent requests (heavy load)
      const promises = Array.from({ length: numRequests }, async (_, i) => {
        const startTime = Date.now();
        startTimes.push(startTime);

        const lease = await terminalPool.acquireLease(provider, `barista-${i}`);
        const waitTime = Date.now() - startTime;
        waitTimes.push(waitTime);

        // Simulate work
        await sleep(40);

        await lease.release();
      });

      await Promise.all(promises);

      const overallDuration = Date.now() - overallStart;

      // Calculate metrics
      waitTimes.sort((a, b) => a - b);
      const p50 = percentile(waitTimes, 50);
      const p90 = percentile(waitTimes, 90);
      const p95 = percentile(waitTimes, 95);
      const p99 = percentile(waitTimes, 99);
      const avg = waitTimes.reduce((sum, t) => sum + t, 0) / waitTimes.length;
      const max = Math.max(...waitTimes);
      const throughput = (numRequests / overallDuration) * 1000;

      console.log('\n📊 Heavy Load (100 concurrent requests):');
      console.log(`  Average wait time: ${avg.toFixed(2)}ms`);
      console.log(`  P50 wait time: ${p50}ms`);
      console.log(`  P90 wait time: ${p90}ms`);
      console.log(`  P95 wait time: ${p95}ms`);
      console.log(`  P99 wait time: ${p99}ms`);
      console.log(`  Max wait time: ${max}ms`);
      console.log(`  Overall duration: ${overallDuration}ms`);
      console.log(`  Throughput: ${throughput.toFixed(2)} req/s`);

      // Assertions - with pool size 10, significant queueing expected
      expect(p99).toBeLessThan(2000); // Should complete within 2s even under heavy load
      expect(waitTimes.every((t) => t >= 0)).toBe(true);
      expect(throughput).toBeGreaterThan(0);
    });
  });

  describe('Pool Metrics Accuracy', () => {
    it('should accurately track p99WaitTime in pool metrics', async () => {
      const provider = 'claude-code';
      const numRequests = 30;

      // Generate load
      const promises = Array.from({ length: numRequests }, async (_, i) => {
        const lease = await terminalPool.acquireLease(provider, `barista-${i}`);
        await sleep(25);
        await lease.release();
      });

      await Promise.all(promises);

      // Check pool metrics
      const metrics = terminalPool.getMetrics();
      const providerMetrics = metrics.providers[provider];

      console.log('\n📊 Pool Metrics:');
      console.log(`  Total terminals: ${providerMetrics.totalTerminals}`);
      console.log(`  Idle terminals: ${providerMetrics.idleTerminals}`);
      console.log(`  Busy terminals: ${providerMetrics.busyTerminals}`);
      console.log(`  Crashed terminals: ${providerMetrics.crashedTerminals}`);
      console.log(`  Active leases: ${providerMetrics.activeLeases}`);
      console.log(`  P99 wait time: ${providerMetrics.p99WaitTime}ms`);

      // Assertions
      expect(providerMetrics.totalTerminals).toBeGreaterThanOrEqual(10); // At least pool size
      expect(providerMetrics.activeLeases).toBe(0); // All released
      expect(providerMetrics.p99WaitTime).toBeGreaterThanOrEqual(0);
      expect(providerMetrics.idleTerminals + providerMetrics.busyTerminals).toBeLessThanOrEqual(
        providerMetrics.totalTerminals
      );
      // Most terminals should be idle after all requests complete
      expect(providerMetrics.idleTerminals).toBeGreaterThan(0);
    });
  });

  describe('Burst Traffic Handling', () => {
    it('should handle burst of requests followed by quiet period', async () => {
      const provider = 'claude-code';

      // Burst 1: 20 requests
      console.log('\n🚀 Burst 1: 20 concurrent requests');
      const burst1Start = Date.now();
      const burst1 = Array.from({ length: 20 }, async (_, i) => {
        const lease = await terminalPool.acquireLease(provider, `burst1-${i}`);
        await sleep(30);
        await lease.release();
      });
      await Promise.all(burst1);
      const burst1Duration = Date.now() - burst1Start;
      console.log(`  Duration: ${burst1Duration}ms`);

      // Quiet period
      await sleep(100);

      // Burst 2: 20 requests
      console.log('\n🚀 Burst 2: 20 concurrent requests');
      const burst2Start = Date.now();
      const burst2 = Array.from({ length: 20 }, async (_, i) => {
        const lease = await terminalPool.acquireLease(provider, `burst2-${i}`);
        await sleep(30);
        await lease.release();
      });
      await Promise.all(burst2);
      const burst2Duration = Date.now() - burst2Start;
      console.log(`  Duration: ${burst2Duration}ms`);

      // Both bursts should complete successfully
      expect(burst1Duration).toBeGreaterThan(0);
      expect(burst2Duration).toBeGreaterThan(0);

      // Check metrics
      const metrics = terminalPool.getMetrics();
      console.log(`\n📊 Final P99: ${metrics.providers[provider].p99WaitTime}ms`);
      expect(metrics.providers[provider].p99WaitTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Sustained Load Test', () => {
    it('should maintain performance under sustained load', async () => {
      const provider = 'claude-code';
      const duration = 2000; // 2 seconds of sustained load
      const requestInterval = 20; // New request every 20ms
      const startTime = Date.now();
      const completedRequests: number[] = [];

      let requestId = 0;

      // Generate sustained load
      while (Date.now() - startTime < duration) {
        const id = requestId++;
        const reqStart = Date.now();

        // Fire and forget (don't await individual requests)
        terminalPool
          .acquireLease(provider, `sustained-${id}`)
          .then(async (lease) => {
            await sleep(15); // Short work
            await lease.release();
            completedRequests.push(Date.now() - reqStart);
          })
          .catch((err) => {
            console.error(`Request ${id} failed:`, err.message);
          });

        await sleep(requestInterval);
      }

      // Wait for all in-flight requests to complete
      await sleep(500);

      // Calculate metrics
      const successRate = (completedRequests.length / requestId) * 100;
      completedRequests.sort((a, b) => a - b);
      const p99 = percentile(completedRequests, 99);

      console.log('\n📊 Sustained Load Results:');
      console.log(`  Total requests initiated: ${requestId}`);
      console.log(`  Completed requests: ${completedRequests.length}`);
      console.log(`  Success rate: ${successRate.toFixed(2)}%`);
      console.log(`  P99 response time: ${p99}ms`);

      // Assertions
      expect(successRate).toBeGreaterThan(80); // At least 80% success rate
      expect(p99).toBeLessThan(1000); // P99 under 1 second
    });
  });
});
