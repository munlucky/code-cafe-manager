/**
 * ThinkingBlock Component
 * 추론 과정(thinking)을 접을 수 있는 블록으로 표시하는 컴포넌트
 */

import { useState } from 'react';
import { ChevronDown, Brain, Activity } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { InteractionGroup } from '../../types/terminal';
import { TerminalLogEntry } from './TerminalLogEntry';

interface ThinkingBlockProps {
  group: InteractionGroup;
  className?: string;
}

function formatSummary(entries: InteractionGroup['entries']): string {
  const entryCount = entries.length;

  // tool_use/tool_result 개수 카운트
  const toolUseCount = entries.filter((e) => e.type === 'tool_use').length;
  const toolResultCount = entries.filter((e) => e.type === 'tool_result').length;
  const thinkingCount = entries.filter((e) => e.type === 'thinking').length;
  const systemCount = entries.filter((e) => e.type === 'system').length;

  const parts: string[] = [];

  if (toolUseCount > 0) {
    parts.push(`${toolUseCount}개 도구 호출`);
  }
  if (toolResultCount > 0) {
    parts.push(`${toolResultCount}개 결과`);
  }
  if (thinkingCount > 0) {
    parts.push(`${thinkingCount}개 추론 단계`);
  }
  if (systemCount > 0) {
    parts.push(`${systemCount}개 시스템 로그`);
  }

  if (parts.length > 0) {
    return parts.join(', ');
  }

  return `${entryCount}개 작업 수행 중...`;
}

export function ThinkingBlock({ group, className }: ThinkingBlockProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const summary = formatSummary(group.entries);

  return (
    <div className={cn('rounded border border-cafe-800 bg-cafe-900/30', className)}>
      {/* Header - clickable to toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'w-full flex items-center gap-2 px-4 py-2.5 text-left',
          'hover:bg-cafe-800/50 transition-colors',
          'text-xs text-cafe-400'
        )}
      >
        <ChevronDown
          className={cn(
            'w-4 h-4 transition-transform duration-200 flex-shrink-0 text-cafe-500',
            expanded ? 'rotate-0' : '-rotate-90'
          )}
        />
        <Brain className="w-3.5 h-3.5 flex-shrink-0 text-indigo-400" />
        <Activity className="w-3.5 h-3.5 flex-shrink-0 text-brand animate-pulse" />
        <span className="flex-1">{summary}</span>
        <span className="text-cafe-600 text-[10px] flex-shrink-0">
          {group.entries.length} entries
        </span>
      </button>

      {/* Content - internal logs */}
      {expanded && (
        <div className="max-h-96 overflow-auto bg-cafe-950/50 border-t border-cafe-800">
          <div className="p-2 space-y-0.5">
            {group.entries.map((entry) => (
              <TerminalLogEntry key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
