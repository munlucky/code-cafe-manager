/**
 * Summarizer Module
 * 콘텐츠 요약 생성 함수들
 */

import type { ParsedLogEntry, FileSummary, JSONSummary } from '../../types/terminal';
import { decodeHtmlEntities } from '../../../common/output-markers';
import { detectContentType } from './content-detector';

/**
 * 파일 콘텐츠 요약 생성
 */
export function summarizeFileContent(content: string): FileSummary {
  const lines = content.split('\n');
  const lineCount = lines.length;

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
      keys = Object.keys(parsed).slice(0, 5).map(key => decodeHtmlEntities(key));
    }
  } catch {
    // JSON 파싱 실패 시 빈 키 배열
  }

  return { keys, size };
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
      const decodedContent = decodeHtmlEntities(entry.content);
      const preview = decodedContent.trim().substring(0, 50);
      return preview.length < decodedContent.trim().length
        ? `${preview}...`
        : preview;
    }
  }
}
