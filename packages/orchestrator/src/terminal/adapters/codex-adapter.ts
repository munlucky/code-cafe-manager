/**
 * Codex API Adapter
 * Implements JSON-based protocol for codex CLI
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
  INIT_TIMEOUT: 5000,
  ACK_TIMEOUT: 5000,
  EXECUTE_TIMEOUT: 30000,
  TERM_COLS: 120,
  TERM_ROWS: 30,
} as const;

interface CodexMessage {
  type: 'prompt' | 'ack' | 'output' | 'done' | 'ready' | 'error';
  content?: string;
  id?: string;
  error?: string;
}

export class CodexAdapter implements IProviderAdapter {
  readonly providerType: ProviderType = 'codex';
  private lastMessageId: string | null = null; // Track last sent message ID for correlation

  /**
   * Spawn codex CLI process in interactive mode
   */
  async spawn(): Promise<IPtyProcess> {
    try {
      const ptyProcess = pty.spawn('codex', ['--interactive'], {
        name: 'xterm-color',
        cwd: process.cwd(),
        env: {
          ...process.env,
        },
        cols: CONFIG.TERM_COLS,
        rows: CONFIG.TERM_ROWS,
      }) as unknown as IPtyProcess;

      // Wait for initialization
      await this.waitForReady(ptyProcess, CONFIG.INIT_TIMEOUT);

      return ptyProcess;
    } catch (error) {
      throw new ProviderSpawnError(
        'codex',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Send prompt as JSON message
   */
  async sendPrompt(ptyProcess: IPtyProcess, prompt: string): Promise<boolean> {
    const messageId = this.generateId();
    this.lastMessageId = messageId;

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        ptyProcess.removeListener('data', onData);
        clearTimeout(timeoutHandle);
      };

      const onData = (data: string) => {
        this.processJsonLines(data, (parsed) => {
          if (parsed.type === 'ack' && parsed.id === messageId) {
            cleanup();
            resolve(true);
            return true;
          }
          return false;
        });
      };

      const timeoutHandle = setTimeout(() => {
        cleanup();
        reject(new Error(`Codex prompt ACK timeout after ${CONFIG.ACK_TIMEOUT}ms`));
      }, CONFIG.ACK_TIMEOUT);

      ptyProcess.on('data', onData);

      // Send JSON message
      this.writeJson(ptyProcess, {
        type: 'prompt',
        content: prompt,
        id: messageId,
      });
    });
  }

  /**
   * Read output with JSON framing
   */
  async readOutput(ptyProcess: IPtyProcess, timeout: number): Promise<string> {
    const expectedMessageId = this.lastMessageId;

    return new Promise((resolve, reject) => {
      let output = '';

      const cleanup = () => {
        ptyProcess.removeListener('data', onData);
        clearTimeout(timeoutHandle);
      };

      const onData = (data: string) => {
        this.processJsonLines(data, (parsed) => {
          // Verify message ID correlation if available
          if (parsed.id && expectedMessageId && parsed.id !== expectedMessageId) {
            return false;
          }

          switch (parsed.type) {
            case 'output':
              output += parsed.content || '';
              return false;

            case 'done':
              cleanup();
              resolve(output);
              return true;

            case 'error':
              cleanup();
              reject(new Error(`Codex error: ${parsed.error || 'Unknown error'}`));
              return true;

            default:
              return false;
          }
        });
      };

      const timeoutHandle = setTimeout(() => {
        cleanup();
        reject(new Error(`Codex read timeout after ${timeout}ms`));
      }, timeout);

      ptyProcess.on('data', onData);
    });
  }

  /**
   * Wait for process exit
   */
  async waitForExit(ptyProcess: IPtyProcess, timeout: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        ptyProcess.removeListener('exit', onExit);
        clearTimeout(timeoutHandle);
      };

      const onExit = ({ exitCode }: { exitCode: number }) => {
        cleanup();
        resolve(exitCode);
      };

      const timeoutHandle = setTimeout(() => {
        cleanup();
        reject(new Error(`Codex exit wait timeout after ${timeout}ms`));
      }, timeout);

      ptyProcess.once('exit', onExit);
    });
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
   * Wait for ready signal
   */
  private async waitForReady(ptyProcess: IPtyProcess, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        ptyProcess.removeListener('data', onData);
        clearTimeout(timeoutHandle);
      };

      const onData = (data: string) => {
        const lines = data.split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const parsed: CodexMessage = JSON.parse(line);
            if (parsed.type === 'ready') {
              cleanup();
              resolve();
              return;
            }
          } catch (parseError) {
            // Ignore non-JSON during init
          }
        }
      };

      const timeoutHandle = setTimeout(() => {
        cleanup();
        reject(new Error(`Codex initialization timeout after ${timeout}ms`));
      }, timeout);

      ptyProcess.on('data', onData);
    });
  }

  /**
   * Generate unique message ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Process JSON lines from terminal output
   */
  private processJsonLines(data: string, handler: (parsed: CodexMessage) => boolean): void {
    const lines = data.split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const parsed: CodexMessage = JSON.parse(line);
        const shouldStop = handler(parsed);
        if (shouldStop) break;
      } catch (parseError) {
        // Ignore non-JSON lines
      }
    }
  }

  /**
   * Write JSON message to terminal
   */
  private writeJson(ptyProcess: IPtyProcess, message: CodexMessage): void {
    ptyProcess.write(JSON.stringify(message) + '\n');
  }
}
