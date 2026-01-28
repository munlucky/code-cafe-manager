/**
 * Terminal Log Parser Module
 * 터미널 출력을 파싱하여 구조화된 로그 엔트리로 변환
 *
 * @module terminal-log
 */

// Content Detection
export {
  isFileContent,
  isJSONContent,
  isCodeContent,
  isActualError,
  detectContentType,
} from './content-detector';

// Summarization
export {
  summarizeFileContent,
  summarizeJSONContent,
  generateSummary,
} from './summarizer';

// Tool Extraction
export {
  extractToolDetails,
  extractToolInfoFromRawText,
} from './tool-extractor';

// Formatting
export {
  getBadgeType,
  getGroupType,
} from './formatter';

// Main Parser
export {
  generateId,
  parseTerminalOutput,
  groupLogs,
} from './parser';
