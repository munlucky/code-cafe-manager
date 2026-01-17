# TerminalPool Concurrency Model (COMPLETELY REDESIGNED - Gap 2 해결)

#### 2.4.1 Custom Semaphore Implementation (NEW)

**문제**: p-limit cannot enforce pool size limits and doesn't support cancellation

**Solution**: Implement custom `PoolSemaphore` with:
1. **True pool size enforcement**: Max concurrent leases = pool size
2. **Cancellable queue**: Timeout support with abortable queued requests
3. **Explicit cleanup**: Clear release paths for crash/timeout

**File**: `packages/orchestrator/src/terminal/pool-semaphore.ts`

```typescript
export interface LeaseRequest {
  id: string;
  provider: ProviderType;
  resolve: (terminal: Terminal) => void;
  reject: (error: Error) => void;
  timeoutId?: NodeJS.Timeout;
  aborted: boolean;
}

export class PoolSemaphore {
  private activeLeases: Set<string> = new Set(); // terminal IDs
  private queue: LeaseRequest[] = [];
  private maxConcurrent: number;

  constructor(maxConcurrent: number) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Request a lease slot
   * @returns Promise that resolves when slot is available
   * @throws TerminalLeaseTimeoutError if timeout expires
   */
  async acquire(
    provider: ProviderType,
    timeoutMs: number,
    terminalSupplier: () => Promise<Terminal>
  ): Promise<Terminal> {
    return new Promise((resolve, reject) => {
      const request: LeaseRequest = {
        id: `req-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        provider,
        resolve,
        reject,
        aborted: false,
      };

      // Set timeout
      request.timeoutId = setTimeout(() => {
        request.aborted = true;
        this.removeFromQueue(request.id);
        reject(new TerminalLeaseTimeoutError(provider, timeoutMs));
      }, timeoutMs);

      this.queue.push(request);
      this.processQueue(terminalSupplier);
    });
  }

  /**
   * Release a lease slot
   */
  release(terminalId: string): void {
    this.activeLeases.delete(terminalId);
    this.processQueue();
  }

  /**
   * Get current active lease count
   */
  getActiveCount(): number {
    return this.activeLeases.size;
  }

  /**
   * Get queued request count
   */
  getQueuedCount(): number {
    return this.queue.length;
  }

  /**
   * Cancel all queued requests (e.g., on shutdown)
   */
  cancelAll(): void {
    for (const request of this.queue) {
      if (request.timeoutId) {
        clearTimeout(request.timeoutId);
      }
      request.reject(new Error('Semaphore cancelled'));
    }
    this.queue = [];
  }

  private async processQueue(terminalSupplier?: () => Promise<Terminal>): Promise<void> {
    // Remove aborted requests
    this.queue = this.queue.filter(req => !req.aborted);

    // Process while we have capacity and requests
    while (this.activeLeases.size < this.maxConcurrent && this.queue.length > 0) {
      const request = this.queue.shift()!;

      if (request.timeoutId) {
        clearTimeout(request.timeoutId);
      }

      if (request.aborted) {
        continue;
      }

      try {
        if (!terminalSupplier) {
          throw new Error('Terminal supplier required for first-time acquisition');
        }

        const terminal = await terminalSupplier();
        this.activeLeases.add(terminal.id);
        request.resolve(terminal);
      } catch (error) {
        request.reject(error as Error);
      }
    }
  }

  private removeFromQueue(requestId: string): void {
    const index = this.queue.findIndex(req => req.id === requestId);
    if (index !== -1) {
      const request = this.queue[index];
      if (request.timeoutId) {
        clearTimeout(request.timeoutId);
      }
      this.queue.splice(index, 1);
    }
  }
}
```

#### 2.4.2 LeaseToken with Explicit Cleanup (Updated)

**File**: `packages/orchestrator/src/terminal/lease-token.ts`

```typescript
export interface LeaseToken {
  id: string;                 // Unique token ID
  terminalId: string;         // Leased terminal
  baristaId: string;          // Barista that leased
  provider: ProviderType;
  leasedAt: Date;
  expiresAt: Date;            // Lease timeout deadline
  released: boolean;
  releasedAt?: Date;
  semaphoreSlotId?: string;   // Reference to semaphore slot for cleanup
}

export class LeaseManager {
  private tokens: Map<string, LeaseToken> = new Map();
  private waitTimes: number[] = [];       // For p99 metric

