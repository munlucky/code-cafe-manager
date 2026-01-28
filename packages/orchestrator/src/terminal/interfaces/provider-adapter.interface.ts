/**
 * Terminal Provider Adapter Interface
 * Gap 1 해결: Terminal 실행 계약 및 Provider 매핑 정의
 */

import { ProviderType } from '@codecafe/core';

/**
 * Minimal interface for node-pty process to ensure type safety
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface IPty {
  pid: number;
  write(data: string): void;
  on(event: string, listener: (...args: any[]) => void): void;
  once(event: string, listener: (...args: any[]) => void): void;
  removeListener(event: string, listener: (...args: any[]) => void): void;
  kill(signal?: string): void;
  resize?(cols: number, rows: number): void;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

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
    context: unknown,
    onData?: (data: string) => void
  ): Promise<{ success: boolean; output?: string; error?: string }>;

  /**
   * Register exit handler
   * @param process - node-pty process
   * @param handler - Function to call on exit
   */
  onExit(process: IPty, handler: (event: { exitCode: number }) => void): void;
}
