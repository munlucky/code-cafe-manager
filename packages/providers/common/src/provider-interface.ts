import { EventEmitter } from 'events';

/**
 * Provider 설정
 */
export interface ProviderConfig {
  workingDirectory: string;
  prompt?: string;
  timeout?: number;
}

/**
 * Schema 기반 실행 설정
 */
export interface SchemaExecutionConfig extends ProviderConfig {
  schemaPath: string;
  outputDir: string;
  env?: Record<string, string>;
}

/**
 * Schema 기반 실행 결과
 */
export interface SchemaExecutionResult {
  success: boolean;
  output?: any;
  rawText?: string;
  error?: string;
}

/**
 * Provider 공통 인터페이스
 */
export interface IProvider extends EventEmitter {
  /**
   * Provider 실행
   * @emits 'data' - 로그 데이터 스트리밍
   * @emits 'exit' - 프로세스 종료
   * @emits 'error' - 에러 발생
   */
  run(config: ProviderConfig): Promise<void>;

  /**
   * 입력 전송 (인터랙티브 모드)
   */
  write(data: string): void;

  /**
   * 프로세스 중지
   */
  stop(): void;

  /**
   * 실행 상태 확인
   */
  isActive(): boolean;

  /**
   * Schema 기반 실행 (Orchestrator용)
   * JSON Schema를 기반으로 구조화된 출력을 생성합니다.
   */
  executeWithSchema?(config: SchemaExecutionConfig): Promise<SchemaExecutionResult>;
}

/**
 * Provider 환경 검증 결과
 */
export interface ValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Provider 정적 메서드 인터페이스 (TypeScript 한계로 인해 별도 정의)
 */
export interface IProviderStatic {
  /**
   * 환경 검증 (CLI 설치 여부)
   */
  validateEnv(): Promise<ValidationResult>;

  /**
   * 인증 힌트 제공
   */
  getAuthHint(): string;
}
