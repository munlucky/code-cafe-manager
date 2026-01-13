/**
 * Terminal Provider Adapter Interface
 * Gap 1 해결: Terminal 실행 계약 및 Provider 매핑 정의
 */

// import { IPty } from 'node-pty';
type IPty = any;
import { ProviderType } from '@codecafe/core';
import { ClaudeCodeAdapter } from './adapters/claude-code-adapter.js';
import { CodexAdapter } from './adapters/codex-adapter.js';
import { AdapterNotFoundError } from './errors.js';

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

  /**
   * 프로세스 강제 종료
   * @param process - node-pty 프로세스
   */
  kill(process: IPty): Promise<void>;

  /**
   * 프로세스 상태 확인
   * @param process - node-pty 프로세스
   * @returns 프로세스가 살아있는지 여부
   */
  isAlive(process: IPty): boolean;

  /**
   * Phase 2: Execute command with context
   * @param process - node-pty 프로세스
   * @param context - Execution context
   * @returns Execution result
   */
  execute(process: IPty, context: any): Promise<{ success: boolean; output?: string; error?: string }>;

  /**
   * Phase 2: Setup exit handler
   * @param process - node-pty 프로세스
   * @param handler - Exit handler
   */
  onExit(process: IPty, handler: (event: { exitCode: number }) => void): void;
}

/**
 * Mock Provider Adapter for testing
 * Gap 3 해결: Deterministic tests without real CLI processes
 */
export class MockProviderAdapter implements IProviderAdapter {
  readonly providerType: ProviderType;
  private mockResponses: Map<string, string> = new Map();
  private spawnedProcesses: Set<string> = new Set();

  constructor(providerType: ProviderType) {
    this.providerType = providerType;
  }

  /**
   * Set mock response for a specific prompt
   */
  setMockResponse(prompt: string, response: string): void {
    this.mockResponses.set(prompt, response);
  }

  async spawn(): Promise<IPty> {
    const mockPty = {
      pid: Math.floor(Math.random() * 10000),
      onData: (callback: (data: string) => void) => {
        // Mock data handler
        setTimeout(() => callback('Mock terminal ready\n'), 10);
      },
      write: (data: string) => {
        console.log(`Mock write: ${data}`);
      },
      kill: () => {
        console.log('Mock kill');
      },
      resize: (cols: number, rows: number) => {
        console.log(`Mock resize: ${cols}x${rows}`);
      },
    } as unknown as IPty;

    this.spawnedProcesses.add(mockPty.pid.toString());
    return mockPty;
  }

  async sendPrompt(process: IPty, prompt: string): Promise<boolean> {
    console.log(`Mock sendPrompt: ${prompt.substring(0, 50)}...`);
    return true;
  }

  async readOutput(process: IPty, timeout: number): Promise<string> {
    const mockResponse = this.mockResponses.get('default') || 'Mock output';
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockResponse), 50);
    });
  }

  async waitForExit(process: IPty, timeout: number): Promise<number> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(0), 100);
    });
  }

  async kill(process: IPty): Promise<void> {
    console.log('Mock kill called');
  }

  isAlive(process: IPty): boolean {
    return true;
  }

  async execute(process: IPty, context: any): Promise<{ success: boolean; output?: string; error?: string }> {
    console.log(`Mock execute: ${JSON.stringify(context).substring(0, 100)}...`);
    return { success: true, output: 'Mock execution completed' };
  }

  onExit(process: IPty, handler: (event: { exitCode: number }) => void): void {
    console.log('Mock onExit handler registered');
    // Store handler for later triggering
    (process as any)._exitHandler = handler;
  }
}

/**
 * Provider Adapter Factory
 */
export class ProviderAdapterFactory {
  private static adapters: Map<ProviderType, IProviderAdapter> = new Map();
  private static initialized = false;

  static register(providerType: ProviderType, adapter: IProviderAdapter): void {
    this.adapters.set(providerType, adapter);
  }

  static get(providerType: ProviderType): IProviderAdapter {
    const adapter = this.adapters.get(providerType);
    if (!adapter) {
      throw new AdapterNotFoundError(providerType);
    }
    return adapter;
  }

  static has(providerType: ProviderType): boolean {
    return this.adapters.has(providerType);
  }

  /**
   * Create adapter with optional mock mode
   * @param providerType - Provider type
   * @param useMock - Use mock adapter (default: true in test environment)
   * @returns Provider adapter instance
   */
  static create(providerType: ProviderType, useMock?: boolean): IProviderAdapter {
    const shouldUseMock = useMock ?? (process.env.NODE_ENV === 'test');

    if (shouldUseMock) {
      return new MockProviderAdapter(providerType);
    }

    // Return real adapter (must be initialized first)
    return this.get(providerType);
  }

  /**
   * Initialize factory with real adapters
   * Automatically registers ClaudeCodeAdapter and CodexAdapter
   */
  static initialize(): void {
    if (this.initialized) {
      return;
    }

    // Register real adapters
    try {
      this.register('claude-code', new ClaudeCodeAdapter());
      this.register('codex', new CodexAdapter());
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize adapters:', error);
      throw error;
    }
  }
}