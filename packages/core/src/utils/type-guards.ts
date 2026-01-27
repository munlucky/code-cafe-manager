/**
 * Type guards for error handling in @codecafe/core
 * Provides type-safe error checking and conversion utilities
 */

import { CodeCafeError } from '../errors/base-error.js';
import { UnknownError } from '../errors/specific-errors.js';

/**
 * Type guard to check if a value is a CodeCafeError
 *
 * @param error - The value to check
 * @returns True if the value is a CodeCafeError instance
 *
 * @example
 * ```typescript
 * try {
 *   await someOperation();
 * } catch (error) {
 *   if (isCodeCafeError(error)) {
 *     // error is typed as CodeCafeError
 *     console.log(error.code, error.isRetryable);
 *   }
 * }
 * ```
 */
export function isCodeCafeError(error: unknown): error is CodeCafeError {
  return error instanceof CodeCafeError;
}

/**
 * Type guard to check if a value is a standard Error
 *
 * @param value - The value to check
 * @returns True if the value is an Error instance
 *
 * @example
 * ```typescript
 * try {
 *   await someOperation();
 * } catch (error) {
 *   if (isError(error)) {
 *     // error is typed as Error
 *     console.log(error.message, error.stack);
 *   }
 * }
 * ```
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Type guard to check if a value is an error-like object
 * Useful for checking objects that have error-like properties but aren't Error instances
 *
 * @param value - The value to check
 * @returns True if the value has message and optionally name properties
 */
export function isErrorLike(value: unknown): value is { message: string; name?: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as Record<string, unknown>).message === 'string'
  );
}

/**
 * Convert any caught value to a CodeCafeError
 * Use this in catch blocks to ensure type-safe error handling
 *
 * @param error - The caught value (could be anything)
 * @returns A CodeCafeError instance
 *
 * @example
 * ```typescript
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   const codeCafeError = toCodeCafeError(error);
 *   // Now you have a properly typed error
 *   logger.error('Operation failed', {
 *     code: codeCafeError.code,
 *     isRetryable: codeCafeError.isRetryable,
 *   });
 * }
 * ```
 */
export function toCodeCafeError(error: unknown): CodeCafeError {
  // Already a CodeCafeError - return as-is
  if (isCodeCafeError(error)) {
    return error;
  }

  // Standard Error - wrap in UnknownError
  if (isError(error)) {
    return new UnknownError({
      message: error.message,
      cause: error,
    });
  }

  // Error-like object - extract message
  if (isErrorLike(error)) {
    return new UnknownError({
      message: error.message,
      details: error,
    });
  }

  // String - use as message
  if (typeof error === 'string') {
    return new UnknownError({
      message: error,
    });
  }

  // Unknown type - stringify for details
  return new UnknownError({
    message: 'An unknown error occurred',
    details: error,
  });
}

/**
 * Extract error message from any caught value
 * Useful when you just need the message string
 *
 * @param error - The caught value
 * @returns The error message string
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }

  if (isErrorLike(error)) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unknown error occurred';
}

/**
 * Check if an error is retryable
 * Returns false for non-CodeCafeError values
 *
 * @param error - The error to check
 * @returns True if the error is a retryable CodeCafeError
 */
export function isRetryableError(error: unknown): boolean {
  if (isCodeCafeError(error)) {
    return error.isRetryable;
  }
  return false;
}
