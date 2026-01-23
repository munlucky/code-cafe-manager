/**
 * Terminal Log Entry Types
 * 터미널 로그 파싱 및 표시를 위한 타입 정의
 */

/**
 * Log 타입 별칭
 * ParsedLogEntry와 동일한 타입
 */
export type Log = ParsedLogEntry;

/**
 * Interaction Group 타입
 * 대화형 블록 구조를 위한 그룹 타입
 */
export interface InteractionGroup {
  /** 고유 식별자 */
  id: string;
  /** 그룹 유형 */
  type: 'user' | 'thinking' | 'assistant';
  /** 그룹에 포함된 로그 엔트리들 */
  entries: ParsedLogEntry[];
  /** 타임스탬프 범위 */
  timestampRange?: {
    start: string;
    end: string;
  };
}

/**
 * 파싱된 로그 엔트리
 * raw JSON 또는 텍스트 로그를 구조화된 형태로 변환한 결과
 */
export interface ParsedLogEntry {
  /** 고유 식별자 */
  id: string;
  /** ISO 8601 타임스탬프 */
  timestamp: string;
  /** 로그 유형 */
  type: 'assistant' | 'user' | 'system' | 'tool_use' | 'tool_result' | 'thinking' | 'raw';
  /** tool_use 시 도구 이름 */
  toolName?: string;
  /** tool_result 시 연관된 tool_use ID */
  toolUseId?: string;
  /** 실제 콘텐츠 (텍스트 또는 JSON 문자열) */
  content: string;
  /** 축약된 요약 (collapsible 상태에서 표시) */
  summary?: string;
  /** 접을 수 있는 콘텐츠 여부 */
  isCollapsible: boolean;
  /** 추가 메타데이터 */
  metadata?: ParsedLogMetadata;
}

/**
 * 로그 엔트리 메타데이터
 */
export interface ParsedLogMetadata {
  /** 파일 콘텐츠인 경우 라인 수 */
  fileLines?: number;
  /** 파일명 (추출 가능한 경우) */
  fileName?: string;
  /** JSON 콘텐츠인 경우 최상위 키 목록 */
  jsonKeys?: string[];
  /** 원본 콘텐츠 길이 */
  contentLength?: number;
}

/**
 * 로그 배지 유형
 * UI에서 로그 유형을 시각적으로 구분하기 위한 배지 타입
 */
export type LogBadgeType = 'tool' | 'result' | 'ai' | 'system' | 'user' | 'error' | 'thinking';

/**
 * 콘텐츠 유형
 * 로그 내용의 유형을 구분
 */
export type ContentType = 'file' | 'json' | 'error' | 'text';

/**
 * 파일 콘텐츠 요약 결과
 */
export interface FileSummary {
  /** 총 라인 수 */
  lines: number;
  /** 미리보기 텍스트 */
  preview: string;
}

/**
 * JSON 콘텐츠 요약 결과
 */
export interface JSONSummary {
  /** 최상위 키 목록 */
  keys: string[];
  /** 크기 문자열 (예: "1.2KB") */
  size: string;
}
