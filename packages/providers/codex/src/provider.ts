import * as fs from 'fs';
import {
  BaseProvider,
  ValidationResult,
  SchemaExecutionConfig,
} from '@codecafe/providers-common';

/**
 * Codex Provider
 * PTY를 사용해 Codex CLI를 실행하고 로그를 스트리밍합니다.
 */
export class CodexProvider extends BaseProvider {
  /**
   * CLI 명령 이름
   */
  protected getCommandName(): string {
    return 'codex';
  }

  /**
   * 인터랙티브 모드 명령 구성
   */
  protected buildInteractiveCommand(prompt: string): string {
    return `codex "${prompt}"`;
  }

  /**
   * Headless 모드 인자 구성
   */
  protected buildHeadlessArgs(config: SchemaExecutionConfig, promptPath: string): string[] {
    const args = ['exec', '--json'];

    if (fs.existsSync(config.schemaPath)) {
      args.push('--output-schema', config.schemaPath);
    }

    if (config.prompt) {
      args.push('-i', promptPath);
    }

    return args;
  }

  /**
   * 인증 힌트 제공
   */
  getAuthHint(): string {
    return 'Run "codex login" or configure Codex authentication to proceed';
  }

  /**
   * 환경 검증 (Codex CLI 설치 여부)
   */
  static async validateEnv(): Promise<ValidationResult> {
    return BaseProvider.validateEnvForCommand('codex');
  }
}
