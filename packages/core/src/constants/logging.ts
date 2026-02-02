/**
 * Logging-related constants
 */
export const LOG_DEFAULTS = {
  /** Maximum length for a single log entry to prevent excessive file growth */
  MAX_ENTRY_LENGTH: 500,

  /** Default number of lines to return when tailing logs */
  DEFAULT_TAIL_LINES: 100,
} as const;
