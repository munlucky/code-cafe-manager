/**
 * Terminal Pool Implementation
 * Gap 2 해결: Enhanced concurrency model with proper lease management
 */

import { ProviderType, createLogger } from '@codecafe/core';

const logger = createLogger({ context: 'TerminalPool', json: true });
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

// Exit handler tracking for cleanup
interface ExitHandlerEntry {
  handler: (event: { exitCode: number }) => void;
}

export class TerminalPool {
  private terminals: Map<string, Terminal> = new Map();
  private semaphores: Map<ProviderType, PoolSemaphore> = new Map();
  private config: TerminalPoolConfig;
  private activeLeases: Map<string, LeaseToken> = new Map();
  private metrics: PoolMetrics = { providers: {} };
  // Exit handler tracking for memory leak prevention
  private exitHandlers: Map<string, ExitHandlerEntry> = new Map();

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
      this.semaphores.set(provider as ProviderType, new PoolSemaphore(providerConfig.size));
      this.resetProviderMetrics(provider);
    }
  }

  private resetProviderMetrics(provider: string): void {
    this.metrics.providers[provider] = {
      totalTerminals: 0,
      idleTerminals: 0,
      busyTerminals: 0,
      crashedTerminals: 0,
      activeLeases: 0,
      p99WaitTime: 0,
    };
  }

  /**
   * C3: Structured log helper for diagnostics
   */
  private log(step: string, details: Record<string, unknown> = {}): void {
    logger.debug(step, { scope: 'terminal-pool', ...details });
  }

  /**
   * Acquire a terminal lease
   */
  async acquireLease(
    provider: ProviderType,
    baristaId: string,
    cwd?: string,
    timeoutMs?: number
  ): Promise<TerminalLease> {
    const providerConfig = this.config.perProvider[provider];
    if (!providerConfig) {
      throw new ProviderNotFoundError(provider);
    }

    const semaphore = this.semaphores.get(provider);
    if (!semaphore) {
      throw new SemaphoreNotFoundError(provider);
    }

    const timeout = timeoutMs || providerConfig.timeout;
    const acquireStartTime = Date.now();

    // C3: Log acquire start
    this.log('acquire-start', {
      provider,
      baristaId,
      cwd: cwd || this.config.cwd || process.cwd(),
      timeoutMs: timeout,
    });

    try {
      // Pass CWD to getOrCreateTerminal
      const terminal = await semaphore.acquire(provider, timeout, () =>
        this.getOrCreateTerminal(provider, cwd)
      );

      // C3: Log acquire success
      this.log('acquire-success', {
        provider,
        baristaId,
        terminalId: terminal.id,
        elapsedMs: Date.now() - acquireStartTime,
      });

      return this.createActiveLease(terminal, baristaId, provider, timeout);
    } catch (error) {
      // C3: Log acquire failure
      this.log('acquire-fail', {
        provider,
        baristaId,
        cwd: cwd || this.config.cwd || process.cwd(),
        timeoutMs: timeout,
        elapsedMs: Date.now() - acquireStartTime,
        error: error instanceof Error ? error.message : String(error),
      });
      this.handleAcquireError(error, provider, timeout);
      throw error;
    }
  }

  // ... (acquireLease implementation)

  private createActiveLease(
    terminal: Terminal,
    baristaId: string,
    provider: ProviderType,
    timeout: number
  ): TerminalLease {
    const token = this.createLeaseToken(terminal.id, baristaId, provider, timeout);

    // Update terminal status
    terminal.status = 'busy';
    terminal.currentBarista = baristaId;
    terminal.leaseToken = token;
    terminal.lastUsed = new Date();

    // Track active lease
    this.activeLeases.set(token.id, token);
    this.updateMetrics();

    return {
      terminal,
      token,
      release: () => this.releaseLease(token.id),
    };
  }

  private createLeaseToken(
    terminalId: string,
    baristaId: string,
    provider: ProviderType,
    timeout: number
  ): LeaseToken {
    return {
      id: `lease-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      terminalId,
      baristaId,
      provider,
      leasedAt: new Date(),
      expiresAt: new Date(Date.now() + timeout),
      released: false,
    };
  }

  private handleAcquireError(error: unknown, provider: ProviderType, timeout: number): void {
    if (error instanceof TerminalLeaseTimeoutError) {
      const currentP99 = this.metrics.providers[provider].p99WaitTime;
      this.metrics.providers[provider].p99WaitTime = Math.max(currentP99, timeout);
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

    this.finalizeLeaseRelease(leaseToken, terminal);
  }

  private finalizeLeaseRelease(leaseToken: LeaseToken, terminal: Terminal): void {
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
    this.activeLeases.delete(leaseToken.id);
    this.updateMetrics();
  }

  /**
   * Get pool status
   */
  getStatus(): PoolStatus {
    const status: PoolStatus = {};

    for (const [provider, _] of Object.entries(this.config.perProvider)) {
      const terminals = Array.from(this.terminals.values())
        .filter(t => t.provider === provider);

      status[provider] = {
        total: terminals.length,
        idle: terminals.filter(t => t.status === 'idle').length,
        busy: terminals.filter(t => t.status === 'busy').length,
        crashed: terminals.filter(t => t.status === 'crashed').length,
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
    for (const semaphore of this.semaphores.values()) {
      semaphore.dispose();
    }

    // Remove all exit handlers before killing terminals
    for (const [terminalId, handlerEntry] of this.exitHandlers) {
      const terminal = this.terminals.get(terminalId);
      if (terminal?.process) {
        terminal.process.removeListener('exit', handlerEntry.handler as (...args: unknown[]) => void);
      }
    }
    this.exitHandlers.clear();

    const killPromises = Array.from(this.terminals.values()).map(terminal => {
      if (terminal.process) {
        const adapter = ProviderAdapterFactory.get(terminal.provider);
        return adapter.kill(terminal.process);
      }
      return Promise.resolve();
    });

    await Promise.all(killPromises);

    this.terminals.clear();
    this.semaphores.clear();
    this.activeLeases.clear();
  }

  /**
   * Helper to kill a specific terminal
   */
  private async killTerminal(terminal: Terminal): Promise<void> {
    // Remove exit handler before killing to prevent double handling
    const handlerEntry = this.exitHandlers.get(terminal.id);
    if (handlerEntry && terminal.process) {
      terminal.process.removeListener('exit', handlerEntry.handler as (...args: unknown[]) => void);
      this.exitHandlers.delete(terminal.id);
    }

    if (terminal.process) {
      const adapter = ProviderAdapterFactory.get(terminal.provider);
      await adapter.kill(terminal.process);
    }
    this.terminals.delete(terminal.id);
  }

  private async getOrCreateTerminal(provider: ProviderType, cwd?: string): Promise<Terminal> {
    const effectiveCwd = cwd || this.config.cwd || process.cwd();
    
    // Find idle terminal with matching CWD
    const idleTerminal = Array.from(this.terminals.values())
      .find(t => t.provider === provider && t.status === 'idle' && (t.cwd === effectiveCwd));

    if (idleTerminal) {
      return idleTerminal;
    }

    // No matching idle terminal. Check if we need to make room.
    const providerTerminals = Array.from(this.terminals.values()).filter(t => t.provider === provider);
    const maxTerminals = this.config.perProvider[provider].size;

    if (providerTerminals.length >= maxTerminals) {
      // Find an idle terminal to recycle (even if CWD didn't match above)
      const victim = providerTerminals.find(t => t.status === 'idle');
      if (victim) {
        logger.info(` Recycling terminal ${victim.id} (CWD mismatch: ${victim.cwd} != ${effectiveCwd})`);
        await this.killTerminal(victim);
      } else {
        // Should not happen if Semaphore logic is correct (permits <= size)
        logger.warn(' Semaphore acquired but no idle terminals to recycle?');
      }
    }

    return this.createNewTerminal(provider, effectiveCwd);
  }

  private async createNewTerminal(provider: ProviderType, cwd: string): Promise<Terminal> {
    const adapter = ProviderAdapterFactory.get(provider);
    const process = await adapter.spawn({ cwd });

    const terminal: Terminal = {
      id: `terminal-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      provider,
      process,
      status: 'idle',
      cwd,
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

    const exitHandler = ({ exitCode }: { exitCode: number }) => {
      logger.info(`Terminal ${terminal.id} exited with code ${exitCode}`);
      this.handleTerminalExit(terminal, exitCode);
      // Remove from tracking after exit
      this.exitHandlers.delete(terminal.id);
    };

    adapter.onExit(terminal.process, exitHandler);

    // Track for cleanup
    this.exitHandlers.set(terminal.id, { handler: exitHandler });
  }

  private handleTerminalExit(terminal: Terminal, exitCode: number): void {
    if (exitCode === 0) {
      this.resetTerminalState(terminal);
    } else {
      this.handleCrashedTerminal(terminal);
    }
  }

  private resetTerminalState(terminal: Terminal): void {
    terminal.status = 'idle';
    terminal.currentBarista = undefined;
    terminal.leaseToken = undefined;
    this.updateMetrics();
  }

  private handleCrashedTerminal(terminal: Terminal): void {
    terminal.status = 'crashed';
    this.updateMetrics();

    if (terminal.leaseToken && !terminal.leaseToken.released) {
      this.recoverCrashedLease(terminal);
    }
  }

  private recoverCrashedLease(terminal: Terminal): void {
    this.handleCrashDuringLease(terminal).catch((error) => {
      logger.error(`Crash recovery failed for terminal ${terminal.id}`, { error });
      this.releaseSemaphoreOnCrashFailure(terminal);
    });
  }

  /**
   * Handle crash during active lease (Gap 5)
   */
  private async handleCrashDuringLease(crashedTerminal: Terminal): Promise<void> {
    const provider = crashedTerminal.provider;
    const maxRetries = this.config.perProvider[provider].maxRetries;

    logger.warn(`Attempting auto-restart for crashed terminal ${crashedTerminal.id}`);

    try {
      await this.retryTerminalCreation(crashedTerminal, maxRetries);
    } catch (error) {
      logger.error(`All restart attempts failed for terminal ${crashedTerminal.id}`);
      throw error;
    }
  }

  private async retryTerminalCreation(crashedTerminal: Terminal, maxRetries: number): Promise<void> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await this.replaceCrashedTerminal(crashedTerminal);
        return;
      } catch (error) {
        if (attempt === maxRetries - 1) throw error;

        logger.error(`Restart attempt ${attempt + 1} failed`, { error });
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  private async replaceCrashedTerminal(crashedTerminal: Terminal): Promise<void> {
    const newTerminal = await this.getOrCreateTerminal(crashedTerminal.provider);

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

    logger.info(`Terminal ${crashedTerminal.id} restarted as ${newTerminal.id}`);
  }

  /**
   * Release semaphore on crash recovery failure (Gap 5)
   */
  private releaseSemaphoreOnCrashFailure(terminal: Terminal): void {
    const semaphore = this.semaphores.get(terminal.provider);
    if (semaphore && terminal.leaseToken) {
      semaphore.release(terminal.id);
      logger.warn(`Semaphore released for crashed terminal ${terminal.id}`);
    }
  }

  private updateMetrics(): void {
    const newMetrics: PoolMetrics = { providers: {} };

    // Initialize metrics for all configured providers
    for (const provider of Object.keys(this.config.perProvider)) {
      newMetrics.providers[provider] = {
        totalTerminals: 0,
        idleTerminals: 0,
        busyTerminals: 0,
        crashedTerminals: 0,
        activeLeases: 0,
        p99WaitTime: this.metrics.providers[provider]?.p99WaitTime || 0,
      };
    }

    // Aggregate terminal stats
    for (const terminal of this.terminals.values()) {
      const stats = newMetrics.providers[terminal.provider];
      if (stats) {
        stats.totalTerminals++;
        if (terminal.status === 'idle') stats.idleTerminals++;
        if (terminal.status === 'busy') stats.busyTerminals++;
        if (terminal.status === 'crashed') stats.crashedTerminals++;
      }
    }

    // Aggregate lease stats
    for (const lease of this.activeLeases.values()) {
      if (!lease.released && newMetrics.providers[lease.provider]) {
        newMetrics.providers[lease.provider].activeLeases++;
      }
    }

    this.metrics = newMetrics;
  }
}
