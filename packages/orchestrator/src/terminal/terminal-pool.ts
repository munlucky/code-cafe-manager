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
      throw new Error(`No configuration for provider: ${provider}`);
    }

    const timeout = timeoutMs || providerConfig.timeout;
    const semaphore = this.semaphores.get(provider);
    if (!semaphore) {
      throw new Error(`No semaphore for provider: ${provider}`);
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
      throw new Error(`Lease not found: ${leaseId}`);
    }

    const terminal = this.terminals.get(leaseToken.terminalId);
    if (!terminal) {
      throw new Error(`Terminal not found: ${leaseToken.terminalId}`);
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
    this.updateMetrics();

    return terminal;
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