import chalk from 'chalk';
import type { Ora } from 'ora';

/**
 * 에러 컨텍스트 정보
 */
export interface ErrorContext {
  command: string;
  operation?: string;
}

/**
 * 통합 에러 핸들러
 * 일관된 에러 메시지 포맷 제공
 */
export function handleError(
  error: unknown,
  context: ErrorContext,
  spinner?: Ora
): void {
  const message = error instanceof Error ? error.message : String(error);
  const fullMessage = context.operation
    ? `${context.operation}: ${message}`
    : message;

  if (spinner) {
    spinner.fail(fullMessage);
  } else {
    console.error(chalk.red(`[${context.command}] Error:`), fullMessage);
  }

  // 개발 모드에서 스택 트레이스 출력
  if (process.env.DEBUG && error instanceof Error && error.stack) {
    console.error(chalk.gray(error.stack));
  }
}

/**
 * 에러 메시지 추출 헬퍼
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
