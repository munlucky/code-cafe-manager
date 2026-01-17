/**
 * Claude Code CLI Adapter
 * Implements text-based protocol for claude CLI
 */

import * as pty from 'node-pty';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
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
  IDLE_TIMEOUT: 30000, // 30 seconds - Claude CLI needs time for long-running tasks
  WAIT_TIMEOUT: 10000, // Increased for shell + claude initialization
  EXECUTE_TIMEOUT: 600000, // 10 minutes for execution
  TERM_COLS: 120,
  TERM_ROWS: 30,
  CHECK_STR_LEN: 20,
} as const;

// Windows Git Bash paths are no longer used as we switched to PowerShell
// const WINDOWS_GIT_BASH_PATHS = ...

/**
 * Configuration interface for ClaudeCodeAdapter
 */
export interface ClaudeCodeAdapterConfig {
  /**
   * Force CI environment variable.
   * - true: Sets CI=true (default, forces non-interactive mode)
   * - false: Does not set CI, allows interactive mode
   * - undefined: Uses default behavior (CI=true)
   */
  forceCI?: boolean;
}

export class ClaudeCodeAdapter implements IProviderAdapter {
  readonly providerType: ProviderType = 'claude-code';

  private config: ClaudeCodeAdapterConfig;

  // C2: Startup output ring buffer for diagnostics
  private startupBuffer: string[] = [];
  private readonly STARTUP_BUFFER_SIZE = 50;

  /**
   * Constructor with optional configuration
   */
  constructor(config?: ClaudeCodeAdapterConfig) {
    this.config = config || {};
  }

