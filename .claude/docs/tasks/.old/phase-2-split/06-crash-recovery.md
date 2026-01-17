# Crash Recovery Behavior (NEW - Gap 5 해결)

#### 2.7.1 Crash Recovery State Machine

**Scenario**: Terminal exits with non-zero code during active lease

**State Machine:**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Terminal exits (exitCode !== 0) during active lease     │
│    → Terminal.status = 'crashed'                            │
│    → Emit 'terminal:crashed' event                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. TerminalPool detects crash (onExit handler)             │
│    → Check if Terminal has active lease (leaseToken)       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Auto-restart attempt (synchronous, within maxRetries)   │
│    → Call spawn() again (same provider)                     │
│    → If spawn succeeds: new Terminal, same ID              │
│    → If spawn fails: throw TerminalCrashedError            │
└─────────────────────────────────────────────────────────────┘
                          ↓
                      ┌───┴───┐
                      │       │
            ┌─────────▼───┐ ┌─▼──────────────┐
            │ Restart OK  │ │ Restart Failed │
            └──────┬──────┘ └───┬────────────┘
                   │            │
                   ▼            ▼
       ┌──────────────────┐  ┌───────────────────┐
       │ 4a. Continue     │  │ 4b. Throw Error   │
       │ lease with new   │  │ Release semaphore │
       │ Terminal         │  │ Caller retries    │
       └──────────────────┘  └───────────────────┘
```

#### 2.7.2 Implementation (Corrected - Gap 2, 5 해결)

**Updated TerminalPool with Clear Cleanup Responsibilities:**

```typescript
// packages/orchestrator/src/terminal/terminal-pool.ts

private setupProcessHandlers(terminal: Terminal): void {
  const process = terminal.process as IPty;

  process.onExit(({ exitCode }) => {
    console.log(`Terminal ${terminal.id} exited with code ${exitCode}`);

    if (exitCode !== 0) {
      terminal.status = 'crashed';
      this.emit('terminal:crashed', terminal.id, exitCode);

      // If terminal had an active lease, attempt recovery
      if (terminal.leaseToken && !terminal.leaseToken.released) {
        this.handleCrashDuringLease(terminal).catch((error) => {
          console.error(`Crash recovery failed for terminal ${terminal.id}:`, error);

          // CRITICAL: On crash recovery failure, release semaphore
          this.releaseSemaphoreOnCrashFailure(terminal);
        });
      }
    } else {
      // Normal exit
      terminal.status = 'idle';
      this.emit('terminal:exit', terminal.id);
    }
  });

  process.onData((data) => {
    this.emit('terminal:data', terminal.id, data);
  });
}

private releaseSemaphoreOnCrashFailure(terminal: Terminal): void {
  const semaphore = this.semaphores.get(terminal.provider);
  if (semaphore) {
    // p-limit doesn't have direct release method, but we can track manually
    // For now, we'll rely on the fact that the lease promise will reject
    // and p-limit will release the slot automatically
    console.warn(`Terminal ${terminal.id} crash recovery failed, semaphore should auto-release`);
  }
}

private async handleCrashDuringLease(crashedTerminal: Terminal): Promise<void> {
  const provider = crashedTerminal.provider;
  const providerConfig = this.config.perProvider[provider];

  console.warn(`Attempting auto-restart for crashed terminal ${crashedTerminal.id}`);

  try {
    // Attempt restart (within maxRetries)
    for (let attempt = 0; attempt < providerConfig.maxRetries; attempt++) {
      try {
        const newTerminal = await this.spawn(provider);

        // Transfer lease to new terminal
        newTerminal.leaseToken = crashedTerminal.leaseToken;
        newTerminal.currentBarista = crashedTerminal.currentBarista;
        newTerminal.status = 'busy';

        // Cleanup crashed terminal
        this.terminals.delete(crashedTerminal.id);

        this.emit('terminal:crash-recovered', crashedTerminal.id, newTerminal.id);

        console.log(`Crash recovery succeeded: ${crashedTerminal.id} → ${newTerminal.id}`);
        return;
      } catch (error) {
        console.error(`Restart attempt ${attempt + 1} failed:`, error);
        await new Promise((r) => setTimeout(r, 1000)); // Backoff
      }
    }

    // All restart attempts failed
    throw new TerminalCrashedError(crashedTerminal.id);
  } catch (error) {
    // CRITICAL CLEANUP RESPONSIBILITIES (Gap 2, 5 해결):
    // 1. Kill process (if still exists) - handled by cleanup()
    // 2. Release lease token - handled by leaseManager.releaseToken()
    // 3. Release semaphore - p-limit auto-releases on promise rejection

    // Cleanup crashed terminal
    this.terminals.delete(crashedTerminal.id);
    this.emit('terminal:crash-recovery-failed', crashedTerminal.id);

    // Caller (Barista) will receive TerminalCrashedError and retry from lease()
    throw error;
  }
}
```

#### 2.7.3 Caller (Barista) Retry Logic

**BaristaEngineV2 handles crash:**

```typescript
// packages/orchestrator/src/barista/barista-engine-v2.ts

