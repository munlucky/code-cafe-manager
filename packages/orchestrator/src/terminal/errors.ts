import { ProviderType } from '@codecafe/core';

export class TerminalPoolError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ProviderNotFoundError extends TerminalPoolError {
  constructor(public readonly provider: ProviderType) {
    super(`No configuration for provider: ${provider}`, 'PROVIDER_NOT_FOUND');
  }
}

export class AdapterNotFoundError extends TerminalPoolError {
  constructor(public readonly provider: ProviderType) {
    super(`No adapter registered for provider: ${provider}`, 'ADAPTER_NOT_FOUND');
  }
}

export class ProviderSpawnError extends TerminalPoolError {
  constructor(
    public readonly provider: ProviderType,
    public readonly originalError: Error
  ) {
    super(
      `Failed to spawn ${provider}: ${originalError.message}`,
      'PROVIDER_SPAWN_FAILED'
    );
  }
}

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
  }
}

export class TerminalLeaseTimeoutError extends TerminalPoolError {
  constructor(
    public readonly provider: ProviderType,
    public readonly timeoutMs: number
  ) {
    super(
      `Terminal lease timeout for ${provider} after ${timeoutMs}ms`,
      'TERMINAL_LEASE_TIMEOUT'
    );
  }
}

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
  }
}

export class LeaseNotFoundError extends TerminalPoolError {
  constructor(public readonly leaseId: string) {
    super(`Lease not found: ${leaseId}`, 'LEASE_NOT_FOUND');
  }
}

export class TerminalNotFoundError extends TerminalPoolError {
  constructor(public readonly terminalId: string) {
    super(`Terminal not found: ${terminalId}`, 'TERMINAL_NOT_FOUND');
  }
}

export class SemaphoreNotFoundError extends TerminalPoolError {
  constructor(public readonly provider: ProviderType) {
    super(`No semaphore for provider: ${provider}`, 'SEMAPHORE_NOT_FOUND');
  }
}

export class LeaseExpiredError extends TerminalPoolError {
  constructor(
    public readonly leaseId: string,
    public readonly expiresAt: Date
  ) {
    super(
      `Lease ${leaseId} expired at ${expiresAt.toISOString()}`,
      'LEASE_EXPIRED'
    );
  }
}
