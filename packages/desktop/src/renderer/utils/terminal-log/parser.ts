/**
 * Parser Module
 * 메인 터미널 로그 파싱 함수들
 */

import type { ParsedLogEntry, InteractionGroup } from '../../types/terminal';
import { decodeHtmlEntities } from '../../../common/output-markers';
import { detectContentType, isJSONContent } from './content-detector';
import { summarizeFileContent, summarizeJSONContent, generateSummary } from './summarizer';
import { extractToolDetails, extractToolInfoFromRawText } from './tool-extractor';
import { getGroupType } from './formatter';

/** 콘텐츠가 collapsible로 간주되는 최소 길이 */
const COLLAPSIBLE_THRESHOLD = 500;

/**
 * 고유 ID 생성
 */
export function generateId(): string {
  return `log-${crypto.randomUUID()}`;
}

/**
 * Claude Code 메시지 블록 타입
 */
interface MessageBlock {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking';
  text?: string;
  name?: string;
  id?: string;
  tool_use_id?: string;
  input?: unknown;
  content?: string | unknown;
}

/**
 * Claude Code 메시지 구조
 */
interface ClaudeMessage {
  type?: 'assistant' | 'user' | 'system';
  message?: {
    content?: MessageBlock[];
  };
}

/**
 * raw 텍스트에서 더 구체적인 타입 추론
 */
