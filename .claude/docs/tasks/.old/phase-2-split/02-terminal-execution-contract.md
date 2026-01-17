# Terminal Execution Contract & Provider Mapping (NEW - Gap 1 해결)

#### 2.3.1 IProviderAdapter Interface (Updated - Gap 3 해결)

**목적**: ProviderType과 실제 프로세스 spawn 명령어를 매핑하고, 프롬프트 전송/결과 읽기 프로토콜을 정의

**핵심 개선 (Gap 3):**
- **Mockable interface**: 테스트를 위한 `MockProviderAdapter` 추가
- **Deterministic tests**: 실제 CLI 프로세스 없이도 단위 테스트 가능
- **CI-friendly**: 환경 변수로 실제/모드 전환 가능

**파일**: `packages/orchestrator/src/terminal/provider-adapter.ts`

```typescript
import { IPty } from 'node-pty';

export interface IProviderAdapter {
  /**
   * Provider 타입 식별자
   */
  readonly providerType: ProviderType;

  /**
   * PTY 프로세스 생성
   * @returns node-pty IPty 인스턴스
   */
  spawn(): Promise<IPty>;

  /**
   * 프롬프트를 터미널에 전송
   * @param process - node-pty 프로세스
   * @param prompt - 전송할 프롬프트 (Handlebars 렌더링 완료)
   * @returns 전송 성공 여부
   */
  sendPrompt(process: IPty, prompt: string): Promise<boolean>;

  /**
   * 터미널 출력 읽기 (비동기 스트림)
   * @param process - node-pty 프로세스
   * @param timeout - 읽기 타임아웃 (ms)
   * @returns 출력 문자열
   */
  readOutput(process: IPty, timeout: number): Promise<string>;

  /**
   * 프로세스 정상 종료 확인
   * @param process - node-pty 프로세스
   * @returns 종료 코드 (0 = 성공)
   */
  waitForExit(process: IPty, timeout: number): Promise<number>;
}

export interface SpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
}

/**
 * Mockable adapter for testing (Gap 3 해결)
 */
export class MockProviderAdapter implements IProviderAdapter {
  readonly providerType = 'mock' as const;
  private responses: Map<string, string> = new Map();
  private spawnCount = 0;

  constructor(private mockResponses?: Record<string, string>) {
    if (mockResponses) {
      Object.entries(mockResponses).forEach(([prompt, response]) => {
        this.responses.set(prompt, response);
      });
    }
  }

  async spawn(options?: SpawnOptions): Promise<IPty> {
    this.spawnCount++;
    // Return mock IPty object
    return {
      pid: 9999 + this.spawnCount,
      cols: options?.cols || 80,
      rows: options?.rows || 24,
      write: (data: string) => {
        console.log(`Mock write: ${data.substring(0, 50)}...`);
        return true;
      },
      kill: (signal?: string | number) => {
        console.log(`Mock kill: ${signal}`);
      },
      onData: (callback: (data: string) => void) => {
        // Mock data handler
        return { dispose: () => {} };
      },
      onExit: (callback: (exitCode: number) => void) => {
        // Mock exit handler
        return { dispose: () => {} };
      },
      resize: (cols: number, rows: number) => {
        console.log(`Mock resize: ${cols}x${rows}`);
      },
    } as any;
  }

  async sendPrompt(process: IPty, prompt: string): Promise<boolean> {
    console.log(`Mock sendPrompt: ${prompt.substring(0, 50)}...`);
    return true;
  }

  async readOutput(process: IPty, timeout: number): Promise<string> {
    // Return mock response based on prompt
    const prompt = 'mock-prompt'; // In real test, we'd track the prompt
    const response = this.responses.get(prompt) || 'Mock response';
    return response;
  }

  async waitForExit(process: IPty, timeout: number): Promise<number> {
    return 0; // Success
  }

  getSpawnCount(): number {
    return this.spawnCount;
  }
}

/**
 * Adapter factory that switches between real and mock based on environment
 */
export class AdapterFactory {
  static create(providerType: ProviderType, useMock = process.env.NODE_ENV === 'test'): IProviderAdapter {
    if (useMock) {
      return new MockProviderAdapter();
    }

    switch (providerType) {
      case 'claude-code':
        return new ClaudeCodeAdapter();
      case 'codex':
        return new CodexAdapter();
      default:
        throw new Error(`Unsupported provider type: ${providerType}`);
    }
  }
}
```

