/**
 * Terminal Log Parser
 * 터미널 출력을 파싱하여 구조화된 로그 엔트리로 변환
 */

import type {
  ParsedLogEntry,
  ContentType,
  FileSummary,
  JSONSummary,
  InteractionGroup,
} from '../types/terminal';

/** 콘텐츠가 collapsible로 간주되는 최소 길이 */
const COLLAPSIBLE_THRESHOLD = 500;

/** 파일 라인 번호 패턴 (예: "     1->" 또는 "   123->") */
const FILE_LINE_PATTERN = /^\s*\d+->/m;

/**
 * 고유 ID 생성
 * crypto.randomUUID() 사용하여 테스트 간 간섭 방지
 */
export function generateId(): string {
  return `log-${crypto.randomUUID()}`;
}

/**
 * 파일 콘텐츠 여부 감지
 * 라인 번호 패턴 (^\s*\d+->) 존재 여부로 판단
 */
export function isFileContent(content: string): boolean {
  return FILE_LINE_PATTERN.test(content);
}

/**
 * JSON 콘텐츠 여부 감지
 * 유효한 JSON 구조인지 확인
 */
export function isJSONContent(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return false;
  }
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

/**
 * 콘텐츠 유형 감지
 */
export function detectContentType(content: string): ContentType {
  if (isFileContent(content)) {
    return 'file';
  }
  if (isJSONContent(content)) {
    return 'json';
  }
  // 에러 패턴 감지
  const lowerContent = content.toLowerCase();
  if (
    lowerContent.includes('error:') ||
    lowerContent.includes('exception') ||
    lowerContent.includes('failed')
  ) {
    return 'error';
  }
  return 'text';
}

/**
 * 파일 콘텐츠 요약 생성
 */
export function summarizeFileContent(content: string): FileSummary {
  const lines = content.split('\n');
  const lineCount = lines.length;

  // 첫 두 줄에서 라인 번호 패턴 제거 후 미리보기 생성
  const previewLines = lines
    .slice(0, 2)
    .map((line) => line.replace(/^\s*\d+->\s*/, ''))
    .join(' ')
    .trim();

  const preview = previewLines.length > 60
    ? previewLines.substring(0, 60) + '...'
    : previewLines;

  return { lines: lineCount, preview };
}

/**
 * JSON 콘텐츠 요약 생성
 */
export function summarizeJSONContent(content: string): JSONSummary {
  const byteSize = new TextEncoder().encode(content).length;
  const size = byteSize < 1024
    ? `${byteSize}B`
    : `${(byteSize / 1024).toFixed(1)}KB`;

  let keys: string[] = [];
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      keys = [`array[${parsed.length}]`];
    } else if (typeof parsed === 'object' && parsed !== null) {
      keys = Object.keys(parsed).slice(0, 5);
    }
  } catch {
    // JSON 파싱 실패 시 빈 키 배열
  }

  return { keys, size };
}

/**
 * raw 텍스트에서 더 구체적인 타입 추론
 * 패턴 기반으로 assistant, thinking 등을 감지
 */
