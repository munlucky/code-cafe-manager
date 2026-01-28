/**
 * Formatter Module
 * 포맷팅 및 타입 변환 함수들
 */

import type { ParsedLogEntry, LogBadgeType, InteractionGroup } from '../../types/terminal';

/**
 * ParsedLogEntry 타입에서 LogBadgeType으로 변환
 */
export function getBadgeType(entryType: ParsedLogEntry['type']): LogBadgeType {
  switch (entryType) {
    case 'tool_use':
      return 'tool';
    case 'tool_result':
      return 'result';
    case 'assistant':
      return 'ai';
    case 'system':
      return 'system';
    case 'user':
      return 'user';
    case 'thinking':
      return 'thinking';
    case 'raw':
    default:
      return 'thinking';
  }
}

/**
 * ParsedLogEntry 타입에서 InteractionGroup 타입으로 변환
 */
export function getGroupType(entryType: ParsedLogEntry['type']): InteractionGroup['type'] {
  switch (entryType) {
    case 'user':
      return 'user';
    case 'assistant':
      return 'assistant';
    case 'thinking':
    case 'tool_use':
    case 'tool_result':
    case 'system':
    case 'raw':
    default:
      return 'thinking';
  }
}
