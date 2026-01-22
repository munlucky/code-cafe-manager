/**
 * File Logger
 * console.log 출력을 파일에도 동시에 기록
 */

import { appendFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const LOG_DIR = join(homedir(), '.codecafe', 'logs');
const MAIN_LOG_FILE = join(LOG_DIR, 'desktop-main.log');
const TERMINAL_LOG_FILE = join(LOG_DIR, 'desktop-terminal.log');

let isInitialized = false;

/**
 * 로그 디렉토리 초기화
 */
async function ensureLogDir(): Promise<void> {
  if (!isInitialized) {
    if (!existsSync(LOG_DIR)) {
      await mkdir(LOG_DIR, { recursive: true });
    }
    isInitialized = true;
  }
}

/**
 * 타임스탬프 생성
 */
function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * 로그 메시지 포맷팅
 */
function formatMessage(level: string, args: unknown[]): string {
  const timestamp = getTimestamp();
  const message = args
    .map((arg) => {
      if (typeof arg === 'string') {
        return arg;
      }
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');
  return `[${timestamp}] [${level}] ${message}\n`;
}

/**
 * 파일에 로그 추가
 */
async function writeToFile(filePath: string, message: string): Promise<void> {
  try {
    await ensureLogDir();
    await appendFile(filePath, message, 'utf-8');
  } catch (error) {
    // 로그 파일 쓰기 실패는 무시 (무한 루프 방지)
  }
}

/**
 * 원본 console 메서드 저장
 */
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
};

/**
 * 메인 프로세스 로거 - console 오버라이드
 */
export function setupMainProcessLogger(): void {
  // 이미 설정되어 있으면 중복 설정 방지
  if ((console.log as any).__fileLoggerInstalled) {
    return;
  }

  console.log = (...args: unknown[]) => {
    originalConsole.log(...args);
    writeToFile(MAIN_LOG_FILE, formatMessage('INFO', args)).catch(() => {});
  };

  console.error = (...args: unknown[]) => {
    originalConsole.error(...args);
    writeToFile(MAIN_LOG_FILE, formatMessage('ERROR', args)).catch(() => {});
  };

  console.warn = (...args: unknown[]) => {
    originalConsole.warn(...args);
    writeToFile(MAIN_LOG_FILE, formatMessage('WARN', args)).catch(() => {});
  };

  console.info = (...args: unknown[]) => {
    originalConsole.info(...args);
    writeToFile(MAIN_LOG_FILE, formatMessage('INFO', args)).catch(() => {});
  };

  console.debug = (...args: unknown[]) => {
    originalConsole.debug(...args);
    writeToFile(MAIN_LOG_FILE, formatMessage('DEBUG', args)).catch(() => {});
  };

  (console.log as any).__fileLoggerInstalled = true;
}

/**
 * 터미널 로그 전용 로거
 */
export const terminalLogger = {
  /**
   * 터미널 출력 로그 기록
   */
  log: async (orderId: string, data: string): Promise<void> => {
    const timestamp = getTimestamp();
    const message = `[${timestamp}] [Order:${orderId}] ${data}\n`;
    await writeToFile(TERMINAL_LOG_FILE, message);
  },

  /**
   * 로그 파일 경로 반환
   */
  getLogPath: (): string => TERMINAL_LOG_FILE,

  /**
   * 메인 로그 파일 경로 반환
   */
  getMainLogPath: (): string => MAIN_LOG_FILE,
};

/**
 * 로그 디렉토리 경로 반환
 */
export function getLogDir(): string {
  return LOG_DIR;
}
