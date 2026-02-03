/**
 * Retry Policy - Centralized retry logic configuration
 *
 * Replaces scattered MAX_RETRIES constants across:
 * - stage-orchestrator.ts:53 (retryCount Map)
 * - stage-coordinator.ts:92 (MAX_RETRIES = 3)
 * - stage-coordinator.ts:273 (separate retry constant)
 */

/**
 * Retry policy interface
 */
export interface RetryPolicy {
  /**
   * Determine if a retry should be attempted
   * @param attemptCount Current attempt number (1-indexed)
   * @param error Error that triggered the retry
   * @returns true if retry should be attempted
   */
  shouldRetry(attemptCount: number, error: Error): boolean;

  /**
   * Get delay before next retry in milliseconds
   * @param attemptCount Current attempt number (1-indexed)
   * @returns Delay in milliseconds
   */
  getDelay(attemptCount: number): number;

  /**
   * Get maximum number of retries allowed
   */
  getMaxRetries(): number;
}

/**
 * Default retry policy configuration
 */
export interface RetryPolicyConfig {
  /** Maximum number of retry attempts */
  maxRetries?: number;

  /** Base delay in milliseconds for exponential backoff */
  baseDelayMs?: number;

  /** Maximum delay in milliseconds */
  maxDelayMs?: number;

  /** Enable jitter to prevent thundering herd */
  enableJitter?: boolean;

  /** Custom error classifier for determining if an error is retryable */
  isRetryable?: (error: Error) => boolean;
}

/**
 * Exponential backoff retry policy with jitter
 *
 * Implements exponential backoff with optional jitter to prevent
 * thundering herd problem when multiple operations fail simultaneously.
 *
 * Delay formula: min(baseDelay * 2^(attempt-1) + jitter, maxDelay)
 */
export class ExponentialBackoffPolicy implements RetryPolicy {
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly enableJitter: boolean;
  private readonly isRetryable: (error: Error) => boolean;

  constructor(config: RetryPolicyConfig = {}) {
    this.maxRetries = config.maxRetries ?? 3;
    this.baseDelayMs = config.baseDelayMs ?? 1000;
    this.maxDelayMs = config.maxDelayMs ?? 30000; // 30 seconds max
    this.enableJitter = config.enableJitter ?? true;
    this.isRetryable = config.isRetryable ?? this.defaultIsRetryable;
  }

  /**
   * Check if operation should be retried
   */
  shouldRetry(attemptCount: number, error: Error): boolean {
    if (attemptCount > this.maxRetries) {
      return false;
    }
    return this.isRetryable(error);
  }

  /**
   * Calculate delay before next retry
   */
  getDelay(attemptCount: number): number {
    // Exponential backoff: baseDelay * 2^(attempt-1)
    const exponentialDelay = this.baseDelayMs * Math.pow(2, attemptCount - 1);

    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, this.maxDelayMs);

    // Add jitter if enabled (±25% random variation)
    if (this.enableJitter) {
      const jitterFactor = 0.5 + Math.random(); // 0.5 to 1.5
      return Math.floor(cappedDelay * jitterFactor);
    }

    return cappedDelay;
  }

  /**
   * Get maximum retry count
   */
  getMaxRetries(): number {
    return this.maxRetries;
  }

  /**
   * Default error retryability check
   * Transient errors are retryable, permanent errors are not
   */
  private defaultIsRetryable(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Retryable transient errors
    const retryablePatterns = [
      'timeout',
      'network',
      'connection',
      'temporary',
      'temporarily',
      'etimedout',
      'econnreset',
      'econnrefused',
      'enotfound',
      'eai_again',
    ];

    // Non-retryable permanent errors
    const nonRetryablePatterns = [
      'permission denied',
      'not found',
      'invalid',
      'authentication',
      'authorization',
      'syntax error',
      'type error',
    ];

    // Check non-retryable patterns first
    if (nonRetryablePatterns.some(pattern => message.includes(pattern))) {
      return false;
    }

    // Check retryable patterns
    return retryablePatterns.some(pattern => message.includes(pattern));
  }
}

/**
 * Fixed delay retry policy (no exponential backoff)
 *
 * Useful for scenarios where consistent delay is preferred
 */
export class FixedDelayPolicy implements RetryPolicy {
  private readonly maxRetries: number;
  private readonly delayMs: number;
  private readonly isRetryable: (error: Error) => boolean;

  constructor(config: { maxRetries?: number; delayMs?: number; isRetryable?: (error: Error) => boolean } = {}) {
    this.maxRetries = config.maxRetries ?? 3;
    this.delayMs = config.delayMs ?? 1000;
    this.isRetryable = config.isRetryable ?? (() => true);
  }

  shouldRetry(attemptCount: number, error: Error): boolean {
    return attemptCount <= this.maxRetries && this.isRetryable(error);
  }

  getDelay(): number {
    return this.delayMs;
  }

  getMaxRetries(): number {
    return this.maxRetries;
  }
}

/**
 * No retry policy - fail immediately
 */
export class NoRetryPolicy implements RetryPolicy {
  shouldRetry(): boolean {
    return false;
  }

  getDelay(): number {
    return 0;
  }

  getMaxRetries(): number {
    return 0;
  }
}

/**
 * Create default retry policy for orchestration
 */
export function createDefaultRetryPolicy(): RetryPolicy {
  return new ExponentialBackoffPolicy({
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
  });
}
