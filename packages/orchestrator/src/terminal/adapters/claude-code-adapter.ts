/**
 * Claude Code CLI Adapter (Print Mode)
 * 
 * child_process.spawn 기반 -p 모드 구현
 * PTY 의존성 제거, stdin/stdout 직접 통신
 */

import { spawn, ChildProcess } from 'child_process';
import * as os from 'os';
import * as fs from 'fs';
import { ProviderType } from '@codecafe/core';
import { IProviderAdapter, IPty } from '../provider-adapter';
import { ProviderSpawnError } from '../errors';

// Configuration constants
const CONFIG = {
  EXECUTE_TIMEOUT: 600000, // 10 minutes for execution
  TERM_COLS: 120,
  TERM_ROWS: 30,
} as const;

/**
 * Configuration interface for ClaudeCodeAdapter
 */
export interface ClaudeCodeAdapterConfig {
  /** System prompt to use for all executions */
  systemPrompt?: string;
  /** Continue from previous session in same directory */
  continueSession?: boolean;
  /** Enable streaming output (requires --verbose) */
  streaming?: boolean;
  /** Enable verbose output */
  verbose?: boolean;
}

/**
 * Execution context for -p mode
 */
export interface ExecutionContext {
  prompt: string;
  systemPrompt?: string;
  continueSession?: boolean;
  streaming?: boolean;
  cwd?: string;
}

/**
 * Wrapper to make ChildProcess compatible with IPty interface
 */
class ChildProcessWrapper implements IPty {
  private _process: ChildProcess | null = null;
  private _listeners: Map<string, ((...args: any[]) => void)[]> = new Map();
  private _cwd: string;
  private _context?: ExecutionContext;

  constructor(cwd: string) {
    this._cwd = cwd;
  }

  get pid(): number {
    return this._process?.pid || -1;
  }

  get childProcess(): ChildProcess | null {
    return this._process;
  }

  setProcess(proc: ChildProcess): void {
    this._process = proc;
  }

  setContext(ctx: ExecutionContext): void {
    this._context = ctx;
  }

  getContext(): ExecutionContext | undefined {
    return this._context;
  }

  getCwd(): string {
    return this._cwd;
  }

  write(data: string): void {
    this._process?.stdin?.write(data);
  }

  on(event: string, listener: (...args: any[]) => void): void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event)!.push(listener);
    this._process?.on(event as any, listener);
  }

  once(event: string, listener: (...args: any[]) => void): void {
    this._process?.once(event as any, listener);
  }

  removeListener(event: string, listener: (...args: any[]) => void): void {
    this._process?.removeListener(event as any, listener);
    const listeners = this._listeners.get(event);
    if (listeners) {
      const idx = listeners.indexOf(listener);
      if (idx !== -1) listeners.splice(idx, 1);
    }
  }

  kill(signal?: string): void {
    this._process?.kill(signal as NodeJS.Signals);
  }
}

export class ClaudeCodeAdapter implements IProviderAdapter {
  readonly providerType: ProviderType = 'claude-code';
  private config: ClaudeCodeAdapterConfig;

  constructor(config?: ClaudeCodeAdapterConfig) {
    this.config = config || {};
  }

  /**
   * Structured log helper
   */
  private log(step: string, details: Record<string, unknown> = {}): void {
    console.log(JSON.stringify({
      scope: 'claude-adapter-print',
      step,
      timestamp: new Date().toISOString(),
      ...details,
    }));
  }

  /**
   * Find Claude CLI executable path
   */
  private findClaude(): string {
    const isWindows = os.platform() === 'win32';
    const homedir = os.homedir();

    const paths = isWindows
      ? [
          `${homedir}\\.local\\bin\\claude.exe`,
          `${homedir}\\AppData\\Roaming\\npm\\claude.cmd`,
          `${homedir}\\AppData\\Local\\Programs\\claude\\claude.exe`,
          process.env.CLAUDE_CODE_PATH,
        ]
      : [
          `${homedir}/.local/bin/claude`,
          '/usr/local/bin/claude',
          process.env.CLAUDE_CODE_PATH,
        ];

    for (const p of paths.filter(Boolean) as string[]) {
      try {
        fs.accessSync(p);
        this.log('claude-found', { path: p });
        return p;
      } catch {}
    }

    this.log('claude-fallback', { fallback: 'claude' });
    return 'claude';
  }

  /**
   * Build CLI arguments for -p mode
   */
  private buildArgs(ctx: ExecutionContext): string[] {
    const args: string[] = ['-p', ctx.prompt];

    // Always use verbose for better output
    args.push('--verbose');

    if (ctx.systemPrompt) {
      args.push('--system-prompt', ctx.systemPrompt);
    }

    if (ctx.continueSession) {
      args.push('--continue');
    }

    if (ctx.streaming) {
      args.push('--output-format=stream-json');
    }

    return args;
  }

