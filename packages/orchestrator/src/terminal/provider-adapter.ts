/**
 * Terminal Provider Adapter Interface
 * Gap 1 해결: Terminal 실행 계약 및 Provider 매핑 정의
 */

import { ProviderType } from '@codecafe/core';
import { ClaudeCodeAdapter } from './adapters/claude-code-adapter.js';
import { CodexAdapter } from './adapters/codex-adapter.js';
import { AdapterNotFoundError } from './errors.js';

/**
 * Minimal interface for node-pty process to ensure type safety
 */
export interface IPty {
  pid: number;
  write(data: string): void;
  on(event: string, listener: (...args: any[]) => void): void;
  once(event: string, listener: (...args: any[]) => void): void;
  removeListener(event: string, listener: (...args: any[]) => void): void;
  kill(signal?: string): void;
  resize?(cols: number, rows: number): void;
}

export interface IProviderAdapter {
  /**
   * Provider type identifier
   */
  readonly providerType: ProviderType;

  /**
   * Create a new PTY process
   * @param options - Spawn options (cwd, etc.)
   * @returns node-pty IPty instance
   */
  spawn(options?: { cwd?: string }): Promise<IPty>;

  /**
   * Send prompt to the terminal
   * @param process - node-pty process
   * @param prompt - Prompt to send (already rendered)
   * @returns True if sent successfully
   */
  sendPrompt(process: IPty, prompt: string): Promise<boolean>;

  /**
   * Read output from the terminal
   * @param process - node-pty process
   * @param timeout - Read timeout in ms
   * @returns Output string
   */
  /**
   * Read output from the terminal
   * @param process - node-pty process
   * @param timeout - Read timeout in ms
   * @param onData - Optional callback for streaming data chunks
   * @returns Output string
   */
  readOutput(process: IPty, timeout: number, onData?: (data: string) => void): Promise<string>;

  /**
   * Wait for process to exit
   * @param process - node-pty process
   * @param timeout - Timeout in ms
   * @returns Exit code (0 = success)
   */
  waitForExit(process: IPty, timeout: number): Promise<number>;

  /**
   * Terminate the process
   * @param process - node-pty process
   */
  kill(process: IPty): Promise<void>;

  /**
   * Check if process is running
   * @param process - node-pty process
   */
  isAlive(process: IPty): boolean;

  /**
   * Execute command with context
   * @param process - node-pty process
   * @param context - Execution context
   * @param onData - Optional callback for streaming output
   */
  execute(
    process: IPty,
    context: any,
    onData?: (data: string) => void
  ): Promise<{ success: boolean; output?: string; error?: string }>;

  /**
   * Register exit handler
   * @param process - node-pty process
   * @param handler - Function to call on exit
   */
  onExit(process: IPty, handler: (event: { exitCode: number }) => void): void;
}

/**
 * Mock Provider Adapter for testing
 * Provides deterministic behavior without spawning real processes
 */
export class MockProviderAdapter implements IProviderAdapter {
  readonly providerType: ProviderType;
  private mockResponses: Map<string, string> = new Map();
  private spawnedProcesses: Set<string> = new Set();

  constructor(providerType: ProviderType) {
    this.providerType = providerType;
  }

  setMockResponse(prompt: string, response: string): void {
    this.mockResponses.set(prompt, response);
  }

  async spawn(options?: { cwd?: string }): Promise<IPty> {
    const mockPty: IPty = {
      pid: Math.floor(Math.random() * 10000),
      on: (event: string, listener: Function) => {
        // Mock event listener
      },
      once: (event: string, listener: Function) => {
        // Mock once listener
      },
      removeListener: (event: string, listener: Function) => {
        // Mock remove listener
      },
      write: (data: string) => {
        // Mock write
      },
      kill: () => {
        // Mock kill
      },
      resize: (cols: number, rows: number) => {
        // Mock resize
      },
    };

    this.spawnedProcesses.add(mockPty.pid.toString());
    // Simulate async spawn
    await new Promise(resolve => setTimeout(resolve, 10));
    return mockPty;
  }

  async sendPrompt(process: IPty, prompt: string): Promise<boolean> {
    return true;
  }

  async readOutput(process: IPty, timeout: number, onData?: (data: string) => void): Promise<string> {
    const mockResponse = this.mockResponses.get('default') || 'Mock output';
    if (onData) onData(mockResponse);
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
    // No-op for mock
  }

  isAlive(process: IPty): boolean {
    return true;
  }

  async execute(
    process: IPty,
    context: any,
    onData?: (data: string) => void
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    if (onData) onData('Mock execution started\n');
    if (onData) onData('Mock execution completed\n');
    return { success: true, output: 'Mock execution completed' };
  }

  onExit(process: IPty, handler: (event: { exitCode: number }) => void): void {
    // Store handler if needed for testing scenarios
    (process as any)._exitHandler = handler;
  }
}

/**
 * Provider Adapter Factory
 * Manages provider adapter instances and registration
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
   * Create or retrieve an adapter instance
   * @param providerType - The type of provider to get
   * @param useMock - Force use of mock adapter (defaults to true in test env)
   */
  static create(providerType: ProviderType, useMock?: boolean): IProviderAdapter {
    const shouldUseMock = useMock ?? (process.env.NODE_ENV === 'test');

    if (shouldUseMock) {
      return new MockProviderAdapter(providerType);
    }

    if (!this.initialized) {
      this.initialize();
    }

    return this.get(providerType);
  }

  /**
   * Initialize and register default adapters
   */
  static initialize(): void {
    if (this.initialized) {
      return;
    }

    try {
      this.register('claude-code', new ClaudeCodeAdapter());
      this.register('codex', new CodexAdapter());
      this.initialized = true;
    } catch (error) {
      // Re-throw with clear context
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize provider adapters: ${message}`);
    }
  }
}