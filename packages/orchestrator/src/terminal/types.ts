/**
 * Terminal Types and Enums
 *
 * Extracted from terminal-pool.ts for type safety
 */

/**
 * Terminal status enum - replaces string literals for type safety
 */
export enum TerminalStatus {
  IDLE = 'idle',
  BUSY = 'busy',
  CRASHED = 'crashed',
  INITIALIZING = 'initializing',
}

/**
 * Type guard for TerminalStatus
 */
export function isTerminalStatus(value: string): value is TerminalStatus {
  return Object.values(TerminalStatus).includes(value as TerminalStatus);
}

/**
 * Check if terminal status is available for lease
 */
export function isAvailableStatus(status: TerminalStatus): boolean {
  return status === TerminalStatus.IDLE;
}

/**
 * Check if terminal needs restart
 */
export function needsRestart(status: TerminalStatus): boolean {
  return status === TerminalStatus.CRASHED;
}
