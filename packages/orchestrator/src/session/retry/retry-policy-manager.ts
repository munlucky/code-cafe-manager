/**
 * Retry Policy Manager - Manages retry counters across multiple operations
 *
 * Replaces individual retry tracking in:
 * - stage-orchestrator.ts:53 (retryCount Map)
 * - stage-coordinator.ts (inline retry counters)
 */

import type { RetryPolicy } from './retry-policy';

/**
 * Retry state for a single operation
 */
export interface RetryState {
  /** Number of retry attempts made */
  attemptCount: number;

  /** Timestamp of last retry attempt */
  lastAttemptAt: number;

  /** Next retry time (for scheduled retries) */
  nextRetryAt?: number;
}

/**
 * Retry policy manager
 *
 * Tracks retry counts for multiple operations and provides
 * centralized retry decision logic using a configured policy.
 */
export class RetryPolicyManager {
  private readonly counters = new Map<string, RetryState>();
  private readonly policy: RetryPolicy;

  constructor(policy: RetryPolicy) {
    this.policy = policy;
  }

  /**
   * Increment retry counter for a key
   * @param key Unique identifier for the operation (e.g., stage ID)
   * @returns New attempt count
   */
  increment(key: string): number {
    const current = this.getCount(key);
    const newState: RetryState = {
      attemptCount: current + 1,
      lastAttemptAt: Date.now(),
    };
    this.counters.set(key, newState);
    return newState.attemptCount;
  }

  /**
   * Reset retry counter for a key
   * @param key Unique identifier for the operation
   */
  reset(key: string): void {
    this.counters.delete(key);
  }

  /**
   * Reset all retry counters
   */
  resetAll(): void {
    this.counters.clear();
  }

  /**
   * Get current retry count for a key
   * @param key Unique identifier for the operation
   * @returns Current attempt count (0 if no attempts made)
   */
  getCount(key: string): number {
    return this.counters.get(key)?.attemptCount ?? 0;
  }

  /**
   * Get full retry state for a key
   * @param key Unique identifier for the operation
   * @returns Retry state or undefined if not found
   */
  getState(key: string): RetryState | undefined {
    return this.counters.get(key);
  }

  /**
   * Check if operation should be retried
   * @param key Unique identifier for the operation
   * @param error Error that triggered the retry
   * @returns true if retry should be attempted
   */
  shouldRetry(key: string, error: Error): boolean {
    const attemptCount = this.getCount(key) + 1; // Next attempt count
    return this.policy.shouldRetry(attemptCount, error);
  }

  /**
   * Get delay before next retry
   * @param key Unique identifier for the operation
   * @returns Delay in milliseconds
   */
  getDelay(key: string): number {
    const attemptCount = this.getCount(key) + 1; // Next attempt count
    return this.policy.getDelay(attemptCount);
  }

  /**
   * Increment and check if should retry (atomic operation)
   * @param key Unique identifier for the operation
   * @param error Error that triggered the retry
   * @returns Object with attempt count and should retry flag
   */
  incrementAndCheck(key: string, error: Error): { attemptCount: number; shouldRetry: boolean } {
    const attemptCount = this.increment(key);
    const shouldRetry = this.policy.shouldRetry(attemptCount, error);
    return { attemptCount, shouldRetry };
  }

  /**
   * Get maximum retries from policy
   */
  getMaxRetries(): number {
    return this.policy.getMaxRetries();
  }

  /**
   * Get number of tracked operations
   */
  getTrackedCount(): number {
    return this.counters.size;
  }

  /**
   * Get all tracked keys
   */
  getTrackedKeys(): string[] {
    return Array.from(this.counters.keys());
  }
}

/**
 * Create retry policy manager with default exponential backoff policy
 */
export function createRetryPolicyManager(config?: {
  maxRetries?: number;
  baseDelayMs?: number;
}): RetryPolicyManager {
  const policy = new (require('./retry-policy').ExponentialBackoffPolicy)(config);
  return new RetryPolicyManager(policy);
}
