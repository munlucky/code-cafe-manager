/**
 * Terminal Provider Adapter
 * Gap 1 해결: Terminal 실행 계약 및 Provider 매핑 정의
 *
 * 리팩토링: 인터페이스는 ./interfaces/에서 re-export
 */

import { ProviderType } from '@codecafe/core';
import { AdapterNotFoundError } from './errors.js';

// Re-export interfaces from the interfaces module
export type { IPty, IProviderAdapter } from './interfaces/index.js';
import type { IPty, IProviderAdapter } from './interfaces/index.js';

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

  async spawn(_options?: { cwd?: string }): Promise<IPty> {
    const mockPty: IPty = {
      pid: Math.floor(Math.random() * 10000),
      on: (_event: string, _listener: (...args: unknown[]) => void) => {
        // Mock event listener
      },
      once: (_event: string, _listener: (...args: unknown[]) => void) => {
        // Mock once listener
      },
      removeListener: (_event: string, _listener: (...args: unknown[]) => void) => {
        // Mock remove listener
      },
      write: (_data: string) => {
        // Mock write
      },
      kill: () => {
        // Mock kill
      },
      resize: (_cols: number, _rows: number) => {
        // Mock resize
      },
    };

    this.spawnedProcesses.add(mockPty.pid.toString());
    // Simulate async spawn
    await new Promise(resolve => setTimeout(resolve, 10));
    return mockPty;
  }

  async sendPrompt(_process: IPty, _prompt: string): Promise<boolean> {
    return true;
  }

  async readOutput(_process: IPty, _timeout: number, onData?: (data: string) => void): Promise<string> {
    const mockResponse = this.mockResponses.get('default') || 'Mock output';
    if (onData) onData(mockResponse);
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockResponse), 50);
    });
  }

  async waitForExit(_process: IPty, _timeout: number): Promise<number> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(0), 100);
    });
  }

  async kill(_process: IPty): Promise<void> {
    // No-op for mock
  }

  isAlive(_process: IPty): boolean {
    return true;
  }

  async execute(
    _process: IPty,
    _context: unknown,
    onData?: (data: string) => void
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    if (onData) onData('Mock execution started\n');
    if (onData) onData('Mock execution completed\n');
    return { success: true, output: 'Mock execution completed' };
  }

  onExit(process: IPty, handler: (event: { exitCode: number }) => void): void {
    // Store handler if needed for testing scenarios
    (process as unknown as { _exitHandler: typeof handler })._exitHandler = handler;
  }
}

/**
 * Provider Adapter Factory
 * Manages provider adapter instances and registration
 * Uses dynamic import to avoid circular dependencies
 */
export class ProviderAdapterFactory {
  private static adapters: Map<ProviderType, IProviderAdapter> = new Map();
  private static initialized = false;
  private static initPromise: Promise<void> | null = null;

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
   * Initialize and register default adapters using dynamic import
   * This prevents circular dependencies between provider-adapter and adapters
   */
  static initialize(): void {
    if (this.initialized) {
      return;
    }

    // Synchronous initialization for backward compatibility
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ClaudeCodeAdapter } = require('./adapters/claude-code-adapter.js');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CodexAdapter } = require('./adapters/codex-adapter.js');

    this.register('claude-code', new ClaudeCodeAdapter());
    this.register('codex', new CodexAdapter());
    this.initialized = true;
  }

  /**
   * Async initialization with dynamic import (preferred for ESM)
   */
  static async initializeAsync(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        const [claudeModule, codexModule] = await Promise.all([
          import('./adapters/claude-code-adapter.js'),
          import('./adapters/codex-adapter.js'),
        ]);

        this.register('claude-code', new claudeModule.ClaudeCodeAdapter());
        this.register('codex', new codexModule.CodexAdapter());
        this.initialized = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to initialize provider adapters: ${message}`);
      }
    })();

    return this.initPromise;
  }
}
