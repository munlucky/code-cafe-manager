/**
 * Claude Code CLI Adapter (Print Mode)
 *
 * child_process.spawn 기반 -p 모드 구현
 * PTY 의존성 제거, stdin/stdout 직접 통신
 *
 * 중요: 긴 프롬프트는 stdin을 통해 전달하여 인자 길이 제한을 회피합니다.
 */

import { spawn, ChildProcess } from 'child_process';
import * as os from 'os';
import * as fs from 'fs';
import { ProviderType } from '@codecafe/core';
import { IProviderAdapter, IPty } from '../provider-adapter';
import { ProviderSpawnError } from '../errors';
import { STDERR_MARKER, JSON_MARKER } from '../output-markers.js';

// Configuration constants
const CONFIG = {
  EXECUTE_TIMEOUT: 600000, // 10 minutes for execution
  TERM_COLS: 120,
  TERM_ROWS: 30,
  MAX_TOOL_RESULT_LOG_LENGTH: 500, // Maximum characters to log for tool results
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
  skipPermissions?: boolean; // 권한 요청 건너뛰기
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

const DEFAULT_SYSTEM_PROMPT = `
You are running in non-interactive CLI mode.
You cannot ask follow-up questions or wait for user input.
If the user's request is ambiguous or lacks details:
1. Make reasonable assumptions based on common software development practices.
2. Proceed with the task execution immediately (e.g., creating files, analyzing code).
3. If you absolutely cannot proceed, list the missing information as a structured error report, but try to execute as much as possible first.
`.trim();

/**
 * Message handler type for stream parsing
 */
type MessageHandler = (parsed: unknown, onData?: (data: string) => void) => boolean;

/**
 * Todo item type
 */
type TodoItem = {
  status: 'completed' | 'in_progress' | 'pending';
  content: string;
  activeForm?: string;
};

/**
 * Claude Code CLI Adapter
 */
export class ClaudeCodeAdapter implements IProviderAdapter {
  readonly providerType: ProviderType = 'claude-code';
  private config: ClaudeCodeAdapterConfig;

  constructor(config?: ClaudeCodeAdapterConfig) {
    this.config = config || {};
  }

  /**
   * Format tool input parameters for display
   * Shows relevant details based on tool type
   */
  private formatToolInput(toolName: string, input: Record<string, unknown>): string {
    const lines: string[] = [];
    const indent = '  ';

    switch (toolName) {
      case 'Edit':
        if (input.file_path) lines.push(`${indent}file: ${input.file_path}`);
        break;
      case 'Write':
        if (input.file_path) lines.push(`${indent}file: ${input.file_path}`);
        break;
      case 'Read':
        if (input.file_path) lines.push(`${indent}file: ${input.file_path}`);
        break;
      case 'Glob':
        if (input.pattern) lines.push(`${indent}pattern: ${input.pattern}`);
        if (input.path) lines.push(`${indent}path: ${input.path}`);
        break;
      case 'Grep':
        if (input.pattern) lines.push(`${indent}pattern: ${input.pattern}`);
        if (input.path) lines.push(`${indent}path: ${input.path}`);
        break;
      case 'Bash':
        if (input.command) {
          const cmd = String(input.command);
          // Truncate long commands
          const displayCmd = cmd.length > 100 ? cmd.substring(0, 100) + '...' : cmd;
          lines.push(`${indent}$ ${displayCmd}`);
        }
        break;
      case 'Task':
        if (input.description) lines.push(`${indent}desc: ${input.description}`);
        if (input.subagent_type) lines.push(`${indent}type: ${input.subagent_type}`);
        break;
      case 'TodoWrite':
        if (input.todos && Array.isArray(input.todos)) {
          const count = input.todos.length;
          lines.push(`${indent}todos: ${count} items`);
        }
        break;
      default:
        // For other tools, show first few key parameters
        const keys = Object.keys(input).slice(0, 3);
        for (const key of keys) {
          const value = input[key];
          if (value !== undefined && value !== null) {
            const displayValue = typeof value === 'string'
              ? (value.length > 50 ? value.substring(0, 50) + '...' : value)
              : JSON.stringify(value).substring(0, 50);
            lines.push(`${indent}${key}: ${displayValue}`);
          }
        }
    }

    return lines.join('\n');
  }

  /**
   * Structured log helper
   */
  private log(step: string, details: Record<string, unknown> = {}): void {
    console.log(
      JSON.stringify({
        scope: 'claude-adapter-print',
        step,
        timestamp: new Date().toISOString(),
        ...details,
      })
    );
  }

  /**
   * Handle assistant message type
   */
  private handleAssistantMessage: MessageHandler = (parsed, onData) => {
    const p = parsed as any;
    if (p.type !== 'assistant' || !p.message?.content) return false;

    const content = p.message.content;
    if (typeof content === 'string') {
      if (onData) onData(content);
      return true;
    }

    if (Array.isArray(content)) {
      let extracted = false;
      for (const block of content) {
        if (block.type === 'text' && block.text) {
          if (onData) onData(block.text);
          extracted = true;
        } else if (block.type === 'tool_use') {
          // Format tool details with name and input parameters
          let toolLog = `[TOOL] ${block.name}`;
          if (block.input && typeof block.input === 'object') {
            const input = block.input as Record<string, unknown>;
            // Format key parameters for visibility
            const formattedParams = this.formatToolInput(block.name, input);
            if (formattedParams) {
              toolLog += `\n${formattedParams}`;
            }
            // Emit FILE_EDIT marker for Edit/Write operations
            if ((block.name === 'Edit' || block.name === 'Write') && input.file_path) {
              const editType = block.name === 'Write' ? 'write' : 'edit';
              if (onData) {
                onData(`[FILE_EDIT] ${JSON.stringify({ type: editType, path: input.file_path, success: true })}\n`);
              }
            }
          }
          if (onData) onData(`${toolLog}\n`);
          extracted = true;
        } else if (block.type === 'thinking') {
          // Thinking block - skip silently (internal reasoning)
          extracted = true;
        }
      }
      return extracted;
    }

    return false;
  };

  /**
   * Handle user message type (tool results)
   */
  private handleUserMessage: MessageHandler = (parsed, onData) => {
    const p = parsed as any;
    if (p.type !== 'user' || !p.message?.content) return false;

    // Extract todo progress if available
    const toolUseResult = p.tool_use_result;
    if (toolUseResult?.newTodos && Array.isArray(toolUseResult.newTodos)) {
      const todos = toolUseResult.newTodos as TodoItem[];
      const completed = todos.filter((t) => t.status === 'completed').length;
      const inProgress = todos.filter((t) => t.status === 'in_progress').length;
      const total = todos.length;
      if (onData) {
        onData(`[TODO_PROGRESS] ${JSON.stringify({ completed, inProgress, total, todos })}\n`);
      }
    }

    // Forward tool result content for logging visibility
    if (onData && Array.isArray(p.message.content)) {
      for (const block of p.message.content) {
        if (block.type === 'tool_result' && block.content) {
          const resultContent =
            typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
          const truncated =
            resultContent.length > CONFIG.MAX_TOOL_RESULT_LOG_LENGTH
              ? resultContent.substring(0, CONFIG.MAX_TOOL_RESULT_LOG_LENGTH) + '...(truncated)'
              : resultContent;
          onData(`[TOOL_RESULT] ${truncated}\n`);
        }
      }
    }

    return true;
  };

  /**
   * Handle content_block_delta message type
   */
  private handleContentBlockDelta: MessageHandler = (parsed, onData) => {
    const p = parsed as any;
    if (p.type !== 'content_block_delta' || !p.delta?.text) return false;
    if (onData) onData(p.delta.text);
    return true;
  };

  /**
   * Handle message with role (assistant)
   */
  private handleMessageWithRole: MessageHandler = (parsed, onData) => {
    const p = parsed as any;
    if (p.type !== 'message' || p.role !== 'assistant') return false;

    if (!p.content) return false;

    if (typeof p.content === 'string') {
      if (onData) onData(p.content);
      return true;
    }

    if (Array.isArray(p.content)) {
      let extracted = false;
      for (const item of p.content) {
        if (item.type === 'text' && item.text) {
          if (onData) onData(item.text);
          extracted = true;
        }
      }
      // If only tool_use items exist, mark as extracted
      if (!extracted && p.content.length > 0) {
        extracted = true;
      }
      return extracted;
    }

    return false;
  };

  /**
   * Handle message_delta type
   */
  private handleMessageDelta: MessageHandler = (parsed, onData) => {
    const p = parsed as any;
    if (p.type !== 'message_delta' || !p.delta?.content) return false;
    if (typeof p.delta.content === 'string') {
      if (onData) onData(p.delta.content);
      return true;
    }
    return false;
  };

  /**
   * Handle simple text output
   */
  private handleTextOutput: MessageHandler = (parsed, onData) => {
    const p = parsed as any;
    if (p.type !== 'text' || !p.text) return false;
    if (onData) onData(p.text);
    return true;
  };

  /**
   * Handle generic content field
   */
  private handleGenericContent: MessageHandler = (parsed, onData) => {
    const p = parsed as any;
    if (!p.content || p.type) return false; // Skip if type is already defined
    if (onData) onData(typeof p.content === 'string' ? p.content : JSON.stringify(p.content));
    return true;
  };

  /**
   * Handle stream control messages
   */
  private handleStreamControl: MessageHandler = (parsed) => {
    const p = parsed as any;
    const controlTypes = [
      'message_start',
      'message_stop',
      'content_block_start',
      'content_block_stop',
    ];
    return controlTypes.includes(p.type);
  };

  /**
   * Handle system messages
   */
  private handleSystemMessage: MessageHandler = (parsed) => {
    const p = parsed as any;
    return p.type === 'system';
  };

  /**
   * Handle result message
   */
  private handleResultMessage: MessageHandler = (parsed, onData) => {
    const p = parsed as any;
    if (p.type !== 'result') return false;
    if (p.result && onData) {
      onData(`[RESULT] ${typeof p.result === 'string' ? p.result : JSON.stringify(p.result)}\n`);
    }
    return true;
  };

  /**
   * Message handlers registry
   */
  private messageHandlers: MessageHandler[] = [
    this.handleAssistantMessage,
    this.handleUserMessage,
    this.handleContentBlockDelta,
    this.handleMessageWithRole,
    this.handleMessageDelta,
    this.handleTextOutput,
    this.handleStreamControl,
    this.handleSystemMessage,
    this.handleResultMessage,
    this.handleGenericContent,
  ];

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
      : [`${homedir}/.local/bin/claude`, '/usr/local/bin/claude', process.env.CLAUDE_CODE_PATH];

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
   * Remove CLI command patterns from prompt
   * Users may accidentally include CLI commands in their prompts
   */
  private sanitizePrompt(prompt: string): string {
    let cleaned = prompt;

    // Remove "claude" command prefix with any flags
    // Matches: "claude", "claude -p", "claude --dangerously-skip-permissions", etc.
    cleaned = cleaned.replace(/^claude\s+(?:--?[\w-]+\s*)*/i, '').trim();

    // Remove standalone CLI-like flags that may have been left
    cleaned = cleaned.replace(/^--?[\w-]+\s*/g, '').trim();

    // If nothing left after cleaning, use a default message
    if (!cleaned) {
      this.log('prompt-sanitized-empty', { original: prompt });
      cleaned = 'Analyze the current project and provide insights.';
    } else if (cleaned !== prompt) {
      this.log('prompt-sanitized', { original: prompt, cleaned });
    }

    return cleaned;
  }

  /**
   * Build CLI arguments for -p mode
   *
   * 참고: 프롬프트는 stdin을 통해 전달하므로 인자에 포함하지 않습니다.
   * 이를 통해 OS 인자 길이 제한(~8191자 on Windows)을 회피합니다.
   */
  private buildArgs(ctx: ExecutionContext): { args: string[]; prompt: string } {
    // 프롬프트는 별도로 반환 (stdin 전달용)
    const cleanPrompt = this.sanitizePrompt(ctx.prompt);

    // 인자에는 프롬프트를 포함하지 않음
    const args: string[] = ['-p']; // -p만 지정, stdin에서 입력을 읽음

    const envVerbose = process.env.CODECAFE_CLAUDE_VERBOSE;
    const envStreaming = process.env.CODECAFE_CLAUDE_STREAMING || 0;
    const verboseEnabled = this.config.verbose ?? (envVerbose === '1' || envVerbose === 'true');
    const streamingEnabled =
      ctx.streaming ??
      this.config.streaming ??
      (envStreaming ? envStreaming === '1' || envStreaming === 'true' : true);
    if (streamingEnabled) {
      // --output-format=stream-json requires --verbose
      args.push('--verbose');
    } else if (verboseEnabled) {
      args.push('--verbose');
    }

    // Skip permission prompts for automated execution
    args.push('--dangerously-skip-permissions');

    if (ctx.systemPrompt) {
      args.push('--system-prompt', ctx.systemPrompt);
    }

    if (ctx.continueSession) {
      args.push('--continue');
    }

    // Enable streaming by default for real-time output
    // stream-json format provides incremental updates
    if (streamingEnabled) {
      args.push('--output-format=stream-json');
    }

    return { args, prompt: cleanPrompt };
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
   *
   * 프롬프트는 stdin을 통해 전달하여 인자 길이 제한을 회피합니다.
   */
  async execute(
    ptyProcess: IPty,
    context: any,
    onData?: (data: string) => void
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    const wrapper = ptyProcess as ChildProcessWrapper;
    const cwd = wrapper.getCwd();

    // Build execution context
    const ctx: ExecutionContext =
      typeof context === 'string' ? { prompt: context, cwd } : { ...context, cwd };

    // Apply default system prompt if needed
    // Prepend default prompt to ensure non-interactive behavior
    const userSystemPrompt = ctx.systemPrompt || this.config.systemPrompt;
    ctx.systemPrompt = userSystemPrompt
      ? `${DEFAULT_SYSTEM_PROMPT}\n\n${userSystemPrompt}`
      : DEFAULT_SYSTEM_PROMPT;

    if (this.config.continueSession && ctx.continueSession === undefined) {
      ctx.continueSession = this.config.continueSession;
    }

    const claudePath = this.findClaude();
    const { args, prompt: stdinPrompt } = this.buildArgs(ctx);

    this.log('execute-start', {
      claudePath,
      args,
      promptLength: stdinPrompt.length,
      cwd,
    });

    return new Promise((resolve) => {
      let output = '';
      let errorOutput = '';

      // stdin을 통한 프롬프트 전달 방식:
      // 1. shell 사용 안 함 (escaping 문제 회피)
      // 2. stdin을 명시적으로 파이프로 설정
      // 3. 프롬프트를 stdin에 직접 쓰기
      const childProc = spawn(claudePath, args, {
        cwd,
        env: process.env,
        shell: false, // shell 사용 안 함 (escaping 문제 해결)
        windowsHide: true, // Hide window on Windows
        stdio: ['pipe', 'pipe', 'pipe'], // 명시적 파이프 설정
      });

      wrapper.setProcess(childProc);

      // 프롬프트를 stdin에 쓰고 EOF 전송
      // 이 방식으로 인자 길이 제한(~8191자 on Windows)을 완전히 회피
      if (childProc.stdin) {
        childProc.stdin.write(stdinPrompt, 'utf-8');
        childProc.stdin.end(); // EOF 전송
      }

      childProc.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        output += chunk;

        // Parse stream-json format and extract content
        // Claude Code stream-json format:
        // - assistant: {"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"..."}]}}
        // - user (tool_result): {"type":"user","message":{"role":"user","content":[{"type":"tool_result",...}]},"tool_use_result":{...}}
        const lines = chunk.split('\n').filter((line) => line.trim());
        for (const line of lines) {
          let contentExtracted = false;

          try {
            const parsed = JSON.parse(line);

            // Try each handler in sequence
            for (const handler of this.messageHandlers) {
              if (handler(parsed, onData)) {
                contentExtracted = true;
                break;
              }
            }

            // If JSON parsed but no known content field, log for debugging
            if (!contentExtracted && onData) {
              this.log('unknown-json-format', { parsed });
              // Forward as formatted JSON for visibility
              onData(`${JSON_MARKER}${JSON.stringify(parsed)}`);
            }
          } catch {
            // Not JSON or parsing failed - pass raw chunk as-is
            // (This can happen with partial chunks or plain text output)
            if (onData && line.trim()) {
              onData(line);
            }
          }
        }
      });

      childProc.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        this.log('stderr-chunk', { chunk });
        errorOutput += chunk;

        // Forward stderr to UI with special marker for identification
        // execution-manager will parse this and set type='stderr'
        if (onData && chunk.trim()) {
          onData(`${STDERR_MARKER}${chunk}`);
        }
      });

      childProc.on('close', (code) => {
        this.log('execute-end', {
          exitCode: code,
          outputLength: output.length,
          hasError: errorOutput.length > 0,
        });

        // Success case: exit code 0
        if (code === 0) {
          resolve({ success: true, output: output.trim() });
        } else {
          // Non-zero exit code - actual failure
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
    return this.execute(
      wrapper,
      {
        prompt,
        systemPrompt,
        continueSession: true,
      },
      onData
    );
  }
}
