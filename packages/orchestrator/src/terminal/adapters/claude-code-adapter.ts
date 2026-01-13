/**
 * Claude Code CLI Adapter
 * Implements text-based protocol for claude CLI
 */

import * as pty from 'node-pty';
import { ProviderType } from '@codecafe/core';
import { IProviderAdapter } from '../provider-adapter';
import { ProviderSpawnError } from '../errors';

// Use any to avoid type issues with node-pty event emitter methods
type IPty = any;

export class ClaudeCodeAdapter implements IProviderAdapter {
  readonly providerType: ProviderType = 'claude-code';
  private readonly idleTimeoutMs = 500;

  /**
   * Spawn claude CLI process
   */
  async spawn(): Promise<IPty> {
    try {
      const ptyProcess = pty.spawn('claude', [], {
        name: 'xterm-color',
        cwd: process.cwd(),
        env: {
          ...process.env,
          TERM: 'xterm-256color',
        },
        cols: 120,
        rows: 30,
      });

      // Wait for initialization prompt
      await this.waitForPrompt(ptyProcess, 5000);

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
  async sendPrompt(ptyProcess: IPty, prompt: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      let written = false;
      const timeout = 5000;

      // Escape special characters
      const escapedPrompt = prompt
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n');

      const onData = (data: string) => {
        // Detect echo confirmation (first 20 chars match)
        const checkStr = escapedPrompt.substring(0, Math.min(20, escapedPrompt.length));
        if (data.includes(checkStr)) {
          written = true;
          ptyProcess.removeListener('data', onData);
          clearTimeout(timeoutHandle);
          resolve(true);
        }
      };

      ptyProcess.on('data', onData);

      // Send prompt with newline
      ptyProcess.write(escapedPrompt + '\r\n');

      // Timeout fallback
      const timeoutHandle = setTimeout(() => {
        ptyProcess.removeListener('data', onData);
        if (!written) {
          reject(new Error('Prompt send timeout after 5000ms'));
        }
      }, timeout);
    });
  }

  /**
   * Read output with idle detection
   */
  async readOutput(ptyProcess: IPty, timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      let output = '';
      let lastDataTime = Date.now();

      const onData = (data: string) => {
        output += data;
        lastDataTime = Date.now();
      };

      ptyProcess.on('data', onData);

      // Check for completion (idle for 500ms or explicit marker)
      const checkInterval = setInterval(() => {
        const idleTime = Date.now() - lastDataTime;

        if (idleTime > this.idleTimeoutMs || output.includes('[DONE]')) {
          clearInterval(checkInterval);
          clearTimeout(timeoutHandle);
          ptyProcess.removeListener('data', onData);

          // Trim whitespace and return
          resolve(output.trim());
        }
      }, 100);

      // Overall timeout
      const timeoutHandle = setTimeout(() => {
        clearInterval(checkInterval);
        ptyProcess.removeListener('data', onData);
        reject(new Error(`Read timeout after ${timeout}ms`));
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
        reject(new Error(`Exit wait timeout after ${timeout}ms`));
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
    // node-pty doesn't expose a direct isAlive check
    // We assume the process is alive if it has a valid pid
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
   * Wait for initialization prompt
   */
  private async waitForPrompt(ptyProcess: IPty, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const onData = (data: string) => {
        // Look for claude prompt indicators
        if (data.includes('claude>') || data.includes('ready') || data.includes('Welcome')) {
          clearTimeout(timeoutHandle);
          ptyProcess.removeListener('data', onData);
          resolve();
        }
      };

      ptyProcess.on('data', onData);

      const timeoutHandle = setTimeout(() => {
        ptyProcess.removeListener('data', onData);
        reject(new Error(`Claude CLI initialization timeout after ${timeout}ms`));
      }, timeout);
    });
  }
}