  createToken(
    terminalId: string,
    baristaId: string,
    provider: ProviderType,
    timeout: number,
    semaphoreSlotId?: string
  ): LeaseToken {
    const token: LeaseToken = {
      id: `lease-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      terminalId,
      baristaId,
      provider,
      leasedAt: new Date(),
      expiresAt: new Date(Date.now() + timeout),
      released: false,
      semaphoreSlotId,
    };

    this.tokens.set(token.id, token);
    return token;
  }

  releaseToken(tokenId: string): void {
    const token = this.tokens.get(tokenId);
    if (!token) {
      throw new Error(`Lease token ${tokenId} not found`);
    }

    if (token.released) {
      throw new Error(`Lease token ${tokenId} already released`);
    }

    token.released = true;
    token.releasedAt = new Date();
  }

  /**
   * Force release token (for crash/timeout scenarios)
   */
  forceReleaseToken(tokenId: string): void {
    const token = this.tokens.get(tokenId);
    if (token && !token.released) {
      token.released = true;
      token.releasedAt = new Date();
    }
  }

  isExpired(token: LeaseToken): boolean {
    return Date.now() > token.expiresAt.getTime();
  }

  getActiveTokens(provider?: ProviderType): LeaseToken[] {
    const tokens = Array.from(this.tokens.values()).filter((t) => !t.released);
    return provider ? tokens.filter((t) => t.provider === provider) : tokens;
  }

  getActiveCount(provider: ProviderType): number {
    return this.getActiveTokens(provider).length;
  }

  recordWaitTime(waitTime: number): void {
    this.waitTimes.push(waitTime);
    // Keep last 1000 measurements
    if (this.waitTimes.length > 1000) {
      this.waitTimes.shift();
    }
  }

  getP99WaitTime(): number {
    if (this.waitTimes.length === 0) return 0;

    const sorted = [...this.waitTimes].sort((a, b) => a - b);
    const p99Index = Math.floor(sorted.length * 0.99);
    return sorted[p99Index];
  }

  cleanup(): void {
    // Remove released tokens older than 1 hour
    const oneHourAgo = Date.now() - 3600000;
    for (const [id, token] of this.tokens.entries()) {
      if (token.released && token.releasedAt && token.releasedAt.getTime() < oneHourAgo) {
        this.tokens.delete(id);
      }
    }
  }
}
```

#### 2.4.3 TerminalPool with Custom Semaphore (COMPLETELY REDESIGNED)

**Updated TerminalPool using PoolSemaphore:**

```typescript
// packages/orchestrator/src/terminal/terminal-pool.ts (REDESIGNED)

export class TerminalPool extends EventEmitter {
  private terminals: Map<string, Terminal> = new Map();
  private config: TerminalPoolConfig;
  private semaphores: Map<string, PoolSemaphore> = new Map(); // Custom semaphore
  private leaseManager = new LeaseManager();
  private shutdownFlag = false;

  constructor(config: TerminalPoolConfig) {
    super();
    this.config = config;
    this.initializeSemaphores();
  }

  private initializeSemaphores(): void {
    for (const [provider, providerConfig] of Object.entries(this.config.perProvider)) {
      this.semaphores.set(provider, new PoolSemaphore(providerConfig.size));
    }
  }

  /**
   * Lease a terminal with true pool size enforcement
   */
  async lease(provider: ProviderType): Promise<{ terminal: Terminal; token: LeaseToken }> {
    if (this.shutdownFlag) {
      throw new TerminalPoolError('TerminalPool is shutting down');
    }

    const semaphore = this.semaphores.get(provider);
    const providerConfig = this.config.perProvider[provider];

    if (!semaphore || !providerConfig) {
      throw new TerminalPoolError(`Provider ${provider} not configured`);
    }

    const leaseStartTime = Date.now();

    try {
      // Use custom semaphore with timeout and terminal supplier
      const terminal = await semaphore.acquire(
        provider,
        providerConfig.timeout,
        async () => {
          // This is called when semaphore slot is available
          return await this.acquireIdleTerminal(provider);
        }
      );

      // Create lease token AFTER terminal is acquired
      const token = this.leaseManager.createToken(
        terminal.id,
        'unknown-barista',
        provider,
        providerConfig.timeout
      );

      // Update terminal
      terminal.status = 'busy';
      terminal.lastUsed = new Date();
      terminal.leaseToken = token;

      // Record wait time
      const waitTime = Date.now() - leaseStartTime;
      this.leaseManager.recordWaitTime(waitTime);

      this.emit('terminal:leased', terminal.id, token.id);
      return { terminal, token };
    } catch (error) {
      if (error instanceof TerminalLeaseTimeoutError) {
        this.emit('terminal:lease-timeout', provider);
      }
      throw error;
    }
  }

  private async acquireIdleTerminal(provider: ProviderType): Promise<Terminal> {
    // Find idle terminal
    let terminal = this.findIdleTerminal(provider);

    // If no idle terminal and we haven't reached pool size, spawn new one
    if (!terminal) {
      const activeCount = this.semaphores.get(provider)?.getActiveCount() || 0;
      const maxConcurrent = this.config.perProvider[provider].size;

      if (activeCount < maxConcurrent) {
        terminal = await this.spawn(provider);
      } else {
        // This should not happen - semaphore should prevent over-spawning
        throw new TerminalPoolError(`No idle terminals available for ${provider}`);
      }
    }

    return terminal;
  }

  private findIdleTerminal(provider: ProviderType): Terminal | undefined {
    for (const terminal of this.terminals.values()) {
      if (terminal.provider === provider && terminal.status === 'idle') {
        return terminal;
      }
    }
    return undefined;
  }

  /**
   * Release terminal with explicit cleanup
   */
  async release(terminal: Terminal, token: LeaseToken): Promise<void> {
    const existingTerminal = this.terminals.get(terminal.id);
    if (!existingTerminal) {
      throw new TerminalPoolError(`Terminal ${terminal.id} not found`);
    }

    // Validate token
    if (existingTerminal.leaseToken?.id !== token.id) {
      throw new TerminalPoolError(`Invalid lease token for terminal ${terminal.id}`);
    }

    // Release token FIRST
    this.leaseManager.releaseToken(token.id);

    // Update terminal state
    existingTerminal.status = 'idle';
    existingTerminal.leaseToken = undefined;
    existingTerminal.currentBarista = undefined;
    existingTerminal.lastUsed = new Date();

    // Release semaphore slot
    const semaphore = this.semaphores.get(terminal.provider);
    if (semaphore) {
      semaphore.release(terminal.id);
    }

    this.emit('terminal:released', terminal.id, token.id);
  }

private async acquireIdleTerminal(provider: ProviderType): Promise<{ terminal: Terminal; token: LeaseToken }> {
  // Find or create terminal
  let terminal = this.findIdleTerminal(provider);
  if (!terminal) {
    terminal = await this.spawn(provider);
  }

  // Create lease token (BEFORE changing status)
  const token = this.leaseManager.createToken(terminal.id, 'unknown-barista', provider, this.config.perProvider[provider].timeout);

  // Update terminal status
  terminal.status = 'busy';
  terminal.lastUsed = new Date();
  terminal.leaseToken = token;

  this.emit('terminal:leased', terminal.id, token.id);

  return { terminal, token };
}

async release(terminal: Terminal, token: LeaseToken): Promise<void> {
  const existingTerminal = this.terminals.get(terminal.id);
  if (!existingTerminal) {
    throw new TerminalPoolError(`Terminal ${terminal.id} not found`);
  }

  // Validate token
  if (existingTerminal.leaseToken?.id !== token.id) {
    throw new TerminalPoolError(`Invalid lease token for terminal ${terminal.id}`);
  }

  // Release token FIRST (리스 완료 시점)
  this.leaseManager.releaseToken(token.id);

  // Update terminal state
  existingTerminal.status = 'idle';
  existingTerminal.leaseToken = undefined;
  existingTerminal.currentBarista = undefined;
  existingTerminal.lastUsed = new Date();

  this.emit('terminal:released', terminal.id, token.id);

  // Cleanup old tokens periodically
  if (Math.random() < 0.01) {
    this.leaseManager.cleanup();
  }
}
```

#### 2.4.3 Timeout Cancellation Behavior (Corrected)

**Scenario**: Lease timeout 발생 시 어떻게 처리하는가?

**Critical Issue in v2**: Timeout 시 semaphore 슬롯이 자동 반환되지 않음 (p-limit는 Promise reject 시 슬롯 유지)

**Corrected Behavior:**
1. **Semaphore 슬롯은 명시적 반환 필요**: Timeout 시 `semaphore.release()` 호출
2. **Timeout cancellation path 추가**: `acquireIdleTerminal()` 호출 전 timeout 발생 시 semaphore 슬롯 반환
3. **Terminal 상태 영향 없음**: Timeout은 대기 취소일 뿐, Terminal 자체는 영향 없음
4. **Caller(Barista)는 재시도 책임**: 새 lease 요청 또는 에러 보고

**Updated Code with Timeout Cleanup:**

```typescript
async lease(provider: ProviderType): Promise<{ terminal: Terminal; token: LeaseToken }> {
  const leaseStartTime = Date.now();
  const semaphore = this.semaphores.get(provider);
  const providerConfig = this.config.perProvider[provider];

  // Create abort controller for timeout cleanup
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), providerConfig.timeout);

  try {
    // Semaphore acquire with abort signal
    const result = await semaphore(async () => {
      if (abortController.signal.aborted) {
        throw new TerminalLeaseTimeoutError(provider, providerConfig.timeout);
      }

      const terminal = await this.acquireIdleTerminal(provider);
      return terminal;
    });

    // Record wait time
    const waitTime = Date.now() - leaseStartTime;
    this.leaseManager.recordWaitTime(waitTime);

    return result;
  } catch (error) {
    // IMPORTANT: On timeout, semaphore slot is automatically released by p-limit
    // because the promise rejects, but we need to ensure cleanup
    if (error instanceof TerminalLeaseTimeoutError) {
      this.emit('terminal:lease-timeout', provider);

      // Force semaphore release if needed (p-limit handles this, but defensive)
      // semaphore.clearQueue(); // Not available in p-limit
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

**Code:**

```typescript
// Caller (Barista) retry logic
async executeStep(order: Order, step: Step): Promise<StepResult> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { terminal, token } = await this.pool.lease(this.role.recommendedProvider);

      try {
        const prompt = this.renderPrompt(step.variables);
        const output = await this.sendToTerminal(terminal, prompt);
        return { status: 'success', output };
      } finally {
        await this.pool.release(terminal, token);
      }
    } catch (error) {
      lastError = error as Error;

      if (error instanceof TerminalLeaseTimeoutError) {
        console.warn(`Lease timeout on attempt ${attempt + 1}, retrying...`);
        await new Promise((r) => setTimeout(r, 1000)); // Backoff
        continue;
      }

      // Non-timeout error, fail immediately
      throw error;
    }
  }

