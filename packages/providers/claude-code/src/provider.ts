import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import { platform } from 'os';
import { spawn } from 'child_process';
import {
  IProvider,
  ProviderConfig,
  ValidationResult,
} from '@codecafe/providers-common';

export interface ProviderEvent {
  type: 'data' | 'exit' | 'error';
  data: any;
}

/**
 * Claude Code Provider
 * PTY를 사용해 Claude Code CLI를 실행하고 로그를 스트리밍합니다.
 */
export class ClaudeCodeProvider extends EventEmitter implements IProvider {
  private ptyProcess: pty.IPty | null = null;
  private isRunning: boolean = false;

  constructor() {
    super();
  }

  /**
   * Claude Code CLI 실행
   */
  async run(config: ProviderConfig): Promise<void> {
    if (this.isRunning) {
      throw new Error('Provider is already running');
    }

    // Windows와 Unix 계열 OS에 따라 shell 선택
    const shell = platform() === 'win32' ? 'powershell.exe' : 'bash';

    // Claude CLI 명령
    const command = config.prompt ? `claude "${config.prompt}"` : 'claude';

    this.ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: config.workingDirectory,
      env: process.env as { [key: string]: string },
    });

    this.isRunning = true;

    // 데이터 이벤트 처리
    this.ptyProcess.onData((data: string) => {
      this.emit('data', data);
    });

    // 종료 이벤트 처리
    this.ptyProcess.onExit(({ exitCode, signal }) => {
      this.isRunning = false;
      this.emit('exit', { exitCode, signal });
    });

    // Claude 명령 실행
    if (platform() === 'win32') {
      this.ptyProcess.write(`${command}\r`);
    } else {
      this.ptyProcess.write(`${command}\n`);
    }

    // Timeout 설정
    if (config.timeout) {
      setTimeout(() => {
        if (this.isRunning) {
          this.stop();
          this.emit('error', new Error('Execution timeout'));
        }
      }, config.timeout * 1000);
    }
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
   * 환경 검증 (Claude CLI 설치 여부)
   * PTY 대신 간단한 spawn 사용으로 타임아웃 문제 해결
   */
  static async validateEnv(): Promise<ValidationResult> {
    return new Promise((resolve) => {
      const command = platform() === 'win32' ? 'where' : 'which';
      const args = platform() === 'win32' ? ['claude.exe'] : ['claude'];

      const proc = spawn(command, args, {
        timeout: 5000, // 5초 타임아웃
        stdio: 'pipe',
      });

      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        proc.kill();
        resolve({
          valid: false,
          message: 'Claude CLI check timed out',
        });
      }, 5000);

      proc.on('error', () => {
        if (!timedOut) {
          clearTimeout(timeout);
          resolve({
            valid: false,
            message: 'Claude CLI is not installed or not in PATH',
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
              message: 'Claude CLI is not installed or not in PATH',
            });
          }
        }
      });
    });
  }

  /**
   * 인증 힌트 제공
   */
  static getAuthHint(): string {
    return 'Run "claude login" to authenticate with Claude';
  }
}
