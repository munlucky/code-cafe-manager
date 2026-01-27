/**
 * Logger implementation for @codecafe/core
 * Console-based runtime logging with environment-aware log levels
 */

import { ILogger, LoggerOptions, LogLevel, LogEntry } from './types.js';

/**
 * Get default log level based on NODE_ENV
 * - development: DEBUG (show all logs)
 * - production: WARN (show warnings and errors only)
 * - test: ERROR (show errors only)
 */
function getDefaultLogLevel(): LogLevel {
  const env = process.env.NODE_ENV || 'development';
  switch (env) {
    case 'production':
      return LogLevel.WARN;
    case 'test':
      return LogLevel.ERROR;
    default:
      return LogLevel.DEBUG;
  }
}

/**
 * Get log level name from enum value
 */
function getLevelName(level: LogLevel): keyof typeof LogLevel {
  const names: Record<LogLevel, keyof typeof LogLevel> = {
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR',
    [LogLevel.FATAL]: 'FATAL',
  };
  return names[level];
}

/**
 * Logger class
 * Provides structured logging with configurable levels and formats
 */
export class Logger implements ILogger {
  private readonly level: LogLevel;
  private readonly json: boolean;
  private readonly context?: string;
  private readonly timestamp: boolean;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? getDefaultLogLevel();
    this.json = options.json ?? false;
    this.context = options.context;
    this.timestamp = options.timestamp ?? true;
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (level < this.level) {
      return;
    }

    const output = this.json
      ? this.formatJson(level, message, data)
      : this.formatText(level, message, data);

    // Route to appropriate console method
    if (level >= LogLevel.ERROR) {
      process.stderr.write(output + '\n');
    } else {
      process.stdout.write(output + '\n');
    }
  }

  /**
   * Format log entry as JSON
   */
  private formatJson(level: LogLevel, message: string, data?: Record<string, unknown>): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: getLevelName(level),
      message,
    };

    if (this.context) {
      entry.context = this.context;
    }

    if (data && Object.keys(data).length > 0) {
      entry.data = data;
    }

    return JSON.stringify(entry);
  }

  /**
   * Format log entry as human-readable text
   */
  private formatText(level: LogLevel, message: string, data?: Record<string, unknown>): string {
    const parts: string[] = [];

    if (this.timestamp) {
      parts.push(`[${new Date().toISOString()}]`);
    }

    parts.push(`[${getLevelName(level)}]`);

    if (this.context) {
      parts.push(`[${this.context}]`);
    }

    parts.push(message);

    if (data && Object.keys(data).length > 0) {
      parts.push(JSON.stringify(data));
    }

    return parts.join(' ');
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, data);
  }

  fatal(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.FATAL, message, data);
  }

  /**
   * Create a child logger with additional context
   * Child context is appended to parent context with a colon separator
   */
  child(context: string): ILogger {
    const childContext = this.context ? `${this.context}:${context}` : context;
    return new Logger({
      level: this.level,
      json: this.json,
      context: childContext,
      timestamp: this.timestamp,
    });
  }
}

/**
 * Create a new Logger instance
 */
export function createLogger(options?: LoggerOptions): ILogger {
  return new Logger(options);
}

/**
 * Global default logger instance
 */
export const logger: ILogger = new Logger();
