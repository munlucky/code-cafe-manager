import * as fs from 'fs';
import {
  BaseProvider,
  ValidationResult,
  SchemaExecutionConfig,
} from '@codecafe/providers-common';

/**
 * Claude Code Provider
 * PTY를 사용해 Claude Code CLI를 실행하고 로그를 스트리밍합니다.
 */
export class ClaudeCodeProvider extends BaseProvider {
  /**
   * CLI 명령 이름
   */
  protected getCommandName(): string {
    return 'claude';
  }

  /**
   * 인터랙티브 모드 명령 구성
   */
  protected buildInteractiveCommand(prompt: string): string {
    return `claude "${prompt}"`;
  }

  /**
   * Headless 모드 인자 구성
   */
  protected buildHeadlessArgs(config: SchemaExecutionConfig, promptPath: string): string[] {
    const args: string[] = [];

    if (config.prompt) {
      args.push('-p', `@${promptPath}`);
    }

    args.push('--output-format', 'json');

    return args;
  }

  /**
   * 인증 힌트 제공
   */
  getAuthHint(): string {
    return 'Run "claude login" to authenticate with Claude';
  }

  /**
   * 환경 검증 (Claude CLI 설치 여부)
   */
  static async validateEnv(): Promise<ValidationResult> {
    return BaseProvider.validateEnvForCommand('claude');
  }
}
