/**
 * Output Markers
 * Special markers used for identifying different output types
 *
 * NOTE: These constants are duplicated in packages/desktop/src/common/output-markers.ts
 * Keep them in sync when making changes.
 */

/**
 * Marker for stderr output
 * Used by adapter to tag stderr chunks before sending to execution-manager
 */
export const STDERR_MARKER = '[STDERR] ' as const;

/**
 * Marker for JSON-formatted output
 * Used when unknown JSON formats are encountered in stream parsing
 */
export const JSON_MARKER = '[JSON] ' as const;
