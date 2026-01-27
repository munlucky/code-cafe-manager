/**
 * Error codes for @codecafe/core
 * Centralized error code definitions for consistent error handling
 */

/**
 * Error code enum for programmatic error identification
 * Format: CATEGORY_SPECIFIC_ERROR
 */
export enum ErrorCode {
  // Provider errors (external service failures)
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  PROVIDER_TIMEOUT = 'PROVIDER_TIMEOUT',
  PROVIDER_RATE_LIMIT = 'PROVIDER_RATE_LIMIT',
  PROVIDER_AUTH_FAILED = 'PROVIDER_AUTH_FAILED',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',

  // Worktree errors (git worktree operations)
  WORKTREE_ERROR = 'WORKTREE_ERROR',
  WORKTREE_CREATE_FAILED = 'WORKTREE_CREATE_FAILED',
  WORKTREE_DELETE_FAILED = 'WORKTREE_DELETE_FAILED',
  WORKTREE_NOT_FOUND = 'WORKTREE_NOT_FOUND',

  // Execution errors (command/process execution)
  EXECUTION_ERROR = 'EXECUTION_ERROR',
  EXECUTION_TIMEOUT = 'EXECUTION_TIMEOUT',
  EXECUTION_CANCELLED = 'EXECUTION_CANCELLED',

  // Validation errors (input/data validation)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  VALIDATION_SCHEMA_ERROR = 'VALIDATION_SCHEMA_ERROR',
  VALIDATION_REQUIRED_FIELD = 'VALIDATION_REQUIRED_FIELD',

  // IPC errors (inter-process communication)
  IPC_ERROR = 'IPC_ERROR',
  IPC_TIMEOUT = 'IPC_TIMEOUT',
  IPC_CHANNEL_NOT_FOUND = 'IPC_CHANNEL_NOT_FOUND',

  // Unknown/generic errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Map of error codes to their default messages
 */
export const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCode.PROVIDER_ERROR]: 'Provider operation failed',
  [ErrorCode.PROVIDER_TIMEOUT]: 'Provider request timed out',
  [ErrorCode.PROVIDER_RATE_LIMIT]: 'Provider rate limit exceeded',
  [ErrorCode.PROVIDER_AUTH_FAILED]: 'Provider authentication failed',
  [ErrorCode.PROVIDER_UNAVAILABLE]: 'Provider is unavailable',

  [ErrorCode.WORKTREE_ERROR]: 'Worktree operation failed',
  [ErrorCode.WORKTREE_CREATE_FAILED]: 'Failed to create worktree',
  [ErrorCode.WORKTREE_DELETE_FAILED]: 'Failed to delete worktree',
  [ErrorCode.WORKTREE_NOT_FOUND]: 'Worktree not found',

  [ErrorCode.EXECUTION_ERROR]: 'Command execution failed',
  [ErrorCode.EXECUTION_TIMEOUT]: 'Command execution timed out',
  [ErrorCode.EXECUTION_CANCELLED]: 'Command execution was cancelled',

  [ErrorCode.VALIDATION_ERROR]: 'Validation failed',
  [ErrorCode.VALIDATION_SCHEMA_ERROR]: 'Schema validation failed',
  [ErrorCode.VALIDATION_REQUIRED_FIELD]: 'Required field is missing',

  [ErrorCode.IPC_ERROR]: 'IPC communication failed',
  [ErrorCode.IPC_TIMEOUT]: 'IPC request timed out',
  [ErrorCode.IPC_CHANNEL_NOT_FOUND]: 'IPC channel not found',

  [ErrorCode.UNKNOWN_ERROR]: 'An unknown error occurred',
};
