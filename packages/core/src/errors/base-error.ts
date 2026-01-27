/**
 * Base error class for @codecafe/core
 * Provides structured error handling with codes, retry flags, and details
 */

/**
 * Abstract base class for all CodeCafe errors
 * All custom errors in the application should extend this class
 */
export abstract class CodeCafeError extends Error {
  /**
   * Unique error code for programmatic error handling
   */
  abstract readonly code: string;

  /**
   * Indicates whether the operation that caused this error can be retried
   */
  abstract readonly isRetryable: boolean;

  /**
   * Timestamp when the error occurred
   */
  readonly timestamp: Date;

  /**
   * Additional error details for debugging
   */
  readonly details?: unknown;

  /**
   * Original error that caused this error (if any)
   */
  readonly cause?: Error;

  constructor(message: string, options?: { details?: unknown; cause?: Error }) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.details = options?.details;
    this.cause = options?.cause;

    // Maintain proper stack trace for where the error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to a plain object for serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      isRetryable: this.isRetryable,
      timestamp: this.timestamp.toISOString(),
      details: this.details,
      cause: this.cause?.message,
      stack: this.stack,
    };
  }
}
