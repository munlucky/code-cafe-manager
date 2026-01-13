/**
 * Terminal Pool Implementation
 * Gap 2 해결: Enhanced concurrency model with proper lease management
 */

import { ProviderType } from '@codecafe/core';
import {
  Terminal,
  TerminalPoolConfig,
  ProviderTerminalConfig,
  PoolStatus,
  LeaseToken,
  PoolMetrics
} from '@codecafe/core';
import { PoolSemaphore, TerminalLeaseTimeoutError } from './pool-semaphore';
import { IProviderAdapter, ProviderAdapterFactory } from './provider-adapter';
import {
  ProviderNotFoundError,
  SemaphoreNotFoundError,
  LeaseNotFoundError,
  TerminalNotFoundError,
} from './errors';

export interface TerminalLease {
  terminal: Terminal;
  token: LeaseToken;
  release: () => Promise<void>;
}

export class TerminalPool {
  private terminals: Map<string, Terminal> = new Map();
  private semaphores: Map<ProviderType, PoolSemaphore> = new Map();
  private config: TerminalPoolConfig;
  private activeLeases: Map<string, LeaseToken> = new Map();
  private metrics: PoolMetrics = { providers: {} };

  constructor(config: TerminalPoolConfig) {
    this.config = config;
    this.initializeSemaphores();

    // Initialize provider adapters (registers real adapters)
    // In test environment, MockProviderAdapter will be used via Factory.create()
    if (process.env.NODE_ENV !== 'test') {
      ProviderAdapterFactory.initialize();
    }
  }

  /**
   * Initialize semaphores for each provider
   */
  private initializeSemaphores(): void {
    for (const [provider, providerConfig] of Object.entries(this.config.perProvider)) {
      const semaphore = new PoolSemaphore(providerConfig.size);
      this.semaphores.set(provider as ProviderType, semaphore);

      // Initialize metrics
      this.metrics.providers[provider] = {
        totalTerminals: 0,
        idleTerminals: 0,
        busyTerminals: 0,
        crashedTerminals: 0,
        activeLeases: 0,
        p99WaitTime: 0,
      };
    }
  }

