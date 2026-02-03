/**
 * Development-only logger utility
 * Logs are only emitted in development environment
 */

const isDev = process.env.NODE_ENV === 'development';

export const logger = {
  debug: isDev ? console.log.bind(console, '[DEBUG]') : () => {},
  info: isDev ? console.info.bind(console, '[INFO]') : () => {},
  warn: console.warn.bind(console, '[WARN]'),
  error: console.error.bind(console, '[ERROR]'),
};

/**
 * Conditional dev log for component-specific debugging
 * @param component - Component name for prefix
 * @returns Dev log function or no-op in production
 */
export function createDevLog(component: string): (...args: unknown[]) => void {
  return isDev
    ? console.log.bind(console, `[${component}]`)
    : () => {};
}
