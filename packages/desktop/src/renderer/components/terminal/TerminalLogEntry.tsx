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

  // Plain text or error
  return (
    <div
      className={cn(
        'px-3 py-2 text-xs whitespace-pre-wrap break-all',
        contentType === 'error' ? 'text-red-400' : 'text-cafe-300'
      )}
    >
      {entry.content}
    </div>
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