  /**
   * Acquire a terminal lease
   */
  async acquireLease(
    provider: ProviderType,
    baristaId: string,
    timeoutMs?: number
  ): Promise<TerminalLease> {
    const providerConfig = this.config.perProvider[provider];
    if (!providerConfig) {
      throw new ProviderNotFoundError(provider);
    }

    const timeout = timeoutMs || providerConfig.timeout;
    const semaphore = this.semaphores.get(provider);
    if (!semaphore) {
      throw new SemaphoreNotFoundError(provider);
    }

    try {
      // Acquire terminal through semaphore
      const terminal = await semaphore.acquire(provider, timeout, async () => {
        return await this.getOrCreateTerminal(provider);
      });

      // Create lease token
      const leaseToken: LeaseToken = {
        id: `lease-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        terminalId: terminal.id,
        baristaId,
        provider,
        leasedAt: new Date(),
        expiresAt: new Date(Date.now() + timeout),
        released: false,
      };

      // Update terminal status
      terminal.status = 'busy';
      terminal.currentBarista = baristaId;
      terminal.leaseToken = leaseToken;
      terminal.lastUsed = new Date();

      // Track active lease
      this.activeLeases.set(leaseToken.id, leaseToken);
      this.updateMetrics();

      return {
        terminal,
        token: leaseToken,
        release: async () => {
          await this.releaseLease(leaseToken.id);
        },
      };
    } catch (error) {
      if (error instanceof TerminalLeaseTimeoutError) {
        // Update metrics for timeout
        this.metrics.providers[provider].p99WaitTime = Math.max(
          this.metrics.providers[provider].p99WaitTime,
          timeout
        );
      }
      throw error;
    }
  }

  /**
   * Release a terminal lease
   */
  async releaseLease(leaseId: string): Promise<void> {
    const leaseToken = this.activeLeases.get(leaseId);
    if (!leaseToken) {
      throw new LeaseNotFoundError(leaseId);
    }

    const terminal = this.terminals.get(leaseToken.terminalId);
    if (!terminal) {
      throw new TerminalNotFoundError(leaseToken.terminalId);
    }

    // Update lease token
    leaseToken.released = true;
    leaseToken.releasedAt = new Date();

    // Update terminal
    terminal.status = 'idle';
    terminal.currentBarista = undefined;
    terminal.leaseToken = undefined;
    terminal.lastUsed = new Date();

    // Release semaphore slot
    const semaphore = this.semaphores.get(leaseToken.provider);
    if (semaphore) {
      semaphore.release(terminal.id);
    }

    // Remove from active leases
    this.activeLeases.delete(leaseId);
    this.updateMetrics();
  }

  /**
   * Get pool status
   */
  getStatus(): PoolStatus {
    const status: PoolStatus = {};

    for (const [provider, providerConfig] of Object.entries(this.config.perProvider)) {
      const providerTerminals = Array.from(this.terminals.values())
        .filter(t => t.provider === provider);

      status[provider] = {
        total: providerTerminals.length,
        idle: providerTerminals.filter(t => t.status === 'idle').length,
        busy: providerTerminals.filter(t => t.status === 'busy').length,
        crashed: providerTerminals.filter(t => t.status === 'crashed').length,
      };
    }

    return status;
  }

  /**
   * Get pool metrics
   */
  getMetrics(): PoolMetrics {
    return { ...this.metrics };
  }

  /**
   * Clean up all resources
   */
  async dispose(): Promise<void> {
    // Release all semaphores
    for (const semaphore of this.semaphores.values()) {
      semaphore.dispose();
    }

    // Kill all terminal processes
    for (const terminal of this.terminals.values()) {
      if (terminal.process) {
        const adapter = ProviderAdapterFactory.get(terminal.provider);
        await adapter.kill(terminal.process);
      }
    }

    this.terminals.clear();
    this.semaphores.clear();
    this.activeLeases.clear();
  }

  private async getOrCreateTerminal(provider: ProviderType): Promise<Terminal> {
    // Try to find idle terminal
    const idleTerminal = Array.from(this.terminals.values())
      .find(t => t.provider === provider && t.status === 'idle');

    if (idleTerminal) {
      return idleTerminal;
    }

    // Create new terminal
    const adapter = ProviderAdapterFactory.get(provider);
    const process = await adapter.spawn();

    const terminal: Terminal = {
      id: `terminal-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      provider,
      process,
      status: 'idle',
      createdAt: new Date(),
      lastUsed: new Date(),
    };

    this.terminals.set(terminal.id, terminal);
    this.setupProcessHandlers(terminal);
    this.updateMetrics();

    return terminal;
  }

  /**
   * Setup process event handlers for crash recovery (Gap 5)
   */
  private setupProcessHandlers(terminal: Terminal): void {
    const adapter = ProviderAdapterFactory.get(terminal.provider);

    adapter.onExit(terminal.process, ({ exitCode }) => {
      console.log(`Terminal ${terminal.id} exited with code ${exitCode}`);

      if (exitCode !== 0) {
        terminal.status = 'crashed';
        this.updateMetrics();

        // If terminal had an active lease, attempt recovery
        if (terminal.leaseToken && !terminal.leaseToken.released) {
          this.handleCrashDuringLease(terminal).catch((error) => {
            console.error(`Crash recovery failed for terminal ${terminal.id}:`, error);
            this.releaseSemaphoreOnCrashFailure(terminal);
          });
        }
      } else {
        // Normal exit
        terminal.status = 'idle';
        terminal.currentBarista = undefined;
        terminal.leaseToken = undefined;
        this.updateMetrics();
      }
    });
  }

  /**
   * Handle crash during active lease (Gap 5)
   */
  private async handleCrashDuringLease(crashedTerminal: Terminal): Promise<void> {
    const provider = crashedTerminal.provider;
    const providerConfig = this.config.perProvider[provider];

    console.warn(`Attempting auto-restart for crashed terminal ${crashedTerminal.id}`);

    try {
      // Attempt restart (within maxRetries)
      for (let attempt = 0; attempt < providerConfig.maxRetries; attempt++) {
        try {
          const newTerminal = await this.getOrCreateTerminal(provider);

          // Transfer lease to new terminal
          if (crashedTerminal.leaseToken) {
            newTerminal.status = 'busy';
            newTerminal.currentBarista = crashedTerminal.leaseToken.baristaId;
            newTerminal.leaseToken = crashedTerminal.leaseToken;
            newTerminal.leaseToken.terminalId = newTerminal.id;
          }

          // Remove old terminal
          this.terminals.delete(crashedTerminal.id);
          this.updateMetrics();

          console.log(`Terminal ${crashedTerminal.id} restarted as ${newTerminal.id}`);
          return;
        } catch (spawnError) {
          console.error(`Restart attempt ${attempt + 1} failed:`, spawnError);
          if (attempt === providerConfig.maxRetries - 1) {
            throw spawnError;
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    } catch (error) {
      console.error(`All restart attempts failed for terminal ${crashedTerminal.id}`);
      throw error;
    }
  }

  /**
   * Release semaphore on crash recovery failure (Gap 5)
   */
  private releaseSemaphoreOnCrashFailure(terminal: Terminal): void {
    const semaphore = this.semaphores.get(terminal.provider);
    if (semaphore && terminal.leaseToken) {
      semaphore.release(terminal.id);
      console.warn(`Semaphore released for crashed terminal ${terminal.id}`);
    }
  }

  private updateMetrics(): void {
    for (const [provider, providerConfig] of Object.entries(this.config.perProvider)) {
      const providerTerminals = Array.from(this.terminals.values())
        .filter(t => t.provider === provider);

      const activeLeases = Array.from(this.activeLeases.values())
        .filter(l => l.provider === provider && !l.released);

      this.metrics.providers[provider] = {
        totalTerminals: providerTerminals.length,
        idleTerminals: providerTerminals.filter(t => t.status === 'idle').length,
        busyTerminals: providerTerminals.filter(t => t.status === 'busy').length,
        crashedTerminals: providerTerminals.filter(t => t.status === 'crashed').length,
        activeLeases: activeLeases.length,
        p99WaitTime: this.metrics.providers[provider]?.p99WaitTime || 0,
      };
    }
  }
}