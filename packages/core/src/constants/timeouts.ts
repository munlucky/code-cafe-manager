/**
 * Timeout constants (in milliseconds)
 */
export const TIMEOUTS = {
  /** Base unit: 1 second */
  SECOND: 1000,

  /** 5 seconds - Default initialization timeout */
  INIT: 5000,

  /** 10 seconds - Idle timeout */
  IDLE: 10000,

  /** 30 seconds - Default command execution timeout */
  COMMAND_EXECUTION: 30000,

  /** 60 seconds (1 minute) - Long-running operation timeout */
  MINUTE: 60000,

  /** 1 hour - Session cleanup threshold */
  SESSION_CLEANUP: 3600000,

  /** 24 hours - Registry TTL */
  DAY: 24 * 60 * 60 * 1000,
} as const;

/** Output size thresholds (in bytes) */
export const OUTPUT_THRESHOLDS = {
  /** Minimum output size to be considered substantial (1KB) */
  SUBSTANTIAL: 1000,

  /** Very large output size (10KB) */
  VERY_SUBSTANTIAL: 10000,
} as const;
