/**
 * Specific error classes for @codecafe/core
 * Concrete implementations of CodeCafeError for different error categories
 */

import { CodeCafeError } from './base-error.js';
import { ErrorCode, ErrorMessages } from './error-codes.js';

/**
 * Options for creating specific errors
 */
interface ErrorOptions {
  message?: string;
  details?: unknown;
  cause?: Error;
}

/**
 * Provider error - failures from external AI/LLM providers
 * Examples: API timeouts, rate limits, authentication failures
 */
export class ProviderError extends CodeCafeError {
  readonly code: ErrorCode;
  readonly isRetryable: boolean;

  constructor(
    code: ErrorCode = ErrorCode.PROVIDER_ERROR,
    options?: ErrorOptions
  ) {
    const message = options?.message ?? ErrorMessages[code];
    super(message, { details: options?.details, cause: options?.cause });
    this.code = code;
    this.isRetryable = this.determineRetryable(code);
  }

  private determineRetryable(code: ErrorCode): boolean {
    const retryableCodes = [
      ErrorCode.PROVIDER_TIMEOUT,
      ErrorCode.PROVIDER_RATE_LIMIT,
      ErrorCode.PROVIDER_UNAVAILABLE,
    ];
    return retryableCodes.includes(code);
  }
}

/**
 * Worktree error - failures in git worktree operations
 * Examples: creation failures, deletion failures, worktree not found
 */
export class WorktreeError extends CodeCafeError {
  readonly code: ErrorCode;
  readonly isRetryable: boolean;

  /**
   * Path to the worktree (if applicable)
   */
  readonly worktreePath?: string;

  constructor(
    code: ErrorCode = ErrorCode.WORKTREE_ERROR,
    options?: ErrorOptions & { worktreePath?: string }
  ) {
    const message = options?.message ?? ErrorMessages[code];
    super(message, { details: options?.details, cause: options?.cause });
    this.code = code;
    this.worktreePath = options?.worktreePath;
    this.isRetryable = false;
  }
}

/**
 * Execution error - failures in command/process execution
 * Examples: command failures, timeouts, cancellations
 */
export class ExecutionError extends CodeCafeError {
  readonly code: ErrorCode;
  readonly isRetryable: boolean;

  /**
   * Exit code from the failed command (if applicable)
   */
  readonly exitCode?: number;

  /**
   * Command that was executed
   */
  readonly command?: string;

  constructor(
    code: ErrorCode = ErrorCode.EXECUTION_ERROR,
    options?: ErrorOptions & { exitCode?: number; command?: string }
  ) {
    const message = options?.message ?? ErrorMessages[code];
    super(message, { details: options?.details, cause: options?.cause });
    this.code = code;
    this.exitCode = options?.exitCode;
    this.command = options?.command;
    this.isRetryable = code === ErrorCode.EXECUTION_TIMEOUT;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      exitCode: this.exitCode,
      command: this.command,
    };
  }
}

/**
 * Validation error - failures in input/data validation
 * Examples: schema validation failures, missing required fields
 */
export class ValidationError extends CodeCafeError {
  readonly code: ErrorCode;
  readonly isRetryable = false as const;

  /**
   * Field that failed validation (if applicable)
   */
  readonly field?: string;

  /**
   * Validation errors keyed by field name
   */
  readonly errors?: Record<string, string[]>;

  constructor(
    code: ErrorCode = ErrorCode.VALIDATION_ERROR,
    options?: ErrorOptions & { field?: string; errors?: Record<string, string[]> }
  ) {
    const message = options?.message ?? ErrorMessages[code];
    super(message, { details: options?.details, cause: options?.cause });
    this.code = code;
    this.field = options?.field;
    this.errors = options?.errors;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      field: this.field,
      errors: this.errors,
    };
  }
}

/**
 * IPC error - failures in inter-process communication
 * Examples: channel not found, timeout, message delivery failures
 */
export class IpcError extends CodeCafeError {
  readonly code: ErrorCode;
  readonly isRetryable: boolean;

  /**
   * IPC channel name (if applicable)
   */
  readonly channel?: string;

  constructor(
    code: ErrorCode = ErrorCode.IPC_ERROR,
    options?: ErrorOptions & { channel?: string }
  ) {
    const message = options?.message ?? ErrorMessages[code];
    super(message, { details: options?.details, cause: options?.cause });
    this.code = code;
    this.channel = options?.channel;
    this.isRetryable = code === ErrorCode.IPC_TIMEOUT;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      channel: this.channel,
    };
  }
}

/**
 * Unknown error - wrapper for unexpected errors
 * Used when catching unknown errors that need to be converted to CodeCafeError
 */
export class UnknownError extends CodeCafeError {
  readonly code = ErrorCode.UNKNOWN_ERROR as const;
  readonly isRetryable = false as const;

  constructor(options?: ErrorOptions) {
    const message = options?.message ?? ErrorMessages[ErrorCode.UNKNOWN_ERROR];
    super(message, { details: options?.details, cause: options?.cause });
  }
}
