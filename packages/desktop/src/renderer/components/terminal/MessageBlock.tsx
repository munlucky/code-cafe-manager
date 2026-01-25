/**
 * MessageBlock Component
 * 사용자/어시스턴트 메시지를 구분하여 렌더링하는 컴포넌트
 */

import React from 'react';
import { User, Sparkles, ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { InteractionGroup } from '../../types/terminal';
import { MarkdownContentRenderer } from './MarkdownContentRenderer';
import { isJSONContent } from '../../utils/terminal-log-parser';

interface MessageBlockProps {
  group: InteractionGroup;
  className?: string;
}

/**
 * CollapsibleContent Component
 * 긴 내용을 요약해서 보여주고, 클릭하면 전체 펼치기
 */
interface CollapsibleContentProps {
  summary?: string;
  onExpand: () => void;
}

/**
 * CollapsibleContent Component
 * 긴 내용을 요약해서 보여주고, 클릭하면 전체 펼치기
 */
interface CollapsibleContentProps {
  summary?: string;
  onExpand: () => void;
}

function CollapsibleContent({ summary, onExpand }: CollapsibleContentProps): JSX.Element {
  return (
    <button
      onClick={onExpand}
      className="w-full text-left group hover:bg-cafe-800/30 rounded transition-colors"
    >
      <div className="flex items-center gap-2 text-cafe-400 group-hover:text-cafe-300 transition-colors">
        <ChevronDown className="w-4 h-4" />
        <span className="text-xs font-medium">{summary || 'Show full content'}</span>
        <span className="text-[10px] text-cafe-600">(Click to expand)</span>
      </div>
    </button>
  );
}

/**
 * CollapsibleEntry Component
 * 개별 entry의 접기/펼치기 상태를 관리하는 컴포넌트
 * React Hooks 규칙을 준수하기 위해 분리
 */
interface CollapsibleEntryProps {
  entry: {
    id: string;
    content: string;
    summary?: string;
    metadata?: { filePath?: string; fileLines?: number };
  };
}

function CollapsibleEntry({ entry }: CollapsibleEntryProps): JSX.Element {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const isJSON = isJSONContent(entry.content);
  const contentLength = entry.content?.length || 0;
  const lineCount = entry.content.split('\n').length;
  const isFileContent = lineCount > 20;

  let displayContent = entry.content;
  if (isJSON && contentLength <= 2000) {
    try {
      const parsed = JSON.parse(entry.content);
      displayContent = '```json\n' + JSON.stringify(parsed, null, 2) + '\n```';
    } catch {
      // JSON 파싱 실패 시 원본 사용
    }
  }

  const shouldCollapse = (isJSON && contentLength > 500) ||
                         (isFileContent && lineCount > 50) ||
                         (entry.metadata?.fileLines && entry.metadata.fileLines > 50);

  let summary = entry.summary;
  if (shouldCollapse && !summary) {
    if (isJSON) {
      summary = `Large JSON content (${contentLength.toLocaleString()} chars, ~${lineCount} lines)`;
    } else if (entry.metadata?.filePath) {
      summary = `${entry.metadata.filePath} (${lineCount} lines)`;
    } else {
      summary = `Large content (${contentLength.toLocaleString()} chars, ~${lineCount} lines)`;
    }
  }

  const showSummary = shouldCollapse && !!summary;

  return (
    <div>
      {showSummary && !isExpanded ? (
        <CollapsibleContent
          summary={summary}
          onExpand={() => setIsExpanded(true)}
        />
      ) : (
        <MarkdownContentRenderer
          content={displayContent}
          textSize="text-sm"
          textColor="text-cafe-100"
        />
      )}
    </div>
  );
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MessageBlock({ group, className }: MessageBlockProps): JSX.Element {
  const isUser = group.type === 'user';
  const timestamp = group.timestampRange?.start
    ? formatTimestamp(group.timestampRange.start)
    : '';

  // Check if any entry is collapsible (long content)
  const hasCollapsibleContent = group.entries.some(e => e.isCollapsible);

  // user 타입: 우측 정렬, 말풍선 스타일
  if (isUser) {
    return (
      <div className={cn('flex justify-end my-3', className)}>
        <div className="max-w-[80%] flex flex-col items-end gap-1">
          {/* 메시지 헤더 */}
          <div className="flex items-center gap-2 text-[10px] text-cafe-600">
            <span>{timestamp}</span>
            <div className="flex items-center gap-1 text-yellow-400">
              <User className="w-3 h-3" />
              <span>User</span>
            </div>
          </div>

          {/* 메시지 콘텐츠 - 말풍선 스타일 */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl rounded-tr-sm px-4 py-2">
            {group.entries.map((entry) => (
              <div key={entry.id} className="text-xs text-cafe-200 whitespace-pre-wrap break-all">
                {entry.isCollapsible && entry.summary ? entry.summary : entry.content}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // assistant 타입: 좌측 정렬
  return (
    <div className={cn('flex justify-start my-3', className)}>
      <div className="max-w-[90%] flex flex-col items-start gap-1">
        {/* 메시지 헤더 */}
        <div className="flex items-center gap-2 text-[10px] text-cafe-600">
          <div className="flex items-center gap-1 text-purple-400">
            <Sparkles className="w-3 h-3" />
            <span>Assistant</span>
          </div>
          <span>{timestamp}</span>
        </div>

        {/* 메시지 콘텐츠 */}
        <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg px-4 py-3 w-full space-y-3">
          {group.entries.map((entry) => (
            <CollapsibleEntry key={entry.id} entry={entry} />
          ))}
        </div>
      </div>
    </div>
  );
}
