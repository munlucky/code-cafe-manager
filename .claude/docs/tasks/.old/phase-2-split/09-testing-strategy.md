# Testing Strategy

## 6. Testing Strategy

### 6.1 Unit Tests

**Terminal Pool Tests** (`packages/orchestrator/src/terminal/terminal-pool.test.ts`):
```typescript
describe('TerminalPool', () => {
  test('should spawn terminal with adapter', async () => {
    const pool = new TerminalPool(config);
    const terminal = await pool.spawn('claude-code');
    expect(terminal.status).toBe('idle');
    expect(terminal.provider).toBe('claude-code');
  });

  test('should lease and release terminal with token', async () => {
    const pool = new TerminalPool(config);
    const { terminal, token } = await pool.lease('claude-code');
    expect(terminal.status).toBe('busy');
    expect(token.terminalId).toBe(terminal.id);

    await pool.release(terminal, token);
    expect(terminal.status).toBe('idle');
    expect(terminal.leaseToken).toBeUndefined();
  });

  test('should handle concurrent leases with semaphore (Gap 2)', async () => {
    const pool = new TerminalPool({ perProvider: { 'claude-code': { size: 2, timeout: 5000, maxRetries: 3 } } });
    const promises = Array.from({ length: 5 }, () => pool.lease('claude-code'));
    const results = await Promise.all(promises);
    expect(results).toHaveLength(5);
  });

  test('should timeout on lease (Gap 2)', async () => {
    const pool = new TerminalPool({ perProvider: { 'claude-code': { size: 1, timeout: 100, maxRetries: 3 } } });
    await pool.lease('claude-code'); // 첫 번째 lease
    await expect(pool.lease('claude-code')).rejects.toThrow(TerminalLeaseTimeoutError);
  });

  test('should record p99 wait time (Gap 2)', async () => {
    const pool = new TerminalPool({ perProvider: { 'claude-code': { size: 2, timeout: 5000, maxRetries: 3 } } });

    // Lease 10 times
    for (let i = 0; i < 10; i++) {
      const { terminal, token } = await pool.lease('claude-code');
      await new Promise((r) => setTimeout(r, 50));
      await pool.release(terminal, token);
    }

    const metrics = pool.getMetrics();
    expect(metrics.providers['claude-code'].p99WaitTime).toBeGreaterThan(0);
  });
});
```

**Provider Adapter Tests** (`packages/orchestrator/src/terminal/adapters/claude-code-adapter.test.ts`):
```typescript
describe('ClaudeCodeAdapter (Gap 1)', () => {
  test('should spawn claude-code process', async () => {
    const adapter = new ClaudeCodeAdapter();
    const process = await adapter.spawn();
    expect(process).toBeDefined();
  });

  test('should send prompt and receive echo', async () => {
    const adapter = new ClaudeCodeAdapter();
    const process = await adapter.spawn();
    const success = await adapter.sendPrompt(process, 'test prompt');
    expect(success).toBe(true);
  });

  test('should read output until idle', async () => {
    const adapter = new ClaudeCodeAdapter();
    const process = await adapter.spawn();
    await adapter.sendPrompt(process, 'echo "hello"');
    const output = await adapter.readOutput(process, 5000);
    expect(output).toContain('hello');
  });
});
```

**Crash Recovery Tests** (`packages/orchestrator/src/terminal/terminal-pool.crash.test.ts`):
- See Section 2.7.4 for complete implementation

**Role Registry Tests** (`packages/orchestrator/src/role/role-registry.test.ts`):
```typescript
describe('RoleRegistry', () => {
  test('should load default roles + generic-agent (Gap 4)', async () => {
    const registry = new RoleRegistry();
    await registry.load();
    expect(registry.listDefault()).toHaveLength(5); // 4 + generic-agent
  });

  test('should parse role markdown', async () => {
    const parser = new RoleParser();
    const role = await parser.parse('packages/roles/planner.md', true);
    expect(role.id).toBe('planner');
    expect(role.skills).toContain('read_file');
  });

  test('should validate role template', async () => {
    const parser = new RoleParser();
    const role = await parser.parse('packages/roles/planner.md', true);
    const validation = parser.validate(role);
    expect(validation.valid).toBe(true);
  });
});
```

