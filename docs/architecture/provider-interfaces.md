# Provider Interfaces Architecture

## Overview

CodeCafe uses a two-layer abstraction for provider execution:

1. **IProvider** (High-level) - CLI process execution abstraction
2. **IProviderAdapter** (Low-level) - PTY-based terminal execution abstraction

## IProvider Interface

**Location**: `@codecafe/providers-common`

**Purpose**: Abstract CLI-based AI provider execution (Claude Code, Codex, etc.)

```typescript
interface IProvider {
  /**
   * Run the provider with given options
   */
  run(options: ProviderRunOptions): Promise<void>;

  /**
   * Send input to running provider
   */
  sendInput(message: string): Promise<void>;

  /**
   * Kill the provider process
   */
  kill(): Promise<void>;

  /**
   * Event emitter for process events
   */
  on(event: 'data', handler: (data: string) => void): void;
  on(event: 'exit', handler: (info: { exitCode: number; signal?: number }) => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
}
```

**Responsibilities**:
- Spawn CLI processes (`claude`, `codex`, etc.)
- Handle process lifecycle (start, stop, cleanup)
- Emit stdout/stderr as data events
- Handle process exit codes and signals

**Implementations**:
- `ClaudeCodeProvider` - Runs `claude` CLI
- `CodexProvider` - Runs `codex` CLI

## IProviderAdapter Interface

**Location**: `@codecafe/orchestrator/src/terminal`

**Purpose**: Abstract PTY-based terminal execution for multi-terminal orchestration

```typescript
interface IProviderAdapter {
  /**
   * Execute command with PTY
   */
  execute(context: ExecutionContext): Promise<ExecutionResult>;

  /**
   * Kill the PTY process
   */
  kill(process: ProcessHandle): Promise<void>;

  /**
   * Create PTY instance
   */
  createPty(): Promise<PtyInstance>;
}
```

**Responsibilities**:
- Create PTY (pseudo-terminal) instances
- Handle terminal I/O (stdin/stdout/stderr via PTY)
- Manage process groups for signal propagation
- Support multi-terminal coordination

**Implementations**:
- `ClaudeCodeAdapter` - PTY adapter for Claude Code
- `CodexAdapter` - PTY adapter for Codex

## Architecture Comparison

| Aspect | IProvider | IProviderAdapter |
|--------|-----------|------------------|
| **Abstraction Level** | High (CLI process) | Low (PTY terminal) |
| **Use Case** | Single provider execution | Multi-terminal orchestration |
| **Event Model** | Event emitter (data, exit, error) | Promise-based (execute, kill) |
| **Terminal Control** | Standard process I/O | Full PTY control |
| **Multi-terminal** | No (single process) | Yes (coordinated groups) |
| **Session Management** | No | Yes (via CafeSessionManager) |

## When to Use Each

### Use IProvider when:
- Running a single AI provider command
- Simple CLI interaction needed
- Event-based output handling sufficient
- Example: `codecafe run --issue "fix bug"`

### Use IProviderAdapter when:
- Orchestrating multiple terminals
- PTY-level control required
- Session-based execution needed
- Example: Moonshot workflow with multiple stages

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         IProvider Layer                             │
│  (CLI process execution - single provider)                          │
│                                                                      │
│  [ClaudeCodeProvider.run()]  ──►  spawn('claude', [args])          │
│         │                                                            │
│         ├──► stdout.pipe(process.stdout)                             │
│         ├──► 'data' event → CLI output                               │
│         └──► 'exit' event → cleanup                                  │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       IProviderAdapter Layer                         │
│  (PTY terminal execution - multi-terminal orchestration)             │
│                                                                      │
│  [ClaudeCodeAdapter.execute()]  ──►  node-pty.spawn('claude')       │
│         │                                                            │
│         ├──► Pty data → OrderSession.output event                   │
│         ├──► TerminalGroup coordination                             │
│         └──► Multi-terminal shared context                          │
└─────────────────────────────────────────────────────────────────────┘
```

## Integration Points

### CLI Commands (IProvider)
```typescript
// packages/cli/src/commands/run.ts
const provider = new ClaudeCodeProvider();
provider.on('data', (data) => console.log(data));
await provider.run({ workingDirectory, prompt });
```

### Orchestrator (IProviderAdapter)
```typescript
// packages/orchestrator/src/terminal/
const adapter = ProviderAdapterFactory.get('claude-code');
await adapter.execute(context, { cwd, env });
```

## Migration Notes

- **IProvider** remains the interface for simple CLI commands
- **IProviderAdapter** is used by `CafeSessionManager` for workflow orchestration
- Both interfaces coexist for different use cases
- Future providers should implement both interfaces

## Related Files

- `packages/providers/common/src/provider.ts` - IProvider interface
- `packages/orchestrator/src/terminal/provider-adapter.ts` - IProviderAdapter interface
- `packages/orchestrator/src/terminal/adapters/claude-code-adapter.ts` - Claude adapter
- `packages/orchestrator/src/terminal/adapters/codex-adapter.ts` - Codex adapter
