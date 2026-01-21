/**
 * Output Markers
 * Special markers used for identifying different output types across the application
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
 * Output type discriminator
 */
export type OutputType = 'stdout' | 'stderr' | 'system' | 'user-input';

/**
 * Parse output type from content with markers
 * Detects special markers and returns the type and cleaned content
 */
export function parseOutputType(content: string): { type: OutputType; content: string } {
  if (content.startsWith(STDERR_MARKER)) {
    return {
      type: 'stderr',
      content: content.substring(STDERR_MARKER.length),
    };
  }

  // Default to stdout
  return {
    type: 'stdout',
    content,
  };
}
