/**
 * Claude Code CLI Adapter
 * Implements text-based protocol for claude CLI
 */

import * as pty from 'node-pty';
import { ProviderType } from '@codecafe/core';
import { IProviderAdapter } from '../provider-adapter';
import { ProviderSpawnError } from '../errors';

// Define minimal interface for node-pty to improve type safety
interface IPtyProcess {
  pid: number;
  write(data: string): void;
  on(event: string, listener: (...args: any[]) => void): void;
  once(event: string, listener: (...args: any[]) => void): void;
  removeListener(event: string, listener: (...args: any[]) => void): void;
  kill(signal?: string): void;
}

// Configuration constants
const CONFIG = {
  IDLE_TIMEOUT: 500,
  WAIT_TIMEOUT: 5000,
  EXECUTE_TIMEOUT: 30000,
  TERM_COLS: 120,
  TERM_ROWS: 30,
  CHECK_STR_LEN: 20,
} as const;

export class ClaudeCodeAdapter implements IProviderAdapter {
  readonly providerType: ProviderType = 'claude-code';

  /**
   * Spawn claude CLI process
   */
  async spawn(): Promise<IPtyProcess> {
    try {
      const spawnOptions = {
        name: 'xterm-color',
        cwd: process.cwd(),
        env: {
          ...process.env,
          TERM: 'xterm-256color',
        },
        cols: CONFIG.TERM_COLS,
        rows: CONFIG.TERM_ROWS,
      };
      const ptyProcess = pty.spawn('claude', [], spawnOptions);

      // Wait for initialization prompt
      await this.waitForPrompt(ptyProcess, CONFIG.WAIT_TIMEOUT);

      return ptyProcess;
    } catch (error) {
      throw new ProviderSpawnError(
        'claude-code',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Send prompt to terminal with escaping
   */
  async sendPrompt(ptyProcess: IPtyProcess, prompt: string): Promise<boolean> {
    const escapedPrompt = prompt.replace(/\r/g, '\\r').replace(/\n/g, '\\n');
    const checkStr = escapedPrompt.substring(0, Math.min(CONFIG.CHECK_STR_LEN, escapedPrompt.length));

    return ClaudeCodeAdapter._createEventPromise<boolean>(
      ptyProcess,
      'data',
      CONFIG.WAIT_TIMEOUT,
      'Prompt send timeout',
      (data: string, resolve, reject, cleanup) => {
        if (data.includes(checkStr)) {
          cleanup();
          resolve(true);
        }
      },
      false,
      () => ptyProcess.write(escapedPrompt + '\r\n')
    );
  }

  /**
   * Read output with idle detection
   */
  async readOutput(ptyProcess: IPtyProcess, timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      let output = '';
      let idleTimer: NodeJS.Timeout | null = null;

      const cleanup = () => {
        if (idleTimer) clearTimeout(idleTimer);
        clearTimeout(timeoutHandle);
        ptyProcess.removeListener('data', onData);
      };

      const complete = () => {
        cleanup();
        resolve(output.trim());
      };

      const onData = (data: string) => {
        output += data;

        // Reset idle timer on new data
        if (idleTimer) clearTimeout(idleTimer);

        // Check for explicit completion marker or setup idle check
        if (output.includes('[DONE]')) {
          complete();
        } else {
          idleTimer = setTimeout(complete, CONFIG.IDLE_TIMEOUT);
        }
      };

      const timeoutHandle = setTimeout(() => {
        cleanup();
        reject(new Error(`Read timeout after ${timeout}ms`));
      }, timeout);

      ptyProcess.on('data', onData);
    });
  }

  /**
   * Wait for process exit
   */
  async waitForExit(ptyProcess: IPtyProcess, timeout: number): Promise<number> {
    return ClaudeCodeAdapter._createEventPromise<number>(
      ptyProcess,
      'exit',
      timeout,
      `Exit wait timeout after ${timeout}ms`,
      (event: { exitCode: number }, resolve, reject, cleanup) => {
        cleanup();
        resolve(event.exitCode);
      },
      true
    );
  }

  /**
   * Kill process
   */
  async kill(ptyProcess: IPtyProcess): Promise<void> {
    ptyProcess.kill();
  }

  /**
   * Check if process is alive
   */
  isAlive(ptyProcess: IPtyProcess): boolean {
    return ptyProcess.pid > 0;
  }

  /**
   * Execute command with context
   */
  async execute(
    ptyProcess: IPtyProcess,
    context: any
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    try {
      const prompt = typeof context === 'string' ? context : JSON.stringify(context);

      await this.sendPrompt(ptyProcess, prompt);
      const output = await this.readOutput(ptyProcess, CONFIG.EXECUTE_TIMEOUT);

      return { success: true, output };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Setup exit handler
   */
  onExit(ptyProcess: IPtyProcess, handler: (event: { exitCode: number }) => void): void {
    ptyProcess.on('exit', (exitCode: number) => {
      handler({ exitCode });
    });
  }

  /**
   * Wait for initialization prompt
   */
  private async waitForPrompt(ptyProcess: IPtyProcess, timeout: number): Promise<void> {
    return ClaudeCodeAdapter._createEventPromise<void>(
      ptyProcess,
      'data',
      timeout,
      `Claude CLI initialization timeout after ${timeout}ms`,
      (data: string, resolve, reject, cleanup) => {
        if (data.includes('claude>') || data.includes('ready') || data.includes('Welcome')) {
          cleanup();
          resolve();
        }
      }
    );
  }

  private static _createEventPromise<T>(
    ptyProcess: IPtyProcess,
    eventName: string,
    timeout: number,
    timeoutMessage: string,
    eventProcessor: (data: any, resolve: (value: T) => void, reject: (reason?: any) => void, cleanup: () => void) => void,
    once: boolean = false,
    startAction?: () => void
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let timeoutHandle: NodeJS.Timeout;

      const cleanup = () => {
        ptyProcess.removeListener(eventName, onEvent);
        clearTimeout(timeoutHandle);
      };

      const onEvent = (data: any) => eventProcessor(data, resolve, reject, cleanup);

      if (once) {
        ptyProcess.once(eventName, onEvent);
      } else {
        ptyProcess.on(eventName, onEvent);
      }

      timeoutHandle = setTimeout(() => {
        cleanup();
        reject(new Error(timeoutMessage));
      }, timeout);

      if (startAction) {
        startAction();
      }
    });
  }
}
