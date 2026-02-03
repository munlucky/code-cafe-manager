import * as pty from 'node-pty';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { Platform } from './utils/platform.js';
import { buildSafeEnv } from './utils/env.js';
import type {
  IProvider,
  ProviderConfig,
  ValidationResult,
  SchemaExecutionConfig,
  SchemaExecutionResult,
} from './provider-interface.js';

/**
 * Provider 추상 클래스
 * Claude Code와 Codex Provider의 공통 로직을 추출
 */
export abstract class BaseProvider extends EventEmitter implements IProvider {
  protected ptyProcess: pty.IPty | null = null;
  protected isRunning: boolean = false;
  private timeoutId: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  /**
   * 추상 메서드 - 각 Provider에서 구현
   */
  protected abstract getCommandName(): string;
  protected abstract buildInteractiveCommand(prompt: string): string;
  protected abstract buildHeadlessArgs(config: SchemaExecutionConfig, promptPath: string): string[];
  abstract getAuthHint(): string;

  /**
   * CLI 실행 (인터랙티브 모드)
   */
  async run(config: ProviderConfig): Promise<void> {
    if (this.isRunning) {
      throw new Error('Provider is already running');
    }

    const shell = Platform.getShell();
    const command = config.prompt
      ? this.buildInteractiveCommand(config.prompt)
      : this.getCommandName();

    this.ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: config.workingDirectory,
      env: process.env as { [key: string]: string },
    });

    this.isRunning = true;
    this.setupEventHandlers();
    this.setupTimeout(config.timeout);

    // 명령 실행 (플랫폼별 줄바꿈)
    const lineEnding = Platform.getLineEnding();
    this.ptyProcess.write(`${command}${lineEnding}`);
  }

  /**
   * 입력 전송 (인터랙티브 모드)
   */
  write(data: string): void {
    if (!this.ptyProcess || !this.isRunning) {
      throw new Error('Provider is not running');
    }
    this.ptyProcess.write(data);
  }

  /**
   * 프로세스 중지
   */
  stop(): void {
    this.clearTimeout();
    if (this.ptyProcess && this.isRunning) {
      this.ptyProcess.kill();
      this.isRunning = false;
    }
  }

  /**
   * 실행 상태 확인
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Schema 기반 실행 (Orchestrator용)
   */
  async executeWithSchema(config: SchemaExecutionConfig): Promise<SchemaExecutionResult> {
    try {
      // Output 디렉토리 생성
      if (!fs.existsSync(config.outputDir)) {
        fs.mkdirSync(config.outputDir, { recursive: true });
      }

      // 프롬프트 파일 생성
      const promptPath = path.join(config.outputDir, 'prompt.txt');
      if (config.prompt) {
        fs.writeFileSync(promptPath, config.prompt, 'utf-8');
      }

      // CLI 명령 구성 (Provider별 구현)
      const command = this.getCommandName();
      const args = this.buildHeadlessArgs(config, promptPath);

      // 환경 변수 설정
      const env = buildSafeEnv(config.env);

      // 명령 실행
      const result = await this.executeCommand(command, args, {
        cwd: config.workingDirectory,
        env: env as Record<string, string>,
        timeout: config.timeout || 1800000, // 기본 30분
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          rawText: result.stdout,
        };
      }

      // JSON 파싱
      try {
        const output = JSON.parse(result.stdout || '{}');

        // 결과 파일 저장
        const resultPath = path.join(config.outputDir, 'result.json');
        fs.writeFileSync(resultPath, JSON.stringify(output, null, 2), 'utf-8');

        return {
          success: true,
          output,
          rawText: result.stdout,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to parse JSON output: ${error instanceof Error ? error.message : 'Unknown error'}`,
          rawText: result.stdout,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 환경 검증 (CLI 설치 여부)
   */
  static async validateEnvForCommand(commandName: string): Promise<ValidationResult> {
    return new Promise((resolve) => {
      const checkCommand = Platform.getCommandCheck();
      const ext = Platform.getExecutableExtension();
      const args = [`${commandName}${ext}`];

      const proc = spawn(checkCommand, args, {
        timeout: 5000,
        stdio: 'pipe',
      });

      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        proc.kill();
        resolve({
          valid: false,
          message: `${commandName} CLI check timed out`,
        });
      }, 5000);

      proc.on('error', () => {
        if (!timedOut) {
          clearTimeout(timeout);
          resolve({
            valid: false,
            message: `${commandName} CLI is not installed or not in PATH`,
          });
        }
      });

      proc.on('exit', (code: number | null) => {
        if (!timedOut) {
          clearTimeout(timeout);
          if (code === 0) {
            resolve({ valid: true });
          } else {
            resolve({
              valid: false,
              message: `${commandName} CLI is not installed or not in PATH`,
            });
          }
        }
      });
    });
  }

  /**
   * 이벤트 핸들러 설정
   */
  private setupEventHandlers(): void {
    if (!this.ptyProcess) return;

    this.ptyProcess.onData((data: string) => {
      this.emit('data', data);
    });

    this.ptyProcess.onExit((exitInfo: { exitCode: number; signal?: number }) => {
      this.clearTimeout();
      this.isRunning = false;
      this.emit('exit', exitInfo);
    });
  }

  /**
   * 타임아웃 설정
   */
  private setupTimeout(timeoutSec?: number): void {
    if (timeoutSec) {
      this.timeoutId = setTimeout(() => {
        if (this.isRunning) {
          this.stop();
          this.emit('error', new Error('Execution timeout'));
        }
      }, timeoutSec * 1000);
    }
  }

  /**
   * 타임아웃 정리
   */
  private clearTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * 명령 실행 헬퍼 (headless 모드)
   */
  protected executeCommand(
    command: string,
    args: string[],
    options: {
      cwd: string;
      env: Record<string, string>;
      timeout: number;
    }
  ): Promise<{ success: boolean; stdout?: string; stderr?: string; error?: string }> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let resolved = false;

      const proc = spawn(command, args, {
        cwd: options.cwd,
        env: options.env,
        shell: true,
      });

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (resolved) return;
        resolved = true;

        if (code === 0) {
          resolve({
            success: true,
            stdout,
          });
        } else {
          resolve({
            success: false,
            error: `Command exited with code ${code}`,
            stderr,
            stdout,
          });
        }
      });

      proc.on('error', (error) => {
        if (resolved) return;
        resolved = true;

        resolve({
          success: false,
          error: `Failed to execute command: ${error.message}`,
        });
      });

      // Timeout 설정
      const timeoutId = setTimeout(() => {
        if (resolved) return;
        resolved = true;

        proc.kill();
        resolve({
          success: false,
          error: `Command timeout after ${options.timeout}ms`,
          stderr,
          stdout,
        });
      }, options.timeout);

      proc.on('close', () => {
        clearTimeout(timeoutId);
      });
    });
  }
}
