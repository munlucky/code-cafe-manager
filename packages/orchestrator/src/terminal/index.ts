/**
 * Terminal module exports
 */

export { TerminalLease, TerminalPool } from './terminal-pool.js';
export { LeaseRequest, PoolSemaphore } from './pool-semaphore.js';
export { IPty, IProviderAdapter, MockProviderAdapter, ProviderAdapterFactory } from './provider-adapter.js';
export { ClaudeCodeAdapter } from './adapters/claude-code-adapter.js';
export { CodexAdapter } from './adapters/codex-adapter.js';
export {
  TerminalPoolError,
  ProviderNotFoundError,
  AdapterNotFoundError,
  ProviderSpawnError,
  ProviderKillError,
  TerminalLeaseTimeoutError,
  LeaseTimeoutError,
  LeaseNotFoundError,
  TerminalNotFoundError,
  SemaphoreNotFoundError,
  LeaseExpiredError,
} from './errors.js';
