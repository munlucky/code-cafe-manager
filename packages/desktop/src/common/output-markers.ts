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

/**
 * Output type discriminator
 */
export type OutputType = 'stdout' | 'stderr' | 'system' | 'user-input' | 'tool' | 'tool_result' | 'todo_progress' | 'result';

/**
 * Todo progress data structure
 */
export interface TodoProgress {
  completed: number;
  inProgress: number;
  total: number;
  todos?: Array<{
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
    activeForm?: string;
  }>;
}

/**
 * Parse output type from content with markers
 * Detects special markers and returns the type and cleaned content
 */
export function parseOutputType(content: string): { type: OutputType; content: string; todoProgress?: TodoProgress } {
  if (content.startsWith(STDERR_MARKER)) {
    return {
      type: 'stderr',
      content: content.substring(STDERR_MARKER.length),
    };
  }

  if (content.startsWith(TOOL_MARKER)) {
    return {
      type: 'tool',
      content: content.substring(TOOL_MARKER.length),
    };
  }

  if (content.startsWith(TOOL_RESULT_MARKER)) {
    return {
      type: 'tool_result',
      content: content.substring(TOOL_RESULT_MARKER.length),
    };
  }

  if (content.startsWith(TODO_PROGRESS_MARKER)) {
    const jsonStr = content.substring(TODO_PROGRESS_MARKER.length);
    try {
      const todoProgress = JSON.parse(jsonStr) as TodoProgress;
      return {
        type: 'todo_progress',
        content: `Tasks: ${todoProgress.completed}/${todoProgress.total} completed`,
        todoProgress,
      };
    } catch {
      return {
        type: 'todo_progress',
        content: jsonStr,
      };
    }
  }

  if (content.startsWith(RESULT_MARKER)) {
    return {
      type: 'result',
      content: content.substring(RESULT_MARKER.length),
    };
  }

  // Default to stdout
  return {
    type: 'stdout',
    content,
  };
}