  /**
   * Update adapter configuration
   */
  setConfig(config: Partial<ClaudeCodeAdapterConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Push a chunk to the startup ring buffer
   */
  private pushStartupLog(chunk: string): void {
    if (this.startupBuffer.length >= this.STARTUP_BUFFER_SIZE) {
      this.startupBuffer.shift();
    }
    this.startupBuffer.push(chunk);
  }

  /**
   * Dump and clear the startup buffer
   */
  private dumpStartupBuffer(): string {
    const dump = this.startupBuffer.join('');
    this.startupBuffer = [];
    return dump;
  }

  /**
   * C1: Structured log helper for diagnostics
   */
  private log(step: string, details: Record<string, unknown> = {}): void {
    console.log(JSON.stringify({
      scope: 'claude-adapter',
      step,
      timestamp: new Date().toISOString(),
      ...details,
    }));
  }

  /**
   * C1: Check if prompt is detected using robust patterns
   * Supports unicode prompt characters and case-insensitive matching
   */
  private isPromptDetected(buffer: string): boolean {
    // Unicode prompt characters: >, ›, », ❯
    const promptChars = '[>›»❯]';
    const patterns = [
      new RegExp(`claude\\s*${promptChars}`, 'i'),  // claude>, claude ›, etc.
      /ready/i,
      /welcome/i,
      new RegExp(`${promptChars}\\s*$`),  // Prompt character at end of output
    ];
    return patterns.some(p => p.test(buffer));
  }

  /**
   * C2: Classify failure cause from ring buffer content
   * Returns: PATH_ERROR | AUTH_REQUIRED | UPDATE_PROMPT | PROMPT_DETECTION
   */
  private classifyFailure(buffer: string): string {
    const lower = buffer.toLowerCase();
    if (lower.includes('not found') || lower.includes('not recognized') || lower.includes('command not found')) {
      return 'PATH_ERROR';
    }
    if (lower.includes('login') || lower.includes('permission') || lower.includes('authenticate') || lower.includes('unauthorized')) {
      return 'AUTH_REQUIRED';
    }
    if (lower.includes('update') || lower.includes('upgrade') || lower.includes('new version')) {
      return 'UPDATE_PROMPT';
    }
    return 'PROMPT_DETECTION';
  }

  /**
   * C2: Get the appropriate line ending for the current platform
   * Windows PTY typically uses \r, Unix uses \n
   */
  private getLineEnding(): string {
    return os.platform() === 'win32' ? '\r' : '\n';
  }

  /**
   * C4: Verify claude CLI is available before spawn (fail fast)
   * Throws Error if claude is not found in PATH and no hardcoded path exists
   */
  private verifyClaudeInstallation(): void {
    const isWindows = os.platform() === 'win32';
    
    if (isWindows) {
      // On Windows, getClaudeCommand() already does thorough checking
      // and returns an absolute path or falls back to 'claude'
      const claudeCmd = this.getClaudeCommand();
      
      // If getClaudeCommand found a path (not just 'claude'), we're good
      if (claudeCmd !== 'claude') {
        this.log('claude-verify-success', { platform: 'win32', method: 'path-found' });
        return;
      }
      
      // Fallback case - need to verify 'claude' is in PATH
      try {
        const { execSync } = require('child_process');
        execSync('where.exe claude', { stdio: 'ignore' });
        this.log('claude-verify-success', { platform: 'win32', method: 'where' });
      } catch {
        this.log('claude-verify-fail', { platform: 'win32' });
        throw new Error(
          'Claude CLI not found in PATH. Please install Claude CLI or set CLAUDE_CODE_PATH environment variable.'
        );
      }
    } else {
      // On Unix, verify claude is in PATH
      try {
        const { execSync } = require('child_process');
        execSync('which claude', { stdio: 'ignore' });
        this.log('claude-verify-success', { platform: os.platform(), method: 'which' });
      } catch {
        this.log('claude-verify-fail', { platform: os.platform() });
        throw new Error(
          'Claude CLI not found in PATH. Please install Claude CLI or set CLAUDE_CODE_PATH environment variable.'
        );
      }
    }
  }

  /**
   * Get shell configuration based on platform
   */
  private getShellConfig(): { shell: string; args: string[] } {
    if (os.platform() === 'win32') {
      return {
        shell: 'powershell.exe',
        args: ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass'],
      };
    } else {
      return { shell: '/bin/bash', args: ['--login', '-i'] };
    }
  }

  /**
   * Get the claude command for the current platform
   * Returns absolute path on Windows
   */
  private getClaudeCommand(): string {
    const isWindows = os.platform() === 'win32';

    if (isWindows) {
      // Try common installation paths
      const homedir = os.homedir();

      // 1. Try to find generic 'claude' in PATH using PowerShell
      // This supports unknown installation paths (e.g. bun, pipx, choco) as long as it's in PATH
      try {
        const { execSync } = require('child_process');
        // Use PowerShell to find the command path
        const cmd = 'powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Command claude -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Path | Select-Object -First 1"';
        const stdout = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        
        if (stdout && fs.existsSync(stdout)) {
           console.log(`[ClaudeCodeAdapter] Found claude via PATH: ${stdout}`);
           return `& "${stdout}"`;
        }
      } catch (e) {
        // Ignore error and fall back to manual paths
        console.log('[ClaudeCodeAdapter] Could not find claude in PATH via Get-Command, checking common paths...');
      }
      
      // Log environment variable if set
      if (process.env.CLAUDE_CODE_PATH) {
        console.log(`[ClaudeCodeAdapter] System CLAUDE_CODE_PATH is set to: ${process.env.CLAUDE_CODE_PATH}`);
      }

      // Prioritize known paths
      // Note: .local/bin/claude.exe was confirmed by 'where.exe'
      const possiblePaths = [
        `${homedir}\\.local\\bin\\claude.exe`, 
        `${homedir}\\AppData\\Roaming\\npm\\claude.cmd`,
        `${homedir}\\AppData\\Local\\Programs\\claude\\claude.exe`,
        process.env.CLAUDE_CODE_PATH,
      ].filter(Boolean) as string[];

      for (const claudePath of possiblePaths) {
        if (fs.existsSync(claudePath)) {
          console.log(`[ClaudeCodeAdapter] Found claude at: ${claudePath}`);
          return `& "${claudePath}"`;
        }
      }

      // Fallback
      console.warn('[ClaudeCodeAdapter] Claude CLI not found at common paths, using "claude"');
      return 'claude';
    } else {
      // On Linux/macOS, just use 'claude' and rely on PATH
      return 'claude';
    }
  }

  /**
   * Spawn claude CLI process via shell
   */
  async spawn(options?: { cwd?: string }): Promise<IPtyProcess> {
    const spawnStartTime = Date.now();
    
    // C4: Verify claude installation before attempting spawn (fail fast)
    this.verifyClaudeInstallation();
    
    try {
      const { shell, args } = this.getShellConfig();
      const claudeCmd = this.getClaudeCommand();

      // Filter out environment variables that might cause issues
      const env = { ...process.env };
      // Electron/VS Code variables
      delete env.ELECTRON_RUN_AS_NODE;
      delete env.ELECTRON_NO_ATTACH_CONSOLE;
      delete env.VSCODE_IPC_HOOK;
      delete env.VSCODE_PID;
      delete env.CLAUDE_CODE_PATH;

      // Force non-interactive / headless mode (configurable via forceCI)
      // Default behavior: CI=true to prevent interactive prompts
      // Set forceCI=false to disable and test interactive behavior
      if (this.config.forceCI !== false) {
        env.CI = 'true';
      }
      // Set dummy editor to prevent VS Code fallback
      env.EDITOR = 'cmd /c echo';
      env.VISUAL = 'cmd /c echo';

      // CRITICAL: Remove VS Code from PATH to prevent Claude from launching 'code' command
      // This is the aggressive fix for "VS Code launching" issue
      const pathKey = Object.keys(env).find(k => k.toLowerCase() === 'path') || 'Path';
      if (env[pathKey]) {
        const paths = env[pathKey].split(';'); // Windows delimiter
        const filteredPaths = paths.filter(p => {
          const lower = p.toLowerCase();
          return !lower.includes('microsoft vs code') && 
                 !lower.includes('vscode') &&
                 !lower.includes('visual studio code');
        });
        env[pathKey] = filteredPaths.join(';');
      }

      // Use provided CWD or fallback to process.cwd()
      const spawnCwd = options?.cwd || process.cwd();

      // C1: Structured log - spawn start
      this.log('spawn-start', {
        provider: this.providerType,
        cwd: spawnCwd,
        shell,
        args,
        envSummary: {
          CI: env.CI,
          TERM: 'xterm-256color',
          pathLength: env[pathKey]?.split(path.delimiter).length || 0,
        },
        claudeCmd,
      });

      const spawnOptions = {
        name: 'xterm-color',
        cwd: spawnCwd,
        env: {
          ...env,
          TERM: 'xterm-256color',
        },
        cols: CONFIG.TERM_COLS,
        rows: CONFIG.TERM_ROWS,
      };

      const ptyProcess = pty.spawn(shell, args, spawnOptions) as unknown as IPtyProcess;

      // C1: Wait for shell to initialize with timing
      const shellReadyStart = Date.now();
      this.log('shell-ready-enter', { timeoutMs: CONFIG.WAIT_TIMEOUT });
      await this.waitForShellReady(ptyProcess, CONFIG.WAIT_TIMEOUT);
      this.log('shell-ready-exit', { elapsedMs: Date.now() - shellReadyStart });

      // C1: Write claude command with logging (C2: OS-specific line ending)
      const lineEnding = this.getLineEnding();
      this.log('write-claude-cmd', { claudeCmd, lineEnding: lineEnding === '\r' ? '\\r' : '\\n' });
      ptyProcess.write(`${claudeCmd}${lineEnding}`);

      // C1: Wait for Claude to initialize with timing
      const waitPromptStart = Date.now();
      this.log('waitForPrompt-enter', { timeoutMs: CONFIG.WAIT_TIMEOUT });
      await this.waitForPrompt(ptyProcess, CONFIG.WAIT_TIMEOUT);
      this.log('waitForPrompt-success', { elapsedMs: Date.now() - waitPromptStart });

      this.log('spawn-complete', { totalElapsedMs: Date.now() - spawnStartTime });
      return ptyProcess;
    } catch (error) {
      // C1: Log spawn failure with ring buffer dump
      this.log('spawn-error', {
        error: error instanceof Error ? error.message : String(error),
        totalElapsedMs: Date.now() - spawnStartTime,
        startupBufferDump: this.dumpStartupBuffer(),
      });
      throw new ProviderSpawnError(
        'claude-code',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Wait for shell to be ready
   */
  private async waitForShellReady(ptyProcess: IPtyProcess, timeout: number): Promise<void> {
    return new Promise((resolve) => {
      // Give shell a moment to initialize
      setTimeout(() => resolve(), timeout);
    });
  }

  /**
   * Send prompt to terminal with escaping
   */
  async sendPrompt(ptyProcess: IPtyProcess, prompt: string): Promise<boolean> {
    // Send raw prompt with a single carriage return at the end
    const dataToWrite = prompt + '\r';
    
    // Simple verification check (remove newlines for check)
    const checkStr = prompt.substring(0, Math.min(20, prompt.length)).replace(/\r|\n/g, '');

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
      () => ptyProcess.write(dataToWrite)
    ).catch(() => true); // Best effort
  }

  /**
   * Read output with idle detection and completion patterns
   */

  async readOutput(ptyProcess: IPtyProcess, timeout: number, onDataCallback?: (data: string) => void): Promise<string> {
    return new Promise((resolve, reject) => {
      let output = '';
      let idleTimer: NodeJS.Timeout | null = null;
      let hardTimeout: NodeJS.Timeout | null = null;

      const cleanup = () => {
        if (idleTimer) clearTimeout(idleTimer);
        if (hardTimeout) clearTimeout(hardTimeout);
        ptyProcess.removeListener('data', onData);
        ptyProcess.removeListener('exit', onExit);
      };

      const complete = () => {
        cleanup();
        resolve(output.trim());
      };

      // Set hard timeout
      hardTimeout = setTimeout(() => {
        console.warn(`[ClaudeCodeAdapter] Operation hard timeout reached (${timeout}ms)`);
        cleanup();
        resolve(output.trim()); // Return what we have instead of failing
      }, timeout);

      // Claude CLI completion patterns
      const isCompleted = (text: string): boolean => {
        // Explicit markers
        if (text.includes('[DONE]')) return true;

        // Token usage stats
        if (/Total cost:.*\$[\d.]+/i.test(text)) return true;
        if (/tokens used/i.test(text)) return true;

        // Prompt detection (including special chars used by Claude Code)
        // Check last few lines
        const lastLines = text.slice(-200).trim();
        // Standard prompts
        if (/claude[>›»]/i.test(lastLines)) return true;
        // Arrow prompts (❯, >, etc) at the end of line
        if (/[>›»❯]\s*$/.test(lastLines)) return true;

        return false;
      };

      const onData = (data: string) => {
        if (onDataCallback) onDataCallback(data);
        output += data;
        // console.log('[ClaudeCodeAdapter] Output chunk:', data.substring(0, 50));

        this.checkAndHandlePermissions(data, ptyProcess);

        if (idleTimer) clearTimeout(idleTimer);

        if (isCompleted(output)) {
          console.log('[ClaudeCodeAdapter] Completion pattern detected');
          // Short delay to ensure all prompt chars are flushed
          setTimeout(complete, 100);
        } else {
          // Restart idle timer
          idleTimer = setTimeout(() => {
            console.log('[ClaudeCodeAdapter] Idle check...');
            if (isCompleted(output)) {
              complete();
            } else {
              console.log('[ClaudeCodeAdapter] Still waiting for completion...');
              // Do not complete unless isCompleted is true, rely on hardTimeout
            }
          }, CONFIG.IDLE_TIMEOUT);
        }
      };

      const onExit = (code: number) => {
        console.log(`[ClaudeCodeAdapter] Process exited with code ${code}`);
        complete();
      };

      ptyProcess.on('data', onData);
      ptyProcess.on('exit', onExit);
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
    context: any,
    onDataCallback?: (data: string) => void
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    try {
      const prompt = typeof context === 'string' ? context : JSON.stringify(context);

      await this.sendPrompt(ptyProcess, prompt);
      const output = await this.readOutput(ptyProcess, CONFIG.EXECUTE_TIMEOUT, onDataCallback);

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
   * Check for permission prompts and auto-approve
   */
  private checkAndHandlePermissions(text: string, ptyProcess: IPtyProcess): boolean {
    const permissionPatterns = [
      /Allow .* execution/i,
      /Do you want to run/i,
      /\(y\/n\)/i,
      /Risk:/i,
      /Allow .* access/i,
    ];

    for (const pattern of permissionPatterns) {
      if (pattern.test(text)) {
        console.log(`[ClaudeCodeAdapter] Auto-approving permission prompt matching: ${pattern}`);
        ptyProcess.write('y\r');
        return true;
      }
    }
    return false;
  }

  /**
   * Wait for initialization prompt
   * Uses robust pattern detection and includes ring buffer dump on timeout
   */
  private async waitForPrompt(ptyProcess: IPtyProcess, timeout: number): Promise<void> {
    // C2: Clear startup buffer before waiting
    this.startupBuffer = [];
    let accumulatedBuffer = '';
    
    return new Promise<void>((resolve, reject) => {
      let timeoutHandle: NodeJS.Timeout;

      const cleanup = () => {
        ptyProcess.removeListener('data', onData);
        clearTimeout(timeoutHandle);
      };

      const onData = (data: string) => {
        // C2: Push to startup ring buffer for diagnostics
        this.pushStartupLog(data);
        accumulatedBuffer += data;
        
        // Handle permissions during startup
        this.checkAndHandlePermissions(data, ptyProcess);

        // C1: Use robust pattern detection
        if (this.isPromptDetected(accumulatedBuffer)) {
          cleanup();
          resolve();
        }
      };

      ptyProcess.on('data', onData);

      timeoutHandle = setTimeout(() => {
        cleanup();
        // C2: Dump ring buffer and classify failure on timeout
        const bufferDump = this.dumpStartupBuffer();
        const failureType = this.classifyFailure(bufferDump);
        
        this.log('waitForPrompt-timeout', {
          failureType,
          timeoutMs: timeout,
          bufferLength: bufferDump.length,
          bufferPreview: bufferDump.slice(-500),
        });
        
        reject(new Error(
          `Claude CLI init timeout [${failureType}] after ${timeout}ms. ` +
          `Buffer preview: ${bufferDump.slice(-300).replace(/\n/g, '\\n')}`
        ));
      }, timeout);
    });
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
