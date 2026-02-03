/**
 * Retry 유틸리티
 * 비동기 작업의 재시도 로직을 중앙 집중화
 */

export interface RetryOptions {
  maxRetries: number;
  delayMs: number;
  shouldRetry?: (error: unknown) => boolean;
}

/**
 * 비동기 작업을 재시도하는 래퍼
 */
export async function retryAsync<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      const shouldRetry = options.shouldRetry?.(error) ?? true;
      if (!shouldRetry || attempt === options.maxRetries) {
        throw error;
      }

      await sleep(options.delayMs);
    }
  }

  throw lastError;
}

/**
 * 지정된 시간만큼 대기
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 재시도 가능한 에러인지 확인 (Windows 파일 잠금 등)
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('permission denied') ||
    msg.includes('locked') ||
    msg.includes('unlink') ||
    msg.includes('ebusy')
  );
}
