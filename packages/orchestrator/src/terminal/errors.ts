/**
 * Terminal Pool Error Types
 * Custom error classes for Terminal Pool operations
 */

import { ProviderType } from '@codecafe/core';

/**
 * Base class for all Terminal Pool errors
 */
export class TerminalPoolError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'TerminalPoolError';
    Object.setPrototypeOf(this, TerminalPoolError.prototype);
  }
}

/**
 * Error thrown when provider configuration is not found
 */
export class ProviderNotFoundError extends TerminalPoolError {
  constructor(public readonly provider: ProviderType) {
    super(`No configuration for provider: ${provider}`, 'PROVIDER_NOT_FOUND');
    this.name = 'ProviderNotFoundError';
    Object.setPrototypeOf(this, ProviderNotFoundError.prototype);
  }
}

/**
 * Error thrown when provider adapter is not registered
 */
export class AdapterNotFoundError extends TerminalPoolError {
  constructor(public readonly provider: ProviderType) {
    super(`No adapter registered for provider: ${provider}`, 'ADAPTER_NOT_FOUND');
    this.name = 'AdapterNotFoundError';
    Object.setPrototypeOf(this, AdapterNotFoundError.prototype);
  }
}

/**
 * Error thrown when provider spawn fails
 */
export class ProviderSpawnError extends TerminalPoolError {
  constructor(
    public readonly provider: ProviderType,
    public readonly originalError: Error
  ) {
    super(
      `Failed to spawn ${provider}: ${originalError.message}`,
      'PROVIDER_SPAWN_FAILED'
    );
    this.name = 'ProviderSpawnError';
    Object.setPrototypeOf(this, ProviderSpawnError.prototype);
  }
}

/**
 * Error thrown when process kill fails
 */
export class ProviderKillError extends TerminalPoolError {
  constructor(
    public readonly provider: ProviderType,
    public readonly terminalId: string,
    public readonly originalError: Error
  ) {
    super(
      `Failed to kill ${provider} terminal ${terminalId}: ${originalError.message}`,
      'PROVIDER_KILL_FAILED'
    );
    this.name = 'ProviderKillError';
    Object.setPrototypeOf(this, ProviderKillError.prototype);
  }
}

/**
 * Error thrown when lease acquisition times out
 */
export class LeaseTimeoutError extends TerminalPoolError {
  constructor(
    public readonly provider: ProviderType,
    public readonly baristaId: string,
    public readonly timeout: number
  ) {
    super(
      `Lease acquisition timeout for ${provider} (barista: ${baristaId}, timeout: ${timeout}ms)`,
      'LEASE_TIMEOUT'
    );
    this.name = 'LeaseTimeoutError';
    Object.setPrototypeOf(this, LeaseTimeoutError.prototype);
  }
}

/**
 * Error thrown when lease is not found
 */
export class LeaseNotFoundError extends TerminalPoolError {
  constructor(public readonly leaseId: string) {
    super(`Lease not found: ${leaseId}`, 'LEASE_NOT_FOUND');
    this.name = 'LeaseNotFoundError';
    Object.setPrototypeOf(this, LeaseNotFoundError.prototype);
  }
}

/**
 * Error thrown when terminal is not found
 */
export class TerminalNotFoundError extends TerminalPoolError {
  constructor(public readonly terminalId: string) {
    super(`Terminal not found: ${terminalId}`, 'TERMINAL_NOT_FOUND');
    this.name = 'TerminalNotFoundError';
    Object.setPrototypeOf(this, TerminalNotFoundError.prototype);
  }
}

/**
 * Error thrown when semaphore is not found (internal error)
 */
export class SemaphoreNotFoundError extends TerminalPoolError {
  constructor(public readonly provider: ProviderType) {
    super(`No semaphore for provider: ${provider}`, 'SEMAPHORE_NOT_FOUND');
    this.name = 'SemaphoreNotFoundError';
    Object.setPrototypeOf(this, SemaphoreNotFoundError.prototype);
  }
}

/**
 * Error thrown when lease has expired
 */
export class LeaseExpiredError extends TerminalPoolError {
  constructor(
    public readonly leaseId: string,
    public readonly expiresAt: Date
  ) {
    super(
      `Lease ${leaseId} expired at ${expiresAt.toISOString()}`,
      'LEASE_EXPIRED'
    );
    this.name = 'LeaseExpiredError';
    Object.setPrototypeOf(this, LeaseExpiredError.prototype);
  }
}
