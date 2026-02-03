import { appendFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { LOG_DEFAULTS } from './constants/logging.js';

/**
 * 로그 파일 관리
 */
export class LogManager {
  private logsDir: string;

  constructor(logsDir: string) {
    this.logsDir = logsDir;
  }

  /**
   * 로그 디렉토리 초기화
   */
  async init(): Promise<void> {
    if (!existsSync(this.logsDir)) {
      await mkdir(this.logsDir, { recursive: true });
    }
  }

  /**
   * 주문 로그 파일 경로
   */
  getLogPath(orderId: string): string {
    return join(this.logsDir, `${orderId}.log`);
  }

  /**
   * 로그 추가
   */
  async appendLog(orderId: string, message: string): Promise<void> {
    const logPath = this.getLogPath(orderId);
    const timestamp = new Date().toISOString();

    // Truncate long messages to prevent excessive file growth
    const truncatedMessage = message.length > LOG_DEFAULTS.MAX_ENTRY_LENGTH
      ? message.substring(0, LOG_DEFAULTS.MAX_ENTRY_LENGTH) + '...(truncated)'
      : message;

    const logLine = `[${timestamp}] ${truncatedMessage}\n`;
    await appendFile(logPath, logLine, 'utf-8');
  }

  /**
   * 로그 읽기
   */
  async readLog(orderId: string): Promise<string> {
    const logPath = this.getLogPath(orderId);
    if (!existsSync(logPath)) {
      return '';
    }
    return await readFile(logPath, 'utf-8');
  }

  /**
   * 로그 tail (마지막 N줄)
   */
  async tailLog(orderId: string, lines: number = LOG_DEFAULTS.DEFAULT_TAIL_LINES): Promise<string> {
    const content = await this.readLog(orderId);
    if (!content) {
      return '';
    }
    const allLines = content.split('\n');
    const tailLines = allLines.slice(-lines);
    return tailLines.join('\n');
  }
}