function inferTypeFromContent(content: string): ParsedLogEntry['type'] {
  const trimmed = content.trim();

  // Stage/Phase 시작 패턴 - thinking으로 분류
  if (/^(Stage|Phase|Step)\s*\d+/i.test(trimmed)) {
    return 'thinking';
  }

  // 마크다운 헤더 패턴 - assistant 응답
  if (/^#{1,3}\s+/.test(trimmed)) {
    return 'assistant';
  }

  // 코드 블록 시작 - assistant 응답
  if (/^```/.test(trimmed)) {
    return 'assistant';
  }

  // 도구 관련 패턴
  if (/^\[?(Tool|TOOL)\]?[:\s]/i.test(trimmed)) {
    return 'tool_use';
  }
  if (/^(Result|Output)[:\s]/i.test(trimmed)) {
    return 'tool_result';
  }

  // 일반 텍스트 응답 패턴 (마침표로 끝나는 문장들) - assistant
  if (/^[A-Z].*[.!?]$/.test(trimmed) && trimmed.length > 20) {
    return 'assistant';
  }

  // 에러 패턴
  if (/^(error|failed|exception)/i.test(trimmed)) {
    return 'system';
  }

  // 기본값은 thinking (system보다 나음)
  return 'thinking';
}

/**
 * ParsedLogEntry에 대한 요약 문자열 생성
 */
export function generateSummary(entry: ParsedLogEntry): string {
  const contentType = detectContentType(entry.content);

  switch (contentType) {
    case 'file': {
      const fileSummary = summarizeFileContent(entry.content);
      const fileName = entry.metadata?.fileName || 'File';
      return `${fileName} (${fileSummary.lines} lines)`;
    }
    case 'json': {
      const jsonSummary = summarizeJSONContent(entry.content);
      const keyStr = jsonSummary.keys.join(', ');
      return `JSON {${keyStr}} (${jsonSummary.size})`;
    }
    case 'error':
      return 'Error output';
    default: {
      // 텍스트의 첫 50자 미리보기
      const preview = entry.content.trim().substring(0, 50);
      return preview.length < entry.content.trim().length
        ? `${preview}...`
        : preview;
    }
  }
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
    if (isJSONContent(content)) {
      const jsonSummary = summarizeJSONContent(content);
      entry.metadata = { jsonKeys: jsonSummary.keys };
    }
    return entry;
  }

  if (block.type === 'tool_result') {
    const rawContent = typeof block.content === 'string'
      ? block.content
      : JSON.stringify(block.content, null, 2);
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

  // 빈 콘텐츠 처리
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

  // JSON 파싱 시도 (Claude Code 형식)
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as ClaudeMessage;

      if (parsed.type && parsed.message?.content) {
        // 첫 번째 의미 있는 블록 반환
        for (const block of parsed.message.content) {
          const entry = parseMessageBlock(block, parsed.type, timestamp);
          if (entry) {
            return entry;
          }
        }
      }

      // type은 있지만 message.content가 없는 경우
      if (parsed.type) {
        return {
          id: generateId(),
          timestamp,
          type: parsed.type === 'assistant' ? 'assistant' : parsed.type === 'user' ? 'user' : 'system',
          content: trimmed,
          isCollapsible: trimmed.length > COLLAPSIBLE_THRESHOLD,
          summary: `${parsed.type} message`,
        };
      }
    } catch {
      // JSON 파싱 실패 - raw로 처리
    }
  }

  // raw 텍스트 처리 - 패턴 기반 타입 추론
  const contentType = detectContentType(trimmed);
  const isCollapsible = trimmed.length > COLLAPSIBLE_THRESHOLD ||
    contentType === 'file' ||
    contentType === 'json';

  // raw 대신 더 구체적인 타입 추론
  const inferredType = inferTypeFromContent(trimmed);

  const entry: ParsedLogEntry = {
    id: generateId(),
    timestamp,
    type: inferredType,
    content: trimmed,
    isCollapsible,
  };

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
 * ParsedLogEntry 타입에서 InteractionGroup 타입으로 변환
 */
function getGroupType(entryType: ParsedLogEntry['type']): InteractionGroup['type'] {
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

/**
 * 그룹에 새 entry 추가 시 그룹 ID를 안정적으로 유지하기 위해
 * 첫 번째 entry의 ID를 그룹 ID로 사용
 */
function createGroupId(firstEntry: ParsedLogEntry): string {
  return `group-${firstEntry.id}`;
}

/**
 * Log[] 배열을 InteractionGroup[]으로 변환하는 함수
 * 혼합 방식 그룹핑: 연속성, 페어링, 세션 기반
 *
 * 개선사항:
 * - 그룹 ID를 첫 entry ID 기반으로 생성하여 펼침 상태 유지
 * - stage 시작 감지 시 새 그룹 시작
 */
export function groupLogs(entries: ParsedLogEntry[]): InteractionGroup[] {
  if (entries.length === 0) {
    return [];
  }

  const groups: InteractionGroup[] = [];
  let currentGroup: InteractionGroup | null = null;

  // stage 시작 패턴 감지 (예: "Stage 1:", "[Stage]", "Phase 1:" 등)
  const isStageStart = (content: string): boolean => {
    const patterns = [
      /^(Stage|Phase|Step)\s*\d+/i,
      /^\[?(Stage|Phase|Step)\]?:/i,
      /^#{1,3}\s*(Stage|Phase|Step)/i,
    ];
    return patterns.some((p) => p.test(content.trim()));
  };

  for (const entry of entries) {
    const groupType = getGroupType(entry.type);

    // stage 시작 감지 시 새 그룹 시작 (thinking 타입 내에서도 분리)
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

    // tool_use와 tool_result 페어링 처리
    if (entry.type === 'tool_use' && entry.toolUseId) {
      // tool_use는 thinking 그룹에 추가
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
      // thinking 그룹에 추가
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

    // user, assistant, thinking 타입 처리
    if (!currentGroup) {
      // 첫 그룹 생성
      currentGroup = {
        id: createGroupId(entry),
        type: groupType,
        entries: [entry],
        timestampRange: { start: entry.timestamp, end: entry.timestamp },
      };
    } else if (currentGroup.type === groupType) {
      // 같은 타입이면 현재 그룹에 추가 (연속성)
      currentGroup.entries.push(entry);
      currentGroup.timestampRange!.end = entry.timestamp;
    } else {
      // 다른 타입이면 그룹 교체
      groups.push(currentGroup);
      currentGroup = {
        id: createGroupId(entry),
        type: groupType,
        entries: [entry],
        timestampRange: { start: entry.timestamp, end: entry.timestamp },
      };
    }
  }

  // 마지막 그룹 추가
  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * ParsedLogEntry 타입에서 LogBadgeType으로 변환
 */
export function getBadgeType(entryType: ParsedLogEntry['type']): import('../types/terminal').LogBadgeType {
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
      // raw는 이제 거의 사용되지 않지만, 만약 있다면 thinking으로 표시
      return 'thinking';
  }
}
