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

/**
 * Marker for tool execution
 * Used to indicate tool being called
 */
export const TOOL_MARKER = '[TOOL] ' as const;

/**
 * Marker for tool result
 * Used to show tool execution result
 */
export const TOOL_RESULT_MARKER = '[TOOL_RESULT] ' as const;

/**
 * Marker for todo progress
 * Used to forward todo progress information from Claude's TodoWrite
 */
export const TODO_PROGRESS_MARKER = '[TODO_PROGRESS] ' as const;

/**
 * Marker for final result
 * Used for Claude's final result message
 */
export const RESULT_MARKER = '[RESULT] ' as const;