  /**
   * Spawn returns a wrapper that can be used with execute()
   * In -p mode, actual process is created in execute()
   */
  async spawn(options?: { cwd?: string }): Promise<IPty> {
    const cwd = options?.cwd || process.cwd();
    this.log('spawn-wrapper-created', { cwd });
    return new ChildProcessWrapper(cwd);
  }

  /**
   * Send prompt is handled by execute() in -p mode
   */
  async sendPrompt(ptyProcess: IPty, prompt: string): Promise<boolean> {
    // In -p mode, prompt is sent via command line args in execute()
    const wrapper = ptyProcess as ChildProcessWrapper;
    wrapper.setContext({ prompt, cwd: wrapper.getCwd() });
    return true;
  }

  /**
   * Read output from the process
   */
  async readOutput(
    ptyProcess: IPty,
    timeout: number,
    onData?: (data: string) => void
  ): Promise<string> {
    const wrapper = ptyProcess as ChildProcessWrapper;
    const childProc = wrapper.childProcess;

    if (!childProc) {
      return '';
    }

    return new Promise((resolve) => {
      let output = '';

      const onStdout = (data: Buffer) => {
        const chunk = data.toString();
        output += chunk;
        if (onData) onData(chunk);
      };

      childProc.stdout?.on('data', onStdout);

      const timer = setTimeout(() => {
        resolve(output);
      }, timeout);

      childProc.on('close', () => {
        clearTimeout(timer);
        resolve(output);
      });
    });
  }

  /**
   * Wait for process exit
   */
  async waitForExit(ptyProcess: IPty, timeout: number): Promise<number> {
    const wrapper = ptyProcess as ChildProcessWrapper;
    const childProc = wrapper.childProcess;

    if (!childProc) {
      return 0;
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve(-1);
      }, timeout);

      childProc.on('close', (code) => {
        clearTimeout(timer);
        resolve(code || 0);
      });
    });
  }

  /**
   * Kill the process
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
   * Main execution method - runs claude -p
   */
  async execute(
    ptyProcess: IPty,
    context: any,
    onData?: (data: string) => void
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    const wrapper = ptyProcess as ChildProcessWrapper;
    const cwd = wrapper.getCwd();

    // Build execution context
    const ctx: ExecutionContext = typeof context === 'string'
      ? { prompt: context, cwd }
      : { ...context, cwd };

    // Apply adapter config
    if (this.config.systemPrompt && !ctx.systemPrompt) {
      ctx.systemPrompt = this.config.systemPrompt;
    }
    if (this.config.continueSession && ctx.continueSession === undefined) {
      ctx.continueSession = this.config.continueSession;
    }

    const claudePath = this.findClaude();
    const args = this.buildArgs(ctx);

    this.log('execute-start', {
      claudePath,
      args,
      cwd,
    });

    return new Promise((resolve) => {
      let output = '';
      let errorOutput = '';

      const childProc = spawn(claudePath, args, {
        cwd,
        env: process.env,
        shell: true,
      });

      wrapper.setProcess(childProc);

      // Explicitly close stdin to prevent hanging if CLI waits for input
      childProc.stdin?.end();

      childProc.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        // Debug log (limit chunk size)
        this.log('stdout-chunk', { chunk: chunk.substring(0, 200) });
        output += chunk;
        if (onData) onData(chunk);
      });

      childProc.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        this.log('stderr-chunk', { chunk });
        errorOutput += data.toString();
      });

      childProc.on('close', (code) => {
        this.log('execute-end', {
          exitCode: code,
          outputLength: output.length,
          hasError: errorOutput.length > 0,
        });

        if (code === 0) {
          resolve({ success: true, output: output.trim() });
        } else {
          resolve({
            success: false,
            output: output.trim(),
            error: errorOutput || `Exit code: ${code}`,
          });
        }
      });

      childProc.on('error', (err) => {
        this.log('execute-error', { error: err.message });
        resolve({
          success: false,
          error: err.message,
        });
      });

      // Timeout
      setTimeout(() => {
        if (childProc.exitCode === null) {
          childProc.kill();
          resolve({
            success: false,
            output: output.trim(),
            error: 'Execution timeout',
          });
        }
      }, CONFIG.EXECUTE_TIMEOUT);
    });
  }

  /**
   * Register exit handler
   */
  onExit(ptyProcess: IPty, handler: (event: { exitCode: number }) => void): void {
    const wrapper = ptyProcess as ChildProcessWrapper;
    wrapper.childProcess?.on('close', (code: number) => {
      handler({ exitCode: code || 0 });
    });
  }

  /**
   * Execute with session continuation
   */
  async executeWithContinue(
    cwd: string,
    prompt: string,
    systemPrompt?: string,
    onData?: (data: string) => void
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    const wrapper = new ChildProcessWrapper(cwd);
    return this.execute(wrapper, {
      prompt,
      systemPrompt,
      continueSession: true,
    }, onData);
  }
}
