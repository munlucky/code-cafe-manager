/**
 * TerminalLogEntry Component
 * 단일 로그 엔트리를 렌더링하는 컴포넌트
 */

import { FileText, Code } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';
import type { ParsedLogEntry } from '../../types/terminal';
import {
  getBadgeType,
  detectContentType,
  isJSONContent,
} from '../../utils/terminal-log-parser';
import { LogBadge } from './LogBadge';
import { CollapsibleContent } from './CollapsibleContent';
import { FilePreview } from './FilePreview';
import { JSONViewer } from './JSONViewer';
import { MarkdownContentRenderer } from './MarkdownContentRenderer';

interface TerminalLogEntryProps {
  entry: ParsedLogEntry;
  className?: string;
}

function formatTimestamp(isoString: string, locale: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString(locale, {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Tool 입력 파라미터 요약 생성 */
function summarizeToolInput(content: string, toolName?: string): string | null {
  if (!content.trim()) return null;

  try {
    const parsed = JSON.parse(content);
    if (typeof parsed === 'object' && parsed !== null) {
      // 주요 파라미터 추출
      if (toolName === 'Write' || toolName === 'Edit' || toolName === 'Read') {
        if (parsed.file_path) {
          const fileName = parsed.file_path.split('/').pop();
          return fileName || parsed.file_path;
        }
      }
      if (toolName === 'Bash') {
        if (parsed.command) {
          const cmd = parsed.command.length > 50
            ? parsed.command.substring(0, 50) + '...'
            : parsed.command;
          return cmd;
        }
      }
      if (toolName === 'Grep') {
        if (parsed.pattern) {
          return `pattern: "${parsed.pattern}"`;
        }
      }
      if (toolName === 'Glob') {
        if (parsed.pattern) {
          return `pattern: "${parsed.pattern}"`;
        }
      }
      // 기본: 첫 번째 키-값
      const keys = Object.keys(parsed);
      if (keys.length > 0) {
        const firstKey = keys[0];
        const firstVal = parsed[firstKey];
        if (typeof firstVal === 'string') {
          const val = firstVal.length > 40 ? firstVal.substring(0, 40) + '...' : firstVal;
          return `${firstKey}: ${val}`;
        }
      }
    }
  } catch {
    // JSON 파싱 실패
  }
  return null;
}

function renderContent(entry: ParsedLogEntry): JSX.Element {
  const contentType = detectContentType(entry.content);

  // File content
  if (contentType === 'file') {
    return (
      <FilePreview
        content={entry.content}
        fileName={entry.metadata?.fileName}
        maxLines={50}
      />
    );
  }

  // JSON content
  if (contentType === 'json' && isJSONContent(entry.content)) {
    try {
      const parsed = JSON.parse(entry.content);
      return <JSONViewer data={parsed} maxDepth={3} />;
    } catch {
      // Fall through to text rendering
    }
  }

  // 마크다운 콘텐츠 렌더링 (코드블럭 포함)
  return (
    <MarkdownContentRenderer
      content={entry.content}
      isError={contentType === 'error'}
      className="px-1 py-1"
    />
  );
}

export function TerminalLogEntry({
  entry,
  className,
}: TerminalLogEntryProps): JSX.Element {
  const { i18n } = useTranslation();
  const badgeType = getBadgeType(entry.type);
  const contentType = detectContentType(entry.content);

  // Determine icon for collapsible content
  const contentIcon = contentType === 'file' ? FileText : contentType === 'json' ? Code : undefined;

  // Tool 파라미터 요약
  const toolParamSummary = entry.type === 'tool_use'
    ? summarizeToolInput(entry.content, entry.toolName)
    : null;

  return (
    <div
      className={cn(
        'group flex items-start gap-2 px-2 py-1 rounded',
        'hover:bg-white/5 transition-colors',
        className
      )}
    >
      {/* Timestamp */}
      <span className="flex-shrink-0 text-[10px] text-cafe-600 pt-0.5 select-none min-w-[60px]">
        {formatTimestamp(entry.timestamp, i18n.language)}
      </span>

      {/* Badge */}
      <div className="flex-shrink-0 pt-0.5">
        <LogBadge type={badgeType} toolName={entry.toolName} />
      </div>

      {/* Tool Parameter Summary */}
      {toolParamSummary && (
        <span className="flex-shrink-0 text-[10px] text-cafe-500 font-mono pt-0.5 truncate max-w-[200px]">
          {toolParamSummary}
        </span>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {entry.isCollapsible && entry.summary ? (
          <CollapsibleContent
            summary={entry.summary}
            icon={contentIcon}
            metadata={{
              lines: entry.metadata?.fileLines,
              size:
                entry.metadata?.contentLength !== undefined
                  ? entry.metadata.contentLength < 1024
                    ? `${entry.metadata.contentLength}B`
                    : `${(entry.metadata.contentLength / 1024).toFixed(1)}KB`
                  : undefined,
            }}
          >
            {renderContent(entry)}
          </CollapsibleContent>
        ) : (
          <div
            className={cn(
              'text-xs whitespace-pre-wrap break-all',
              badgeType === 'error' ? 'text-red-400' : 'text-cafe-300'
            )}
          >
            {entry.content}
          </div>
        )}
      </div>
    </div>
  );
}
