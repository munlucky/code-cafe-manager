/**
 * ThinkingBlock Component
 * 추론 과정(thinking)을 접을 수 있는 블록으로 표시하는 컴포넌트
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, BrainCircuit, AlertCircle } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { InteractionGroup } from '../../types/terminal';
import { TerminalLogEntry } from './TerminalLogEntry';

interface ThinkingBlockProps {
  group: InteractionGroup;
  className?: string;
  isRunning?: boolean;
  /** 외부에서 제어하는 펼침 상태 */
  expanded?: boolean;
  /** 펼침/접기 토글 핸들러 */
  onToggle?: () => void;
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

export function ThinkingBlock({
  group,
  className,
  isRunning,
  expanded: externalExpanded,
  onToggle,
}: ThinkingBlockProps): JSX.Element {
  // 외부 제어 모드: expanded와 onToggle이 모두 제공되면 외부 상태 사용
  const isControlled = externalExpanded !== undefined && onToggle !== undefined;
  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = isControlled ? externalExpanded : internalExpanded;

  const handleToggle = () => {
    if (isControlled) {
      onToggle();
    } else {
      setInternalExpanded((prev) => !prev);
    }
  };

  const summary = formatSummary(group.entries);
  const hasError = group.entries.some((e) => e.type === 'system' && e.content.toLowerCase().includes('error'));

  return (
    <div className={cn('my-3 rounded-lg', className)}>
      {/* Header - clickable to toggle */}
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          'w-full flex items-center gap-2 p-2.5 rounded-lg text-left transition-all border select-none',
          expanded
            ? 'bg-cafe-900 border-cafe-700'
            : 'bg-cafe-900/40 border-cafe-800 hover:bg-cafe-900 hover:border-cafe-700'
        )}
      >
        {/* Toggle Icon */}
        <div className={cn('p-1 rounded', expanded ? 'bg-cafe-800' : 'bg-transparent')}>
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-cafe-400" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-cafe-500" />
          )}
        </div>

        {/* Title Area */}
        <div className="flex items-center gap-2 flex-1">
          <BrainCircuit
            className={cn('w-4 h-4', isRunning ? 'text-brand animate-pulse' : 'text-cafe-500')}
          />
          <span className="text-xs font-medium text-cafe-300">
            {isRunning ? 'Processing thought chain...' : summary}
          </span>
          <span className="text-[10px] text-cafe-600 bg-cafe-950 px-1.5 py-0.5 rounded">
            {group.entries.length} steps
          </span>
        </div>

        {hasError && <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
      </button>

      {/* Content - internal logs with left border line */}
      {expanded && (
        <div className="mt-1 ml-4 pl-3 border-l-2 border-cafe-800 space-y-0.5 py-2 animate-in slide-in-from-top-1 fade-in duration-200">
          {group.entries.map((entry) => (
            <TerminalLogEntry key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
