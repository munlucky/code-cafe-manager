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

/**
 * HTML 엔티티를 디코드
 * convertAnsiToHtml에서 이스케이프된 문자열을 복원
 */
function decodeHtmlEntities(text: string): string {
  const htmlDecodeMap: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
  };

  return text.replace(/&(amp|lt|gt|quot|#39);/g, (match) => htmlDecodeMap[match] || match);
}

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
 * 코드/스크립트 콘텐츠 여부 감지
 * HTML, JavaScript 등의 코드가 포함된 경우 true 반환
 */
function isCodeContent(content: string): boolean {
  const codePatterns = [
    /<script[\s>]/i,
    /<\/script>/i,
    /function\s+\w+\s*\(/,
    /=>\s*{/,
    /const\s+\w+\s*=/,
    /let\s+\w+\s*=/,
    /var\s+\w+\s*=/,
    /<html[\s>]/i,
    /document\.\w+/,
    /window\.\w+/,
    /console\.\w+/,
  ];
  return codePatterns.some((pattern) => pattern.test(content));
}

/**
 * 실제 에러 메시지인지 확인
 * 단순 키워드 포함이 아닌, 실제 에러 출력 패턴 감지
 */
function isActualError(content: string): boolean {
  // 코드 콘텐츠 내의 error 키워드는 무시
  if (isCodeContent(content)) {
    return false;
  }

  // 실제 에러 출력 패턴 (줄 시작에서 에러 키워드)
  const errorPatterns = [
    /^error:/im,
    /^Error:/m,
    /^ERROR:/m,
    /^\[error\]/im,
    /^Exception:/m,
    /^EXCEPTION:/m,
    /^Uncaught\s+(Error|Exception)/m,
    /^TypeError:/m,
    /^SyntaxError:/m,
    /^ReferenceError:/m,
    /^FATAL:/m,
    /^FAIL:/m,
    /failed with exit code/i,
    /command failed/i,
    /build failed/i,
    /compilation failed/i,
  ];

  return errorPatterns.some((pattern) => pattern.test(content));
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
  // 실제 에러 패턴 감지 (더 정교한 로직)
  if (isActualError(content)) {
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
  // HTML 엔티티 디코딩 (JSON 파싱 전)
  const decodedContent = decodeHtmlEntities(content);
  const byteSize = new TextEncoder().encode(decodedContent).length;
  const size = byteSize < 1024
    ? `${byteSize}B`
    : `${(byteSize / 1024).toFixed(1)}KB`;

  let keys: string[] = [];
  try {
    const parsed = JSON.parse(decodedContent);
    if (Array.isArray(parsed)) {
      keys = [`array[${parsed.length}]`];
    } else if (typeof parsed === 'object' && parsed !== null) {
      // 키도 HTML 엔티티 디코딩
      keys = Object.keys(parsed).slice(0, 5).map(key => decodeHtmlEntities(key));
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
 * raw 텍스트에서 tool 정보 추출
 * "▶ Tool: Bash {\"command\":\"ls\"}" 형식에서 tool 이름과 JSON 추출
 */
function extractToolInfoFromRawText(content: string): { toolName?: string; toolDetails?: import('../types/terminal').ToolDetails } | null {
  const trimmed = content.trim();

  // tool 사용 패턴: "▶ Tool: NAME {JSON}" 또는 "Using tool: NAME: JSON"
  const toolPatterns = [
    /(?:▶\s*)?Tool:\s*(\w+)\s*(\{.+\})/i,
    /Using\s+tool:\s*(\w+)\s*:\s*(\{.+\})/i,
    /\[?(Tool|TOOL)\]?\s*:\s*(\w+)\s*(\{.+\})/i,
  ];

  for (const pattern of toolPatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      const toolName = match[1];
      const jsonStr = match[2];
      // extractToolDetails 호출
      const toolDetails = extractToolDetails(jsonStr, toolName);
      if (toolDetails) {
        return { toolName, toolDetails };
      }
    }
  }

  return null;
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
      // 텍스트의 첫 50자 미리보기 (HTML 엔티티 디코딩 적용)
      const decodedContent = decodeHtmlEntities(entry.content);
      const preview = decodedContent.trim().substring(0, 50);
      return preview.length < decodedContent.trim().length
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

    // Tool 상세 정보 추출
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
    // block.content가 다양한 형태로 올 수 있음: string, object, array, undefined
    let rawContent: string;
    if (typeof block.content === 'string') {
      rawContent = block.content;
    } else if (block.content === undefined || block.content === null) {
      rawContent = '';
    } else if (typeof block.content === 'object') {
      // 객체인 경우: {type: "text", file: {...}} 형태일 수 있음
      const contentObj = block.content as Record<string, unknown>;
      if (contentObj.content && typeof contentObj.content === 'string') {
        // 중첩된 content 처리
        rawContent = contentObj.content;
      } else if (contentObj.file && typeof contentObj.file === 'object') {
        // file 객체가 있는 경우
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
  // 먼저 원본으로 파싱 시도, 실패 시 HTML 엔티티 디코드 후 재시도
  if (trimmed.startsWith('{')) {
    let jsonCandidate = trimmed;
    try {
      // 원본 문자열로 먼저 파싱 시도
      JSON.parse(trimmed);
    } catch {
      // 파싱 실패 시 HTML 엔티티가 있으면 디코드
      if (trimmed.includes('&quot;') || trimmed.includes('&amp;')) {
        jsonCandidate = decodeHtmlEntities(trimmed);
      }
    }
    try {
      const parsed = JSON.parse(jsonCandidate) as ClaudeMessage;

      // message.content가 배열인 경우에만 처리
      if (parsed.type && parsed.message?.content && Array.isArray(parsed.message.content)) {
        // 첫 번째 의미 있는 블록 반환
        for (const block of parsed.message.content) {
          const entry = parseMessageBlock(block, parsed.type, timestamp);
          if (entry) {
            return entry;
          }
        }

        // 모든 블록에서 entry를 찾지 못한 경우, 첫 번째 블록의 content 사용
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

      // type은 있지만 message.content가 없거나 배열이 아닌 경우
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

  // tool_use 타입인 경우 raw 텍스트에서도 tool 정보 추출 시도
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
 * Tool 상세 정보 추출
 * tool_use JSON에서 상세 정보를 추출하여 ToolDetails로 반환
 */
export function extractToolDetails(content: string, toolName?: string): import('../types/terminal').ToolDetails | null {
  if (!content.trim() || !toolName) return null;

  try {
    const parsed = JSON.parse(content);
    if (typeof parsed !== 'object' || parsed === null) return null;

    const details: import('../types/terminal').ToolDetails = {
      toolType: toolName,
    };

    // 파일 경로 추출
    if (parsed.file_path) {
      details.filePath = parsed.file_path;
    }

    // 패턴 추출 (Grep, Glob)
    if (parsed.pattern) {
      details.pattern = parsed.pattern;
    }

    // 명령어 추출 (Bash)
    if (parsed.command) {
      details.command = parsed.command;
    }

    // 라인 수 (Read)
    if (parsed.limit !== undefined) {
      details.lines = typeof parsed.limit === 'number' ? parsed.limit : parseInt(String(parsed.limit), 10);
    }

    // Edit/Write의 경우 diff 추출 (old_string, new_string)
    if ((toolName === 'Edit' || toolName === 'Write') && parsed.old_string && parsed.new_string) {
      const oldLines = parsed.old_string.split('\n');
      const newLines = parsed.new_string.split('\n');
      const maxLines = Math.max(oldLines.length, newLines.length);

      // diff 생성 (unified diff 형식)
      let diffText = '';
      for (let i = 0; i < maxLines; i++) {
        const oldLine = oldLines[i] ?? '';
        const newLine = newLines[i] ?? '';
        if (oldLine !== newLine) {
          if (oldLine) diffText += `- ${oldLine}\n`;
          if (newLine) diffText += `+ ${newLine}\n`;
        } else if (oldLine) {
          diffText += `  ${oldLine}\n`;
        }
      }

      const diffLines = diffText.split('\n').filter(l => l.trim());
      details.diff = {
        shortDiff: diffLines.slice(0, 5).join('\n'),
        fullDiff: diffText,
        totalLines: diffLines.length,
      };
    }

    return Object.keys(details).length > 1 ? details : null;
  } catch {
    return null;
  }
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
