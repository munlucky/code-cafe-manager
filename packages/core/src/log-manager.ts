import { appendFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

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
    const logLine = `[${timestamp}] ${message}\n`;
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
  async tailLog(orderId: string, lines: number = 100): Promise<string> {
    const content = await this.readLog(orderId);
    if (!content) {
      return '';
    }
    const allLines = content.split('\n');
    const tailLines = allLines.slice(-lines);
    return tailLines.join('\n');
  }
}