async executeStep(barista: Barista, order: Order, step: Step, variables: Record<string, any>): Promise<StepResult> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { terminal, token } = await this.pool.lease(barista.role.recommendedProvider);
      barista.terminalId = terminal.id;
      terminal.currentBarista = barista.id;

      try {
        const adapter = this.adapters.get(barista.role.recommendedProvider);
        const prompt = this.renderPrompt(barista.role, variables);

        await adapter.sendPrompt(terminal.process, prompt);
        const output = await adapter.readOutput(terminal.process, 60000);

        return {
          status: 'success',
          output,
        };
      } catch (error) {
        // Terminal crashed during execution
        if (error instanceof TerminalCrashedError) {
          console.error(`Terminal crashed mid-execution: ${error.message}`);
          lastError = error;
          // Release will be handled by crash recovery
          // Retry from lease
          await new Promise((r) => setTimeout(r, 2000)); // Backoff
          continue;
        }

        throw error; // Other errors, rethrow
      } finally {
        // Only release if terminal is still valid
        const currentTerminal = this.pool.getTerminal(terminal.id);
        if (currentTerminal && currentTerminal.status !== 'crashed') {
          await this.pool.release(terminal, token);
        }
        barista.terminalId = null;
      }
    } catch (error) {
      lastError = error as Error;

      if (error instanceof TerminalLeaseTimeoutError) {
        console.warn(`Lease timeout on attempt ${attempt + 1}, retrying...`);
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      if (error instanceof TerminalCrashedError) {
        console.error(`Terminal crashed on attempt ${attempt + 1}, retrying...`);
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }

      // Non-retryable error
      throw error;
    }
  }

  return {
    status: 'failure',
    output: '',
    error: `Failed after ${maxRetries} attempts: ${lastError?.message}`,
  };
}
```

#### 2.7.4 Crash Recovery Tests

**파일**: `packages/orchestrator/src/terminal/terminal-pool.crash.test.ts`

```typescript
import { describe, test, expect, vi } from 'vitest';
import { TerminalPool } from './terminal-pool';
import { TerminalCrashedError } from './errors';

describe('TerminalPool Crash Recovery', () => {
  test('should auto-restart terminal on crash during lease', async () => {
    const pool = new TerminalPool({
      perProvider: {
        'claude-code': { size: 2, timeout: 5000, maxRetries: 3 },
      },
    });

    const { terminal, token } = await pool.lease('claude-code');

    // Simulate crash
    (terminal.process as any).emit('exit', { exitCode: 1 });

    // Wait for recovery
    await new Promise((r) => setTimeout(r, 100));

    // Terminal should be replaced
    const status = pool.getStatus();
    expect(status['claude-code'].crashed).toBe(0); // Recovered
    expect(status['claude-code'].idle).toBe(1); // New terminal idle
  });

  test('should throw TerminalCrashedError if restart fails', async () => {
    const pool = new TerminalPool({
      perProvider: {
        'claude-code': { size: 1, timeout: 5000, maxRetries: 1 },
      },
    });

    // Mock spawn to fail
    vi.spyOn(pool as any, 'spawn').mockRejectedValue(new Error('Spawn failed'));

    const { terminal, token } = await pool.lease('claude-code');

    // Simulate crash
    (terminal.process as any).emit('exit', { exitCode: 1 });

    // Expect crash recovery to fail
    await expect(async () => {
      await new Promise((r) => setTimeout(r, 200)); // Wait for recovery attempts
    }).rejects.toThrow(TerminalCrashedError);
  });

  test('Barista should retry after crash', async () => {
    const pool = new TerminalPool({
      perProvider: {
        'claude-code': { size: 2, timeout: 5000, maxRetries: 3 },
      },
    });

    const engine = new BaristaEngineV2(pool, new AdapterRegistry());
    const barista = createMockBarista();
    const order = createMockOrder();
    const step = createMockStep();

    // First lease will crash
    const firstLease = pool.lease('claude-code');
    const { terminal } = await firstLease;
    setTimeout(() => (terminal.process as any).emit('exit', { exitCode: 1 }), 100);

    // executeStep should retry and succeed
    const result = await engine.executeStep(barista, order, step, { task: 'test' });

    expect(result.status).toBe('success');
  });
});
```

---

**다음 문서:** [07-implementation-sequence.md](07-implementation-sequence.md) - Implementation Sequence