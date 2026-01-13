/**
 * Codex API Adapter
 * Implements JSON-based protocol for codex CLI
 */

import * as pty from 'node-pty';
import { ProviderType } from '@codecafe/core';
import { IProviderAdapter } from '../provider-adapter';

// Use any to avoid type issues with node-pty event emitter methods
type IPty = any;

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
  async spawn(): Promise<IPty> {
    try {
      const ptyProcess = pty.spawn('codex', ['--interactive'], {
        name: 'xterm-color',
        cwd: process.cwd(),
        env: {
          ...process.env,
        },
        cols: 120,
        rows: 30,
      });

      // Wait for initialization
      await this.waitForReady(ptyProcess, 5000);

      return ptyProcess;
    } catch (error) {
      throw new Error(`Failed to spawn codex CLI: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Send prompt as JSON message
   */
  async sendPrompt(ptyProcess: IPty, prompt: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      let ackReceived = false;
      const timeout = 5000;
      const messageId = this.generateId();

      // Store message ID for readOutput correlation
      this.lastMessageId = messageId;

      // Construct JSON message
      const message: CodexMessage = {
        type: 'prompt',
        content: prompt,
        id: messageId,
      };

      let buffer = '';
      const onData = (data: string) => {
        buffer += data;

        // Try to parse complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const parsed: CodexMessage = JSON.parse(line);
            if (parsed.type === 'ack' && parsed.id === messageId) {
              ackReceived = true;
              ptyProcess.removeListener('data', onData);
              clearTimeout(timeoutHandle);
              resolve(true);
              return;
            }
          } catch (parseError) {
            // Ignore non-JSON lines (may be logging)
            console.warn(`Codex: Failed to parse line: ${line.substring(0, 50)}...`);
          }
        }
      };

      ptyProcess.on('data', onData);

      // Send JSON message
      ptyProcess.write(JSON.stringify(message) + '\n');

      // Timeout fallback
      const timeoutHandle = setTimeout(() => {
        ptyProcess.removeListener('data', onData);
        if (!ackReceived) {
          reject(new Error('Codex prompt ACK timeout after 5000ms'));
        }
      }, timeout);
    });
  }

  /**
   * Read output with JSON framing
   */
  async readOutput(ptyProcess: IPty, timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      let output = '';
      let buffer = '';
      const expectedMessageId = this.lastMessageId; // Capture ID at start

      const onData = (data: string) => {
        buffer += data;

        // Parse line by line
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const parsed: CodexMessage = JSON.parse(line);

            // Validate message correlation for output and done
            if (parsed.type === 'output') {
              // Only accumulate output matching our message ID (or no ID for backward compat)
              if (!parsed.id || parsed.id === expectedMessageId) {
                output += parsed.content || '';
              } else {
                console.warn(`Codex: Ignoring output with mismatched ID: ${parsed.id} (expected: ${expectedMessageId})`);
              }
            } else if (parsed.type === 'done') {
              // Only resolve on done message matching our ID
              if (parsed.id === expectedMessageId || !parsed.id) {
                clearTimeout(timeoutHandle);
                ptyProcess.removeListener('data', onData);
                resolve(output);
                return;
              } else {
                console.warn(`Codex: Ignoring done with mismatched ID: ${parsed.id} (expected: ${expectedMessageId})`);
                // Continue waiting for correct done message
              }
            } else if (parsed.type === 'error') {
              // Accept error messages for our ID or without ID
              if (parsed.id === expectedMessageId || !parsed.id) {
                clearTimeout(timeoutHandle);
                ptyProcess.removeListener('data', onData);
                reject(new Error(`Codex error: ${parsed.error || 'Unknown error'}`));
                return;
              } else {
                console.warn(`Codex: Ignoring error with mismatched ID: ${parsed.id} (expected: ${expectedMessageId})`);
              }
            }
          } catch (parseError) {
            // Partial tolerance: log and continue
            console.warn(`Codex: JSON parse error: ${line.substring(0, 50)}...`);
          }
        }
      };

      ptyProcess.on('data', onData);

      // Overall timeout
      const timeoutHandle = setTimeout(() => {
        ptyProcess.removeListener('data', onData);
        reject(new Error(`Codex read timeout after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Wait for process exit
   */
  async waitForExit(ptyProcess: IPty, timeout: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const onExit = ({ exitCode }: { exitCode: number; signal?: number }) => {
        clearTimeout(timeoutHandle);
        resolve(exitCode);
      };

      ptyProcess.once('exit', onExit);

      const timeoutHandle = setTimeout(() => {
        ptyProcess.removeListener('exit', onExit);
        reject(new Error(`Codex exit wait timeout after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Kill process
   */
  async kill(ptyProcess: IPty): Promise<void> {
    ptyProcess.kill();
  }

  /**
   * Check if process is alive
   */
  isAlive(ptyProcess: IPty): boolean {
    return ptyProcess.pid > 0;
  }

  /**
   * Execute command with context
   */
  async execute(
    ptyProcess: IPty,
    context: any
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    try {
      const prompt = typeof context === 'string' ? context : JSON.stringify(context);
      await this.sendPrompt(ptyProcess, prompt);
      const output = await this.readOutput(ptyProcess, 30000);
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
  onExit(ptyProcess: IPty, handler: (event: { exitCode: number }) => void): void {
    ptyProcess.on('exit', (exitCode: number) => {
      handler({ exitCode });
    });
  }

  /**
   * Wait for ready signal
   */
  private async waitForReady(ptyProcess: IPty, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      let buffer = '';

      const onData = (data: string) => {
        buffer += data;

        // Parse line by line
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const parsed: CodexMessage = JSON.parse(line);
            if (parsed.type === 'ready') {
              clearTimeout(timeoutHandle);
              ptyProcess.removeListener('data', onData);
              resolve();
              return;
            }
          } catch (parseError) {
            // Ignore non-JSON during init
          }
        }
      };

      ptyProcess.on('data', onData);

      const timeoutHandle = setTimeout(() => {
        ptyProcess.removeListener('data', onData);
        reject(new Error(`Codex initialization timeout after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Generate unique message ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
