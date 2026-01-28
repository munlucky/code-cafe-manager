/**
 * Content Detection Module
 * 콘텐츠 유형 감지 함수들
 */

import type { ContentType } from '../../types/terminal';

/** 파일 라인 번호 패턴 (예: "     1->" 또는 "   123->") */
const FILE_LINE_PATTERN = /^\s*\d+->/m;

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
export function isCodeContent(content: string): boolean {
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
export function isActualError(content: string): boolean {
  if (isCodeContent(content)) {
    return false;
  }

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
  if (isActualError(content)) {
    return 'error';
  }
  return 'text';
}
