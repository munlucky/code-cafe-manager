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
  engine?: string;
  step?: string;
  skill?: string;
}

function extractStageInfo(entries: ParsedLogEntry[]): StageInfo | null {
  const stagePatterns = [
    /^(Stage|Phase|Step)\s*(\d+)/i,
    /^\[?(Stage|Phase|Step)\]?:\s*(.+)/i,
    /^#{1,3}\s*(Stage|Phase|Step)\s*(\d+)?:?\s*(.+)?/i,
    // "▶ Stage Started: NAME (engine)" or "Stage Started: NAME" pattern
    /(?:▶\s*)?Stage\s+Started:\s*([^\s(]+)\s*(?:\(([^)]+)\))?/i,
  ];

  // 단계 정보 패턴 (예: "▶ Executing the agent chain", "▶ Planning...")
  const stepPattern = /▶\s+(Executing|Planning|Analyzing|Processing|Evaluating|Implementing)(.+)/i;

  // 스킬 실행 패턴
  const skillPatterns = [
    /▶\s*(?:Launching|Executing)\s+skill:\s*(\S+)/i,
    /▶\s*Delegating\s+to\s+(\w+):\s*(.+)/i,
    /▶\s*Skill\s+execution:\s*(\S+)/i,
    /▶\s*Running\s+\/?(\S+)/i,  // /moonshot-xxx
  ];

  let stageInfo: StageInfo | null = null;
  let stepInfo: string | undefined;
  let skillInfo: string | undefined;

  for (const entry of entries) {
    const content = entry.content.trim();

    // 단계 정보 추출
    if (!stepInfo) {
      const stepMatch = content.match(stepPattern);
      if (stepMatch) {
        stepInfo = stepMatch[1] + (stepMatch[2] ? stepMatch[2].trim() : '');
      }
    }

    // 스킬 정보 추출
    if (!skillInfo) {
      for (const pattern of skillPatterns) {
        const match = content.match(pattern);
        if (match) {
          // Delegating to Expert: task 형식인 경우
          if (match[2]) {
            skillInfo = `${match[1]}: ${match[2].trim()}`;
          } else {
            skillInfo = match[1];
          }
          break;
        }
      }
    }

    // Stage 정보 추출
    for (const pattern of stagePatterns) {
      const match = content.match(pattern);
      if (match) {
        // 패턴 4 (Stage Started: NAME (engine))의 경우: match[1]=name, match[2]=engine
        if (match.length > 1 && match[1]) {
          const name = match[1];
          // match[2]가 있으면서 숫자가 아니면 engine, 숫자면 number
          const hasEngine = match[2] && !/^\d+$/.test(match[2]);
          const engine = hasEngine ? match[2] : undefined;
          const number = !hasEngine && match[2] ? parseInt(match[2], 10) : undefined;
          stageInfo = { name, engine, number };
          break;
        }
      }
    }

    if (stageInfo) break;
  }

  if (stageInfo) {
    return { ...stageInfo, step: stepInfo, skill: skillInfo };
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
      {/* Stage를 별도 섹션으로 표시 - 더 큰 레벨임을 명확히 */}
      {stageInfo && (
        <div className="mb-4 p-3 bg-gradient-to-r from-brand/10 to-cafe-900/50 border-l-4 border-brand rounded-r-lg">
          <div className="flex items-center gap-3">
            {/* Stage 아이콘 - 더 크게 */}
            <div className="p-2 bg-brand/20 rounded-lg">
              <Layers className="w-5 h-5 text-brand" />
            </div>

            {/* Stage 이름 - 더 큰 폰트 */}
            <div className="flex-1">
              <div className="text-sm font-bold text-brand uppercase tracking-wide">
                {stageInfo.name} {stageInfo.number ?? ''}
              </div>

              {/* 부가 정보들을 같은 행에 표시 */}
              <div className="flex items-center gap-2 mt-1">
                {stageInfo.engine && (
                  <span className="text-[10px] px-2 py-0.5 bg-cafe-800 rounded text-cafe-400 font-mono">
                    {stageInfo.engine}
                  </span>
                )}
                {stageInfo.step && (
                  <span className="text-[10px] text-cafe-500">
                    {stageInfo.step}
                  </span>
                )}
                {stageInfo.skill && (
                  <span className="text-[10px] px-2 py-0.5 bg-brand/20 rounded text-brand-light">
                    Skill: {stageInfo.skill}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header - clickable to toggle */}
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          'flex items-center gap-2 p-2.5 rounded-lg text-left transition-all border select-none',
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
