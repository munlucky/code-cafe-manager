/**
 * Output Markers
 * Special markers used for identifying different output types across the application
 */

/**
 * HTML 엔티티 디코딩
 * JSON 내의 &quot; &amp; 등을 원래 문자로 변환
 */
function decodeHtmlEntities(text: string): string {
  const htmlDecodeMap: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#x27;': "'",
    '&apos;': "'",
  };

  return text.replace(/&(amp|lt|gt|quot|#39|#x27|apos);/g, (match) => htmlDecodeMap[match] || match);
}

/**
 * Stage별 카테고리 매핑
 * followup-* 패턴은 FOLLOWUP 카테고리로 처리
 */
function getStageCategory(stageId: string): string {
  // FOLLOWUP 패턴 처리 (followup-1234567890 형태)
  if (/^followup-\d+$/.test(stageId)) {
    return 'FOLLOWUP';
  }

  const categoryMap: Record<string, string> = {
    'analyze': 'ANALYSIS',
    'plan': 'PLANNING',
    'code': 'IMPLEMENTATION',
    'review': 'VERIFICATION',
    'test': 'VERIFICATION',
    'check': 'VERIFICATION',
  };
  return categoryMap[stageId] || stageId.toUpperCase();
}

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
 * Marker for file edit operations
 * Format: [FILE_EDIT] {"type": "write|edit", "path": "...", "success": true}
 */
export const FILE_EDIT_MARKER = '[FILE_EDIT] ' as const;

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
 * Marker for stage started
 * Format: [STAGE_START] {"stageId": "...", "provider": "...", "stageName": "..."}
 */
export const STAGE_START_MARKER = '[STAGE_START] ' as const;

/**
 * Marker for stage completed
 * Format: [STAGE_END] {"stageId": "...", "status": "completed|failed", "duration": 1234}
 */
export const STAGE_END_MARKER = '[STAGE_END] ' as const;

/**
 * Marker for user prompt (order execution request)
 * Used to identify the original user request
 */
export const USER_PROMPT_MARKER = '[USER_PROMPT] ' as const;

/**
 * Output type discriminator
 */
export type OutputType = 'stdout' | 'stderr' | 'system' | 'user-input' | 'tool' | 'tool_result' | 'file_edit' | 'todo_progress' | 'result' | 'stage_start' | 'stage_end' | 'user_prompt';

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
 * Stage info data structure
 */
export interface StageInfo {
  stageId: string;
  provider?: string;
  stageName?: string;
  status?: 'started' | 'completed' | 'failed';
  duration?: number;
  skills?: string[];
}

/**
 * Validate StageInfo structure from parsed JSON
 * Returns true if the object has the required stageId field
 */
function isValidStageInfo(obj: unknown): obj is StageInfo {
  return typeof obj === 'object' && obj !== null && typeof (obj as StageInfo).stageId === 'string';
}

/**
 * Parse output type from content with markers
 * Detects special markers and returns the type and cleaned content
 */
export function parseOutputType(content: string): { type: OutputType; content: string; todoProgress?: TodoProgress; stageInfo?: StageInfo } {
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

  if (content.startsWith(FILE_EDIT_MARKER)) {
    const jsonStr = content.substring(FILE_EDIT_MARKER.length);
    try {
      const parsed = JSON.parse(jsonStr);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        typeof parsed.type === 'string' &&
        typeof parsed.path === 'string' &&
        typeof parsed.success === 'boolean'
      ) {
        const icon = parsed.success ? '+' : 'x';
        const action = parsed.type === 'write' ? 'Created' : 'Modified';
        return {
          type: 'file_edit',
          content: `[${icon}] ${action}: ${parsed.path}`,
        };
      }
      throw new Error('Invalid FILE_EDIT JSON structure');
    } catch (error) {
      console.error(`[parseOutputType] Failed to parse FILE_EDIT JSON:`, error, jsonStr);
      return {
        type: 'file_edit',
        content: jsonStr,
      };
    }
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
    } catch (error) {
      console.error(`[parseOutputType] Failed to parse TODO_PROGRESS JSON:`, error, jsonStr);
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

  if (content.startsWith(STAGE_START_MARKER)) {
    const jsonStr = content.substring(STAGE_START_MARKER.length);
    try {
      // HTML 엔티티 디코딩 후 JSON 파싱
      const decodedJsonStr = decodeHtmlEntities(jsonStr);
      const parsed = JSON.parse(decodedJsonStr);
      if (!isValidStageInfo(parsed)) {
        throw new Error('Invalid STAGE_START JSON structure: missing stageId');
      }
      const stageInfo: StageInfo = { ...parsed, status: 'started' };
      // stageId도 디코딩 필요할 수 있음
      const decodedStageId = decodeHtmlEntities(stageInfo.stageId);
      const category = getStageCategory(decodedStageId);
      const providerLabel = stageInfo.provider ? ` (${stageInfo.provider})` : '';
      const skillsLabel = stageInfo.skills?.length ? `\n   Skills: ${stageInfo.skills.join(', ')}` : '';
      return {
        type: 'stage_start',
        content: `▶ Stage Started: ${decodedStageId} (${category})${providerLabel}${skillsLabel}`,
        stageInfo,
      };
    } catch (error) {
      console.error(`[parseOutputType] Failed to parse STAGE_START JSON:`, error, jsonStr);
      return {
        type: 'stage_start',
        content: jsonStr,
      };
    }
  }

  if (content.startsWith(STAGE_END_MARKER)) {
    const jsonStr = content.substring(STAGE_END_MARKER.length);
    try {
      // HTML 엔티티 디코딩 후 JSON 파싱
      const decodedJsonStr = decodeHtmlEntities(jsonStr);
      const parsed = JSON.parse(decodedJsonStr);
      if (!isValidStageInfo(parsed)) {
        throw new Error('Invalid STAGE_END JSON structure: missing stageId');
      }
      const stageInfo = parsed as StageInfo;
      // stageId도 디코딩
      const decodedStageId = decodeHtmlEntities(stageInfo.stageId);
      const category = getStageCategory(decodedStageId);
      const durationLabel = stageInfo.duration ? ` (${(stageInfo.duration / 1000).toFixed(1)}s)` : '';
      const statusIcon = stageInfo.status === 'completed' ? '✓' : '✗';
      return {
        type: 'stage_end',
        content: `${statusIcon} Stage ${stageInfo.status === 'completed' ? 'Completed' : 'Failed'}: ${decodedStageId} (${category})${durationLabel}`,
        stageInfo,
      };
    } catch (error) {
      console.error(`[parseOutputType] Failed to parse STAGE_END JSON:`, error, jsonStr);
      return {
        type: 'stage_end',
        content: jsonStr,
      };
    }
  }

  if (content.startsWith(USER_PROMPT_MARKER)) {
    return {
      type: 'user_prompt',
      content: content.substring(USER_PROMPT_MARKER.length),
    };
  }

  // Default to stdout
  return {
    type: 'stdout',
    content,
  };
}

/**
 * HTML 엔티티 디코딩을 export (다른 모듈에서 사용 가능하도록)
 */
export { decodeHtmlEntities };