#### 2.3.2 Concrete Adapters

##### ClaudeCodeAdapter

**파일**: `packages/orchestrator/src/terminal/adapters/claude-code-adapter.ts`

```typescript
import { spawn, IPty } from 'node-pty';
import { IProviderAdapter, SpawnOptions } from '../provider-adapter.js';

export class ClaudeCodeAdapter implements IProviderAdapter {
  readonly providerType = 'claude-code' as const;

  async spawn(options?: SpawnOptions): Promise<IPty> {
    const process = spawn('claude', [], {
      name: 'xterm-color',
      cwd: options?.cwd || process.cwd(),
      env: {
        ...process.env,
        ...options?.env,
        // Force interactive mode
        TERM: 'xterm-256color',
      },
      cols: options?.cols || 120,
      rows: options?.rows || 30,
    });

    // Wait for initialization prompt (e.g., "claude>")
    await this.waitForPrompt(process, 5000);

    return process;
  }

  async sendPrompt(process: IPty, prompt: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      let written = false;

      const onData = (data: string) => {
        // Detect echo confirmation
        if (data.includes(prompt.substring(0, 20))) {
          written = true;
          process.off('data', onData);
          resolve(true);
        }
      };

      process.on('data', onData);

      // Send prompt with newline
      process.write(prompt + '\r\n');

      // Timeout fallback
      setTimeout(() => {
        process.off('data', onData);
        if (!written) reject(new Error('Prompt send timeout'));
      }, 5000);
    });
  }

  async readOutput(process: IPty, timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      let output = '';
      let lastDataTime = Date.now();

      const onData = (data: string) => {
        output += data;
        lastDataTime = Date.now();
      };

      process.on('data', onData);

      // Check for completion (idle for 500ms or explicit marker)
      const checkInterval = setInterval(() => {
        const idleTime = Date.now() - lastDataTime;

        if (idleTime > 500 || output.includes('[DONE]')) {
          clearInterval(checkInterval);
          clearTimeout(timeoutHandle);
          process.off('data', onData);
          resolve(output);
        }
      }, 100);

      // Overall timeout
      const timeoutHandle = setTimeout(() => {
        clearInterval(checkInterval);
        process.off('data', onData);
        reject(new Error(`Read timeout after ${timeout}ms`));
      }, timeout);
    });
  }

  async waitForExit(process: IPty, timeout: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const onExit = ({ exitCode }: { exitCode: number }) => {
        clearTimeout(timeoutHandle);
        resolve(exitCode);
      };

      process.once('exit', onExit);

      const timeoutHandle = setTimeout(() => {
        process.off('exit', onExit);
        reject(new Error('Exit wait timeout'));
      }, timeout);
    });
  }

  private async waitForPrompt(process: IPty, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const onData = (data: string) => {
        if (data.includes('claude>') || data.includes('ready')) {
          clearTimeout(timeoutHandle);
          process.off('data', onData);
          resolve();
        }
      };

      process.on('data', onData);

      const timeoutHandle = setTimeout(() => {
        process.off('data', onData);
        reject(new Error('Initialization timeout'));
      }, timeout);
    });
  }
}
```

##### CodexAdapter

**파일**: `packages/orchestrator/src/terminal/adapters/codex-adapter.ts`

