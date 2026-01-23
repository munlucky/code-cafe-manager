/**
 * ThinkingBlock Component
 * 추론 과정(thinking)을 접을 수 있는 블록으로 표시하는 컴포넌트
 */

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, BrainCircuit, AlertCircle, Layers } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { InteractionGroup, ParsedLogEntry } from '../../types/terminal';
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

/** Stage 정보 추출 */
interface StageInfo {
  name: string;
  number?: number;
}

function extractStageInfo(entries: ParsedLogEntry[]): StageInfo | null {
  const stagePatterns = [
    /^(Stage|Phase|Step)\s*(\d+)/i,
    /^\[?(Stage|Phase|Step)\]?:\s*(.+)/i,
    /^#{1,3}\s*(Stage|Phase|Step)\s*(\d+)?:?\s*(.+)?/i,
  ];

  for (const entry of entries) {
    const content = entry.content.trim();
    for (const pattern of stagePatterns) {
      const match = content.match(pattern);
      if (match) {
        const stageName = match[1];
        const stageNum = match[2] ? parseInt(match[2], 10) : undefined;
        return { name: stageName, number: stageNum };
      }
    }
  }
  return null;
}

/** 연속된 Tool 그룹화 정보 */
interface ToolGroup {
  name: string;
  count: number;
}

function groupConsecutiveTools(entries: ParsedLogEntry[]): ToolGroup[] {
  const toolEntries = entries.filter((e) => e.type === 'tool_use' && e.toolName);
  if (toolEntries.length === 0) return [];

  const groups: ToolGroup[] = [];
  let currentTool = toolEntries[0].toolName!;
  let currentCount = 1;

  for (let i = 1; i < toolEntries.length; i++) {
    const toolName = toolEntries[i].toolName!;
    if (toolName === currentTool) {
      currentCount++;
    } else {
      groups.push({ name: currentTool, count: currentCount });
      currentTool = toolName;
      currentCount = 1;
    }
  }
  groups.push({ name: currentTool, count: currentCount });

  return groups;
}

function formatSummary(entries: InteractionGroup['entries']): string {
  const toolGroups = groupConsecutiveTools(entries);
  const toolResultCount = entries.filter((e) => e.type === 'tool_result').length;
  const thinkingCount = entries.filter((e) => e.type === 'thinking').length;
  const systemCount = entries.filter((e) => e.type === 'system').length;

  const parts: string[] = [];

  // 연속된 Tool 그룹화 표시 (예: "Write 3개, Read 2개")
  if (toolGroups.length > 0) {
    const toolParts = toolGroups.map((g) =>
      g.count > 1 ? `${g.name} ${g.count}개` : g.name
    );
    parts.push(toolParts.join(', '));
  }

  if (toolResultCount > 0 && toolGroups.length === 0) {
    parts.push(`${toolResultCount}개 결과`);
  }
  if (thinkingCount > 0) {
    parts.push(`${thinkingCount}개 추론`);
  }
  if (systemCount > 0) {
    parts.push(`${systemCount}개 시스템`);
  }

  if (parts.length > 0) {
    return parts.join(' | ');
  }

  return `${entries.length}개 작업 수행 중...`;
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
  const stageInfo = useMemo(() => extractStageInfo(group.entries), [group.entries]);
  const hasError = group.entries.some((e) => e.type === 'system' && e.content.toLowerCase().includes('error'));

  return (
    <div className={cn('my-3 rounded-lg', className)}>
      {/* Stage Badge - if stage detected */}
      {stageInfo && (
        <div className="flex items-center gap-2 mb-1 ml-1">
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-brand/10 border border-brand/30 rounded text-[10px] text-brand">
            <Layers className="w-3 h-3" />
            <span className="font-medium">
              {stageInfo.name} {stageInfo.number ?? ''}
            </span>
          </div>
        </div>
      )}

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
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <BrainCircuit
            className={cn('w-4 h-4 flex-shrink-0', isRunning ? 'text-brand animate-pulse' : 'text-cafe-500')}
          />
          <span className="text-xs font-medium text-cafe-300 truncate">
            {isRunning ? 'Processing...' : summary}
          </span>
          <span className="text-[10px] text-cafe-600 bg-cafe-950 px-1.5 py-0.5 rounded flex-shrink-0">
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
