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
// Maximum length for a single log entry to prevent excessive file growth
const MAX_LOG_ENTRY_LENGTH = 2000;

function formatMessage(level: string, args: unknown[]): string {
  const timestamp = getTimestamp();
  const message = args
    .map((arg) => {
      if (typeof arg === 'string') {
        return arg.length > MAX_LOG_ENTRY_LENGTH
          ? arg.substring(0, MAX_LOG_ENTRY_LENGTH) + '...(truncated)'
          : arg;
      }
      try {
        const jsonStr = JSON.stringify(arg);
        return jsonStr.length > MAX_LOG_ENTRY_LENGTH
          ? jsonStr.substring(0, MAX_LOG_ENTRY_LENGTH) + '...(truncated)'
          : jsonStr;
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
 * Tool input 요약 (최대 100자)
 */
function summarizeToolInput(input: unknown): string {
  if (!input || typeof input !== 'object') {
    return String(input).slice(0, 100);
  }

  const obj = input as Record<string, unknown>;
  const parts: string[] = [];

  if (obj.file_path) {
    parts.push(`file: ${obj.file_path}`);
  }
  if (obj.command) {
    parts.push(`cmd: ${String(obj.command).slice(0, 50)}`);
  }
  if (obj.pattern) {
    parts.push(`pattern: ${obj.pattern}`);
  }
  if (obj.path) {
    parts.push(`path: ${obj.path}`);
  }
  if (obj.query) {
    parts.push(`query: ${String(obj.query).slice(0, 50)}`);
  }

  if (parts.length === 0) {
    const keys = Object.keys(obj).slice(0, 3).join(', ');
    return `{${keys}}`;
  }

  const result = parts.join(' | ');
  return result.length > 100 ? result.slice(0, 97) + '...' : result;
}

/**
 * Tool result 요약
 */
function summarizeToolResult(content: unknown): string {
  if (content === null || content === undefined) {
    return '[empty]';
  }

  let str: string;
  if (typeof content === 'string') {
    str = content;
  } else {
    try {
      str = JSON.stringify(content);
    } catch {
      str = String(content);
    }
  }

  // File content detection (line number pattern: ^\s*\d+->)
  const fileLinePattern = /^\s*\d+->/m;
  if (fileLinePattern.test(str)) {
    const lines = str.split('\n').filter((l) => fileLinePattern.test(l));
    const lineCount = lines.length;
    const preview = str.slice(0, 50).replace(/\n/g, ' ');
    return `[File: ${lineCount} lines] ${preview}...`;
  }

  // JSON detection
  if (str.startsWith('{') || str.startsWith('[')) {
    try {
      const parsed = JSON.parse(str);
      const keys = Array.isArray(parsed)
        ? `array[${parsed.length}]`
        : Object.keys(parsed).slice(0, 5).join(', ');
      return `[JSON] {${keys}} (${str.length} chars)`;
    } catch {
      // Not valid JSON, continue
    }
  }

  // Plain text (max 150 chars)
  const cleaned = str.replace(/\s+/g, ' ').trim();
  return cleaned.length > 150 ? cleaned.slice(0, 147) + '...' : cleaned;
}

/**
 * 메시지 블록 타입
 */
interface MessageBlock {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking';
  text?: string;
  name?: string;
  id?: string;
  tool_use_id?: string;
  input?: unknown;
  content?: string | unknown;
}

/**
 * 메시지 구조
 */
interface StructuredMessage {
  type?: 'assistant' | 'user' | 'system';
  message?: {
    content?: MessageBlock[] | unknown;
  } | unknown;
  content?: unknown;
}

/**
 * 안전한 객체 타입 가드
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

/**
 * 메시지 타입별 포맷팅
 */
function formatParsedMessage(msg: unknown): string[] | null {
  if (!isObject(msg)) {
    return null;
  }

  const message = msg as StructuredMessage;
  const results: string[] = [];
  const msgType = typeof message.type === 'string' ? message.type : '';

  // assistant message
  if (msgType === 'assistant' && isObject(message.message)) {
    const inner = message.message;
    const content = inner.content;

    if (Array.isArray(content)) {
      for (const block of content) {
        if (!isObject(block)) continue;

        const blockType = block.type;
        if (blockType === 'text' && typeof block.text === 'string') {
          const text = block.text.slice(0, 100);
          results.push(`[ASSISTANT] ${text}${block.text.length > 100 ? '...' : ''}`);
        } else if (blockType === 'tool_use') {
          const toolName = typeof block.name === 'string' ? block.name : 'unknown';
          const inputSummary = summarizeToolInput(block.input);
          results.push(`[TOOL_USE:${toolName}] ${inputSummary}`);
        }
      }
    }
  }

  // user message (tool_result)
  if (msgType === 'user' && isObject(message.message)) {
    const inner = message.message;
    const content = inner.content;

    if (Array.isArray(content)) {
      for (const block of content) {
        if (!isObject(block)) continue;

        if (block.type === 'tool_result') {
          const toolId = typeof block.tool_use_id === 'string'
            ? block.tool_use_id.slice(-8)
            : 'unknown';
          const summary = summarizeToolResult(block.content);
          results.push(`[TOOL_RESULT:${toolId}] ${summary}`);
        }
      }
    }
  }

  // system message
  if (msgType === 'system') {
    const content = message.message ?? message.content ?? '';
    let text: string;

    if (typeof content === 'string') {
      text = content;
    } else if (isObject(content)) {
      try {
        text = JSON.stringify(content);
      } catch {
        text = '[Serialization Error] ' + String(content);
      }
    } else {
      text = String(content);
    }

    results.push(`[SYSTEM] ${text.slice(0, 100)}${text.length > 100 ? '...' : ''}`);
  }

  return results.length > 0 ? results : null;
}

/**
 * 터미널 데이터 파싱 및 포맷팅
 */
function parseAndFormatTerminalData(orderId: string, data: string): string {
  const timestamp = getTimestamp();
  const prefix = `[${timestamp}] [Order:${orderId}]`;

  // Try to parse as JSON
  try {
    const parsed = JSON.parse(data);
    const formatted = formatParsedMessage(parsed);

    if (formatted && formatted.length > 0) {
      return formatted.map((line) => `${prefix} ${line}`).join('\n');
    }
  } catch {
    // Not JSON, use original
  }

  // Fallback: original format (truncated for readability)
  const truncated = data.length > 500 ? data.slice(0, 497) + '...' : data;
  return `${prefix} ${truncated}`;
}

/**
 * 터미널 로그 전용 로거
 */
export const terminalLogger = {
  /**
   * 터미널 출력 로그 기록 (human-readable format)
   */
  log: async (orderId: string, data: string): Promise<void> => {
    const message = parseAndFormatTerminalData(orderId, data) + '\n';
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