**Barista Engine Tests** (`packages/orchestrator/src/barista/barista-engine-v2.test.ts`):
```typescript
describe('BaristaEngineV2 (Gap 4)', () => {
  test('should render prompt with variables', () => {
    const role = { systemPrompt: 'Task: {{task}}', ... };
    const barista = { role, ... };
    const engine = new BaristaEngineV2(pool, adapters);
    const prompt = engine['renderPrompt'](role, { task: 'test' });
    expect(prompt).toBe('Task: test');
  });

  test('should execute step with terminal lease + adapter (Gap 1)', async () => {
    const engine = new BaristaEngineV2(pool, adapters);
    const barista = createMockBarista();
    const order = createMockOrder();
    const step = createMockStep();

    const result = await engine.executeStep(barista, order, step, { task: 'test' });
    expect(result.status).toBe('success');
  });

  test('should retry on terminal crash (Gap 5)', async () => {
    const engine = new BaristaEngineV2(pool, adapters);
    // Mock terminal to crash on first attempt
    vi.spyOn(pool, 'lease').mockRejectedValueOnce(new TerminalCrashedError('term-1'));

    const result = await engine.executeStep(barista, order, step, { task: 'test' });
    expect(result.status).toBe('success'); // Retry succeeded
  });
});
```

### 6.2 Integration Tests

**End-to-End Order Execution** (`packages/orchestrator/test/integration/order-execution.test.ts`):
```typescript
describe('Order Execution Integration', () => {
  test('should execute order with role-based baristas', async () => {
    // 1. Initialize TerminalPool
    const pool = new TerminalPool(config);

    // 2. Load RoleRegistry
    const registry = new RoleRegistry();
    await registry.load();

    // 3. Create Barista with Role
    const role = registry.get('planner');
    const manager = new BaristaManager(10, registry);
    const barista = manager.createBarista('planner');

    // 4. Execute Order
    const engine = new BaristaEngineV2(pool, new AdapterRegistry());
    const result = await engine.executeStep(barista, order, step, variables);

    expect(result.status).toBe('success');
    expect(barista.terminalId).toBeNull(); // Released
  });

  test('should execute legacy order with generic-agent (Gap 4)', async () => {
    const pool = new TerminalPool(config);
    const registry = new RoleRegistry();
    await registry.load();

    const manager = new BaristaManager(10, registry);
    const barista = manager.createBarista(); // No roleId → generic-agent

    const engine = new BaristaEngineV2(pool, new AdapterRegistry());
    const adapter = new LegacyBaristaAdapter(engine);

    const result = await adapter.executeLegacyStep(barista, legacyOrder, legacyStep);
    expect(result.status).toBe('success');
  });
});
```

### 6.3 Load Tests

**Terminal Pool Concurrency** (`packages/orchestrator/test/load/terminal-pool-load.test.ts`):
- See Section 2.4.4 for complete implementation

### 6.4 UI Tests

**Role Manager UI** (`packages/desktop/src/renderer/components/role/RoleManager.test.tsx`):
```tsx
import { render, screen } from '@testing-library/react';
import { RoleManager } from './RoleManager';

test('renders default roles + generic-agent (Gap 4)', async () => {
  render(<RoleManager />);
  expect(await screen.findByText('Planner')).toBeInTheDocument();
  expect(await screen.findByText('Coder')).toBeInTheDocument();
  expect(await screen.findByText('Generic Agent')).toBeInTheDocument();
});

test('shows error when role load fails (Gap 3)', async () => {
  // Mock IPC to return error
  window.api.role.list = vi.fn().mockResolvedValue({
    success: false,
    error: { code: 'ROLE_UNKNOWN_ERROR', message: 'Network error' },
  });

  render(<RoleManager />);
  expect(await screen.findByText(/Failed to load roles/)).toBeInTheDocument();
});
```

---

**다음 문서:** [10-verification-checkpoints.md](10-verification-checkpoints.md) - Verification Checkpoints