  throw new Error(`Failed after ${maxRetries} attempts: ${lastError?.message}`);
}
```

#### 2.4.4 Lease Wait Time Measurement (p99 Verification)

**Metric Collection:**

```typescript
// TerminalPool exposes metrics
getMetrics(): PoolMetrics {
  const metrics: PoolMetrics = {
    providers: {},
  };

  for (const provider of Object.keys(this.config.perProvider)) {
    metrics.providers[provider] = {
      totalTerminals: this.terminals.filter((t) => t.provider === provider).length,
      idleTerminals: this.terminals.filter((t) => t.provider === provider && t.status === 'idle').length,
      busyTerminals: this.terminals.filter((t) => t.provider === provider && t.status === 'busy').length,
      crashedTerminals: this.terminals.filter((t) => t.provider === provider && t.status === 'crashed').length,
      activeLeases: this.leaseManager.getActiveCount(provider),
      p99WaitTime: this.leaseManager.getP99WaitTime(),
    };
  }

  return metrics;
}

interface PoolMetrics {
  providers: {
    [provider: string]: {
      totalTerminals: number;
      idleTerminals: number;
      busyTerminals: number;
      crashedTerminals: number;
      activeLeases: number;
      p99WaitTime: number; // milliseconds
    };
  };
}
```

**Load Test Verification:**

```typescript
// packages/orchestrator/test/load/terminal-pool-load.test.ts
describe('TerminalPool Load Test', () => {
  test('p99 lease wait time < 1s with 10 concurrent orders', async () => {
    const pool = new TerminalPool({
      perProvider: {
        'claude-code': { size: 8, timeout: 30000, maxRetries: 3 },
      },
    });

    const promises = Array.from({ length: 10 }, async () => {
      const { terminal, token } = await pool.lease('claude-code');
      await new Promise((r) => setTimeout(r, 1000)); // Simulate work
      await pool.release(terminal, token);
    });

    await Promise.all(promises);

    const metrics = pool.getMetrics();
    const p99 = metrics.providers['claude-code'].p99WaitTime;

    expect(p99).toBeLessThan(1000); // p99 < 1s
  });
});
```

---

**다음 문서:** [04-ipc-ui-api-contracts.md](04-ipc-ui-api-contracts.md) - IPC/UI API Contracts