function inferTypeFromContent(content: string): ParsedLogEntry['type'] {
  const trimmed = content.trim();
  const lines = trimmed.split('\n');

  if (/^(Stage|Phase|Step)\s*\d+/i.test(trimmed) && lines.length < 5) {
    return 'thinking';
  }

  if (/^#{1,3}\s+/.test(trimmed)) {
    return 'assistant';
  }

  if (/^```/.test(trimmed)) {
    return 'assistant';
  }

  if (/^\[?(Tool|TOOL)\]?[:\s]/i.test(trimmed)) {
    return 'tool_use';
  }
  if (/^(Result|Output)[:\s]/i.test(trimmed)) {
    return 'tool_result';
  }

  if (lines.length >= 2 && trimmed.length > 50) {
    const hasToolPattern = /^\[?(Tool|TOOL)\]?[:\s]/i.test(trimmed) ||
                          /^(Result|Output)[:\s]/i.test(trimmed);
    const hasErrorPattern = /^(error|failed|exception|panic)/i.test(trimmed);

    if (!hasToolPattern && !hasErrorPattern) {
      return 'assistant';
    }
  }

  if (lines.filter(l => l.trim().startsWith('-')).length >= 2) {
    return 'assistant';
  }

  if (/^[A-Z].*[.!?]$/.test(trimmed) && trimmed.length > 20) {
    return 'assistant';
  }

  if (/^(Sources|References):?\s*$/im.test(trimmed) || trimmed.includes('Sources:')) {
    return 'assistant';
  }

  if (/^(Summary|Conclusion|Result|Outcome|Analysis):/i.test(trimmed)) {
    return 'assistant';
  }

  if (/^(error|failed|exception|panic)/i.test(trimmed)) {
    return 'system';
  }

  return 'assistant';
}

/**
 * 메시지 블록을 ParsedLogEntry로 변환
 */
function parseMessageBlock(
  block: MessageBlock,
  parentType: string,
  timestamp: string
): ParsedLogEntry | null {
  const baseEntry = {
    id: generateId(),
    timestamp,
  };

  if (block.type === 'text' && block.text) {
    const content = block.text;
    const isCollapsible = content.length > COLLAPSIBLE_THRESHOLD;
    const entry: ParsedLogEntry = {
      ...baseEntry,
      type: parentType === 'assistant' ? 'assistant' : 'user',
      content,
      isCollapsible,
    };
    if (isCollapsible) {
      entry.summary = generateSummary(entry);
    }
    return entry;
  }

  if (block.type === 'tool_use') {
    const inputStr = typeof block.input === 'string'
      ? block.input
      : JSON.stringify(block.input, null, 2);
    const content = inputStr || '';
    const isCollapsible = content.length > COLLAPSIBLE_THRESHOLD || isJSONContent(content);
    const entry: ParsedLogEntry = {
      ...baseEntry,
      type: 'tool_use',
      toolName: block.name,
      toolUseId: block.id,
      content,
      isCollapsible,
    };
    entry.summary = `${block.name || 'Tool'} call`;

    const toolDetails = extractToolDetails(content, block.name);
    if (toolDetails) {
      entry.metadata = {
        ...entry.metadata,
        toolDetails,
      };
    }

    if (isJSONContent(content)) {
      const jsonSummary = summarizeJSONContent(content);
      entry.metadata = {
        ...entry.metadata,
        jsonKeys: jsonSummary.keys,
      };
    }
    return entry;
  }

  if (block.type === 'tool_result') {
    let rawContent: string;
    if (typeof block.content === 'string') {
      rawContent = block.content;
    } else if (block.content === undefined || block.content === null) {
      rawContent = '';
    } else if (typeof block.content === 'object') {
      const contentObj = block.content as Record<string, unknown>;
      if (contentObj.content && typeof contentObj.content === 'string') {
        rawContent = decodeHtmlEntities(contentObj.content);
      } else if (contentObj.file && typeof contentObj.file === 'object') {
        const fileObj = contentObj.file as Record<string, unknown>;
        rawContent = typeof fileObj.content === 'string' ? fileObj.content : JSON.stringify(fileObj, null, 2);
      } else {
        rawContent = JSON.stringify(block.content, null, 2);
      }
    } else {
      rawContent = String(block.content);
    }

    const content = rawContent || '';
    const contentType = detectContentType(content);
    const isCollapsible = content.length > COLLAPSIBLE_THRESHOLD ||
      contentType === 'file' ||
      contentType === 'json';

    const entry: ParsedLogEntry = {
      ...baseEntry,
      type: 'tool_result',
      toolUseId: block.tool_use_id,
      content,
      isCollapsible,
    };

    if (contentType === 'file') {
      const fileSummary = summarizeFileContent(content);
      entry.metadata = { fileLines: fileSummary.lines, contentLength: content.length };
      entry.summary = `Result: ${fileSummary.lines} lines`;
    } else if (contentType === 'json') {
      const jsonSummary = summarizeJSONContent(content);
      entry.metadata = { jsonKeys: jsonSummary.keys, contentLength: content.length };
      entry.summary = `Result: JSON (${jsonSummary.size})`;
    } else {
      entry.metadata = { contentLength: content.length };
      entry.summary = generateSummary(entry);
    }

    return entry;
  }

  if (block.type === 'thinking' && block.text) {
    const content = block.text;
    return {
      ...baseEntry,
      type: 'thinking',
      content,
      isCollapsible: true,
      summary: 'Thinking...',
    };
  }

  return null;
}

/**
 * 메인 파싱 함수
 * raw 터미널 출력을 ParsedLogEntry로 변환
 */
export function parseTerminalOutput(raw: string): ParsedLogEntry {
  const timestamp = new Date().toISOString();

  if (!raw || !raw.trim()) {
    return {
      id: generateId(),
      timestamp,
      type: 'raw',
      content: '',
      isCollapsible: false,
    };
  }

  const trimmed = raw.trim();

  if (trimmed.startsWith('{')) {
    let jsonCandidate = trimmed;
    try {
      JSON.parse(trimmed);
    } catch {
      if (trimmed.includes('&quot;') || trimmed.includes('&amp;')) {
        jsonCandidate = decodeHtmlEntities(trimmed);
      }
    }
    try {
      const parsed = JSON.parse(jsonCandidate) as ClaudeMessage;

      if (parsed.type && parsed.message?.content && Array.isArray(parsed.message.content)) {
        for (const block of parsed.message.content) {
          const entry = parseMessageBlock(block, parsed.type, timestamp);
          if (entry) {
            return entry;
          }
        }

        const firstBlock = parsed.message.content[0];
        if (firstBlock && firstBlock.content) {
          const blockContent = typeof firstBlock.content === 'string'
            ? firstBlock.content
            : JSON.stringify(firstBlock.content, null, 2);
          const contentType = detectContentType(blockContent);
          const isCollapsible = blockContent.length > COLLAPSIBLE_THRESHOLD ||
            contentType === 'file' ||
            contentType === 'json';

          const entry: ParsedLogEntry = {
            id: generateId(),
            timestamp,
            type: firstBlock.type === 'tool_result' ? 'tool_result' : 'thinking',
            toolUseId: firstBlock.tool_use_id,
            content: blockContent,
            isCollapsible,
          };

          if (contentType === 'file') {
            const fileSummary = summarizeFileContent(blockContent);
            entry.metadata = { fileLines: fileSummary.lines, contentLength: blockContent.length };
            entry.summary = `Result: ${fileSummary.lines} lines`;
          } else if (contentType === 'json') {
            const jsonSummary = summarizeJSONContent(blockContent);
            entry.metadata = { jsonKeys: jsonSummary.keys, contentLength: blockContent.length };
            entry.summary = `Result: JSON (${jsonSummary.size})`;
          } else {
            entry.metadata = { contentLength: blockContent.length };
            entry.summary = generateSummary(entry);
          }

          return entry;
        }
      }

      if (parsed.type) {
        return {
          id: generateId(),
          timestamp,
          type: parsed.type === 'assistant' ? 'assistant' : parsed.type === 'user' ? 'user' : 'system',
          content: jsonCandidate,
          isCollapsible: jsonCandidate.length > COLLAPSIBLE_THRESHOLD,
          summary: `${parsed.type} message`,
        };
      }
    } catch {
      // JSON 파싱 실패 - raw로 처리
    }
  }

  const contentType = detectContentType(trimmed);
  const isCollapsible = trimmed.length > COLLAPSIBLE_THRESHOLD ||
    contentType === 'file' ||
    contentType === 'json';

  const inferredType = inferTypeFromContent(trimmed);

  const entry: ParsedLogEntry = {
    id: generateId(),
    timestamp,
    type: inferredType,
    content: trimmed,
    isCollapsible,
  };

  if (inferredType === 'tool_use') {
    const toolInfo = extractToolInfoFromRawText(trimmed);
    if (toolInfo) {
      entry.toolName = toolInfo.toolName;
      if (toolInfo.toolDetails) {
        entry.metadata = {
          ...entry.metadata,
          toolDetails: toolInfo.toolDetails,
        };
      }
    }
  }

  if (contentType === 'file') {
    const fileSummary = summarizeFileContent(trimmed);
    entry.metadata = { fileLines: fileSummary.lines };
    entry.summary = `File content (${fileSummary.lines} lines)`;
  } else if (contentType === 'json') {
    const jsonSummary = summarizeJSONContent(trimmed);
    entry.metadata = { jsonKeys: jsonSummary.keys };
    entry.summary = `JSON (${jsonSummary.size})`;
  } else if (isCollapsible) {
    entry.summary = generateSummary(entry);
  }

  return entry;
}

/**
 * 그룹에 새 entry 추가 시 그룹 ID를 안정적으로 유지
 */
function createGroupId(firstEntry: ParsedLogEntry): string {
  return `group-${firstEntry.id}`;
}

/**
 * Log[] 배열을 InteractionGroup[]으로 변환
 */
export function groupLogs(entries: ParsedLogEntry[]): InteractionGroup[] {
  if (entries.length === 0) {
    return [];
  }

  const groups: InteractionGroup[] = [];
  let currentGroup: InteractionGroup | null = null;

  const isStageStart = (content: string): boolean => {
    const patterns = [
      /^(Stage|Phase|Step)\s*\d+/i,
      /^\[?(Stage|Phase|Step)\]?:/i,
      /^#{1,3}\s*(Stage|Phase|Step)/i,
      /^(?:▶\s*)?Stage\s+Started:/i,
    ];
    return patterns.some((p) => p.test(content.trim()));
  };

  for (const entry of entries) {
    const groupType = getGroupType(entry.type);

    const shouldStartNewGroup =
      currentGroup &&
      currentGroup.type === 'thinking' &&
      groupType === 'thinking' &&
      isStageStart(entry.content);

    if (shouldStartNewGroup && currentGroup) {
      groups.push(currentGroup);
      currentGroup = {
        id: createGroupId(entry),
        type: 'thinking',
        entries: [entry],
        timestampRange: { start: entry.timestamp, end: entry.timestamp },
      };
      continue;
    }

    if (entry.type === 'tool_use' && entry.toolUseId) {
      if (!currentGroup || currentGroup.type !== 'thinking') {
        if (currentGroup) {
          groups.push(currentGroup);
        }
        currentGroup = {
          id: createGroupId(entry),
          type: 'thinking',
          entries: [],
          timestampRange: { start: entry.timestamp, end: entry.timestamp },
        };
      }
      currentGroup.entries.push(entry);
      currentGroup.timestampRange!.end = entry.timestamp;
      continue;
    }

    if (entry.type === 'tool_result' && entry.toolUseId) {
      if (!currentGroup || currentGroup.type !== 'thinking') {
        if (currentGroup) {
          groups.push(currentGroup);
        }
        currentGroup = {
          id: createGroupId(entry),
          type: 'thinking',
          entries: [],
          timestampRange: { start: entry.timestamp, end: entry.timestamp },
        };
      }
      currentGroup.entries.push(entry);
      currentGroup.timestampRange!.end = entry.timestamp;
      continue;
    }

    if (!currentGroup) {
      currentGroup = {
        id: createGroupId(entry),
        type: groupType,
        entries: [entry],
        timestampRange: { start: entry.timestamp, end: entry.timestamp },
      };
    } else if (currentGroup.type === groupType) {
      currentGroup.entries.push(entry);
      currentGroup.timestampRange!.end = entry.timestamp;
    } else {
      groups.push(currentGroup);
      currentGroup = {
        id: createGroupId(entry),
        type: groupType,
        entries: [entry],
        timestampRange: { start: entry.timestamp, end: entry.timestamp },
      };
    }
  }

  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}
