/**
 * Logger types for @codecafe/core
 * Console-based runtime logging utilities
 */

/**
 * Log level definitions
 * Higher numbers indicate higher severity
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

/**
 * Log entry structure for JSON format output
 */
export interface LogEntry {
  timestamp: string;
  level: keyof typeof LogLevel;
  message: string;
  context?: string;
  data?: Record<string, unknown>;
}

/**
 * Logger configuration options
 */
export interface LoggerOptions {
  /** Log level threshold (default: determined by environment) */
  level?: LogLevel;
  /** Enable JSON format output (default: false) */
  json?: boolean;
  /** Logger context identifier (e.g., 'OrderService', 'BaristaPool') */
  context?: string;
  /** Include timestamp in output (default: true) */
  timestamp?: boolean;
}

/**
 * Logger interface
 */
export interface ILogger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  fatal(message: string, data?: Record<string, unknown>): void;
  child(context: string): ILogger;
}