```typescript
import { spawn, IPty } from 'node-pty';
import { IProviderAdapter, SpawnOptions } from '../provider-adapter.js';

export class CodexAdapter implements IProviderAdapter {
  readonly providerType = 'codex' as const;

  async spawn(options?: SpawnOptions): Promise<IPty> {
    const process = spawn('codex', ['--interactive'], {
      name: 'xterm-color',
      cwd: options?.cwd || process.cwd(),
      env: {
        ...process.env,
        ...options?.env,
      },
      cols: options?.cols || 120,
      rows: options?.rows || 30,
    });

    // Wait for Codex initialization
    await this.waitForPrompt(process, 5000);

    return process;
  }

  async sendPrompt(process: IPty, prompt: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      // Codex uses stdin-based protocol
      process.write(JSON.stringify({ type: 'prompt', content: prompt }) + '\n');

      const onData = (data: string) => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'ack') {
            process.off('data', onData);
            resolve(true);
          }
        } catch {
          // Ignore non-JSON output
        }
      };

      process.on('data', onData);

      setTimeout(() => {
        process.off('data', onData);
        reject(new Error('Codex prompt send timeout'));
      }, 5000);
    });
  }

  async readOutput(process: IPty, timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      let output = '';

      const onData = (data: string) => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'output') {
            output += parsed.content;
          } else if (parsed.type === 'done') {
            process.off('data', onData);
            clearTimeout(timeoutHandle);
            resolve(output);
          }
        } catch {
          // Accumulate raw output
          output += data;
        }
      };

      process.on('data', onData);

      const timeoutHandle = setTimeout(() => {
        process.off('data', onData);
        reject(new Error('Codex read timeout'));
      }, timeout);
    });
  }

  async waitForExit(process: IPty, timeout: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const onExit = ({ exitCode }: { exitCode: number }) => {
        clearTimeout(timeoutHandle);
        resolve(exitCode);
      };

      process.once('exit', onExit);

      const timeoutHandle = setTimeout(() => {
        process.off('exit', onExit);
        reject(new Error('Codex exit wait timeout'));
      }, timeout);
    });
  }

  private async waitForPrompt(process: IPty, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const onData = (data: string) => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'ready') {
            clearTimeout(timeoutHandle);
            process.off('data', onData);
            resolve();
          }
        } catch {
          // Ignore non-JSON
        }
      };

      process.on('data', onData);

      const timeoutHandle = setTimeout(() => {
        process.off('data', onData);
        reject(new Error('Codex initialization timeout'));
      }, timeout);
    });
  }
}
```

#### 2.3.3 Adapter Registry

**파일**: `packages/orchestrator/src/terminal/adapter-registry.ts`

```typescript
import { IProviderAdapter } from './provider-adapter.js';
import { ClaudeCodeAdapter } from './adapters/claude-code-adapter.js';
import { CodexAdapter } from './adapters/codex-adapter.js';
import { ProviderType } from '@codecafe/core/types';

export class AdapterRegistry {
  private adapters: Map<ProviderType, IProviderAdapter> = new Map();

  constructor() {
    this.register(new ClaudeCodeAdapter());
    this.register(new CodexAdapter());
  }

  register(adapter: IProviderAdapter): void {
    this.adapters.set(adapter.providerType, adapter);
  }

  get(providerType: ProviderType): IProviderAdapter {
    const adapter = this.adapters.get(providerType);
    if (!adapter) {
      throw new Error(`No adapter registered for provider: ${providerType}`);
    }
    return adapter;
  }

  has(providerType: ProviderType): boolean {
    return this.adapters.has(providerType);
  }
}
```

#### 2.3.4 stdin/stdout Protocol Summary

| Provider | Protocol | Prompt Format | Output Format | Done Signal |
|----------|----------|---------------|---------------|-------------|
| claude-code | Text-based | Plain text + `\r\n` | Raw stdout | Idle 500ms |
| codex | JSON-based | `{"type":"prompt","content":"..."}` | `{"type":"output","content":"..."}` | `{"type":"done"}` |

**파일 위치:**
- `packages/orchestrator/src/terminal/provider-adapter.ts` (Interface)
- `packages/orchestrator/src/terminal/adapters/claude-code-adapter.ts`
- `packages/orchestrator/src/terminal/adapters/codex-adapter.ts`
- `packages/orchestrator/src/terminal/adapter-registry.ts`

---

**다음 문서:** [03-terminal-pool-concurrency.md](03-terminal-pool-concurrency.md) - TerminalPool Concurrency Model