/**
 * ThinkingBlock Component
 * 추론 과정(thinking)을 접을 수 있는 블록으로 표시하는 컴포넌트
 */

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, BrainCircuit, AlertCircle, Layers, Terminal, Cpu, Bot, CheckCircle2, XCircle, Clock } from 'lucide-react';
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
  stageId: string;      // 원래 Stage ID (예: analyze, plan, code)
  category?: string | null;    // 카테고리 (예: ANALYSIS, PLANNING, IMPLEMENTATION, VERIFICATION)
  number?: number;
  engine?: string;
  role?: string;        // role (예: claude-code, claude-opus-4.5)
  step?: string;
  skill?: string;
  skills?: string[];    // 여러 스킬 목록
}

/** Stage별 카테고리 매핑 */
function getStageCategory(stageId: string): string | null {
  const categoryMap: Record<string, string> = {
    'analyze': 'ANALYSIS',
    'plan': 'PLANNING',
    'code': 'IMPLEMENTATION',
    'implement': 'IMPLEMENTATION',
    'review': 'VERIFICATION',
    'test': 'VERIFICATION',
    'check': 'VERIFICATION',
    'verify': 'VERIFICATION',
  };
  // stageId와 카테고리가 같으면 중복 표시 방지를 위해 null 반환
  const category = categoryMap[stageId.toLowerCase()];
  if (category && category === stageId.toUpperCase()) {
    return null;
  }
  return category || null;
}

/** FOLLOWUP 패턴 감지 (followup-1234567890 형태) */
function isFollowupStage(stageId: string): boolean {
  return /^followup-\d+$/i.test(stageId);
}

/** Stage 표시용 레이블 생성 */
function getStageDisplayLabel(stageId: string, category: string | null): string {
  // FOLLOWUP 패턴이면 사용자 친화적 레이블 반환
  if (isFollowupStage(stageId)) {
    return 'Follow-up';
  }
  // category가 있으면 stageId와 category 조합
  if (category) {
    return `${stageId} (${category})`;
  }
  return stageId;
}

/** 유효한 AI Agent 이름인지 확인 (claude-* 형식만 유효) */
function isValidAgentName(name: string | undefined): boolean {
  if (!name) return false;
  // claude-code, claude-opus-4.5, claude-sonnet-4 등의 패턴만 유효한 agent 이름으로 간주
  return /^claude-[a-z0-9.-]+$/i.test(name.trim());
}

/** Stage 완료 정보 */
interface StageEndInfo {
  stageId: string;
  category: string | null;
  isCompleted: boolean; // true: completed, false: failed
  duration?: string;
}

/** Stage 완료 메시지 추출 */
function extractStageEndInfo(entries: ParsedLogEntry[]): StageEndInfo | null {
  // "✓ Stage Completed: stageId (category) (duration)" 또는 "✗ Stage Failed: stageId (category)"
  const stageEndPattern = /^([✓✗])\s*Stage\s+(Completed|Failed):\s*([^\s(]+)\s*(?:\(([^)]+)\))?(?:\s*\(([^)]+)\))?/i;

  for (const entry of entries) {
    const lines = entry.content.trim().split('\n');
    for (const line of lines) {
      const match = line.trim().match(stageEndPattern);
      if (match) {
        const isCompleted = match[2].toLowerCase() === 'completed';
        const stageId = match[3];
        const category = match[4] || getStageCategory(stageId);
        const duration = match[5];
        return { stageId, category, isCompleted, duration };
      }
    }
  }
  return null;
}

function extractStageInfo(entries: ParsedLogEntry[]): StageInfo | null {
  const stagePatterns = [
    /^(Stage|Phase|Step)\s*(\d+)/i,
    /^\[?(Stage|Phase|Step)\]?:\s*(.+)/i,
    /^#{1,3}\s*(Stage|Phase|Step)\s*(\d+)?:?\s*(.+)?/i,
    // "▶ Stage Started: stageId (category) (engine)" or "Stage Started: stageId (category)" pattern
    /(?:▶\s*)?Stage\s+Started:\s*([^\s(]+)\s*(?:\(([^)]+)\))?(?:\s*\(([^)]+)\))?/i,
  ];

  // 단계 정보 패턴 (예: "▶ Executing the agent chain", "▶ Planning...")
  const stepPattern = /▶\s+(Executing|Planning|Analyzing|Processing|Evaluating|Implementing)(.+)/i;

  // Skills: 패턴 (여러 스킬 목록) - ▶ 접두사가 없는 경우도 처리
  const skillsListPattern = /^(?:▶\s*)?Skills:\s*(.+)$/i;

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
  const skillsList: string[] = [];

  for (const entry of entries) {
    // 멀티라인 콘텐츠를 줄 단위로 분리하여 확인
    const lines = entry.content.trim().split('\n');

    for (const line of lines) {
      const content = line.trim();

      // 단계 정보 추출
      if (!stepInfo) {
        const stepMatch = content.match(stepPattern);
        if (stepMatch) {
          stepInfo = stepMatch[1] + (stepMatch[2] ? stepMatch[2].trim() : '');
        }
      }

      // Skills 목록 추출
      if (skillsList.length === 0) {
        const skillsMatch = content.match(skillsListPattern);
        if (skillsMatch && skillsMatch[1]) {
          const skills = skillsMatch[1].split(',').map(s => s.trim()).filter(s => s.length > 0);
          skillsList.push(...skills);
        }
      }

      // 개별 스킬 정보 추출
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
      if (!stageInfo) {
        for (const pattern of stagePatterns) {
          const match = content.match(pattern);
          if (match) {
            // 패턴 4 (Stage Started: stageId (category) (engine))의 경우
            // match[1]=stageId, match[2]=category, match[3]=engine
            if (match.length > 1 && match[1]) {
              const stageId = match[1];
              // match[2]가 있으면서 숫자가 아니면 category, 숫자면 number
              const hasCategory = match[2] && !/^\d+$/.test(match[2]);
              const category = hasCategory ? match[2] : getStageCategory(stageId);
              const engine = match[3] || undefined;
              const number = !hasCategory && match[2] ? parseInt(match[2], 10) : undefined;
              // engine을 role로도 사용 (claude-code 등)
              stageInfo = { stageId, category, engine, role: engine, number };
              break;
            }
          }
        }
      }
    }

    // Stage를 찾은 후에도 계속 진행하여 Skills 정보를 수집
    // Stage와 Skills가 서로 다른 줄에 있을 수 있음
  }

  if (stageInfo) {
    return {
      ...stageInfo,
      step: stepInfo,
      skill: skillInfo,
      skills: skillsList.length > 0 ? skillsList : undefined
    };
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
  const stageEndInfo = useMemo(() => extractStageEndInfo(group.entries), [group.entries]);
  const hasError = group.entries.some((e) => e.type === 'system' && e.content.toLowerCase().includes('error'));

  return (
    <div className={cn('my-3 rounded-lg', className)}>
      {/* Stage를 별도 섹션으로 표시 - 더 큰 레벨임을 명확히 */}
      {stageInfo && (
        <div className="mb-4 p-4 bg-gradient-to-r from-brand/10 via-cafe-900/60 to-cafe-900/40 border-l-4 border-brand rounded-r-lg shadow-sm backdrop-blur-sm">
          <div className="flex items-start gap-4">

            {/* Main Icon */}
            <div className="p-2.5 bg-brand/15 rounded-xl border border-brand/10 shadow-inner shrink-0 mt-0.5">
              <Layers className="w-5 h-5 text-brand drop-shadow-sm" />
            </div>

            <div className="flex-1 min-w-0 pt-1">
              {/* Title - StageID + Category 표시 (FOLLOWUP은 사용자 친화적 레이블로) */}
              <div className="text-sm font-bold text-brand uppercase tracking-widest leading-none">
                {getStageDisplayLabel(stageInfo.stageId, stageInfo.category)}
              </div>

              {/* Meta Section: Model & Skills */}
              <div className="mt-3 flex flex-wrap items-center gap-y-3 gap-x-4">

                {/* AI Agent Section - 유효한 agent 이름인 경우에만 표시 */}
                {(isValidAgentName(stageInfo.role) || isValidAgentName(stageInfo.engine)) && (
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1 opacity-70">
                      <Bot className="w-3 h-3 text-cafe-500" />
                      <span className="text-[9px] font-bold text-cafe-500 uppercase tracking-widest select-none">
                        AI Agent
                      </span>
                    </div>
                    <div className="flex items-center gap-2 group">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-cafe-950/80 rounded-md border border-brand/20 shadow-sm transition-all duration-300 group-hover:border-brand/40 group-hover:shadow-brand/5">
                        <Terminal className="w-3 h-3 text-brand" />
                        <span className="text-[11px] font-mono text-cafe-200 font-medium tracking-tight">
                          {stageInfo.role || stageInfo.engine}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Vertical Divider (Desktop) */}
                {stageInfo.skills && stageInfo.skills.length > 0 && (isValidAgentName(stageInfo.role) || isValidAgentName(stageInfo.engine)) && (
                  <div className="hidden sm:block w-px h-5 bg-gradient-to-b from-transparent via-cafe-700/50 to-transparent"></div>
                )}

                {/* Skills Section */}
                {stageInfo.skills && stageInfo.skills.length > 0 && (
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="flex items-center gap-1 opacity-70">
                      <Cpu className="w-3 h-3 text-cafe-500" />
                      <span className="text-[9px] font-bold text-cafe-500 uppercase tracking-widest select-none">
                        Skills
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {stageInfo.skills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-cafe-800/50 text-cafe-400 border border-cafe-700/30 transition-all duration-200 hover:bg-cafe-800 hover:text-cafe-200 hover:border-cafe-600 cursor-default"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Single Skill (from skill field) */}
                {!stageInfo.skills || stageInfo.skills.length === 0 ? (
                  <>
                    {stageInfo.skill && (
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center gap-1 opacity-70">
                          <Cpu className="w-3 h-3 text-cafe-500" />
                          <span className="text-[9px] font-bold text-cafe-500 uppercase tracking-widest select-none">
                            Skill
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-cafe-800/50 text-cafe-400 border border-cafe-700/30 transition-all duration-200 hover:bg-cafe-800 hover:text-cafe-200 hover:border-cafe-600 cursor-default">
                            {stageInfo.skill}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                ) : null}
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

      {/* Stage 완료 섹션 - Stage 시작과 대칭되는 디자인 */}
      {stageEndInfo && !isRunning && (
        <div className={cn(
          'mt-4 p-4 rounded-r-lg shadow-sm backdrop-blur-sm border-l-4',
          stageEndInfo.isCompleted
            ? 'bg-gradient-to-r from-emerald-500/10 via-cafe-900/60 to-cafe-900/40 border-emerald-500'
            : 'bg-gradient-to-r from-red-500/10 via-cafe-900/60 to-cafe-900/40 border-red-500'
        )}>
          <div className="flex items-start gap-4">
            {/* Status Icon */}
            <div className={cn(
              'p-2.5 rounded-xl border shadow-inner shrink-0 mt-0.5',
              stageEndInfo.isCompleted
                ? 'bg-emerald-500/15 border-emerald-500/10'
                : 'bg-red-500/15 border-red-500/10'
            )}>
              {stageEndInfo.isCompleted ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 drop-shadow-sm" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400 drop-shadow-sm" />
              )}
            </div>

            <div className="flex-1 min-w-0 pt-1">
              {/* Title - Stage Completed/Failed + StageID */}
              <div className={cn(
                'text-sm font-bold uppercase tracking-widest leading-none',
                stageEndInfo.isCompleted ? 'text-emerald-400' : 'text-red-400'
              )}>
                {stageEndInfo.isCompleted ? 'Stage Completed' : 'Stage Failed'}
              </div>

              {/* Meta Section: StageID & Duration */}
              <div className="mt-3 flex flex-wrap items-center gap-y-3 gap-x-4">
                {/* Stage ID */}
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1 opacity-70">
                    <Layers className="w-3 h-3 text-cafe-500" />
                    <span className="text-[9px] font-bold text-cafe-500 uppercase tracking-widest select-none">
                      Stage
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-cafe-950/80 rounded-md border border-cafe-700/30 shadow-sm">
                    <span className="text-[11px] font-mono text-cafe-200 font-medium tracking-tight">
                      {isFollowupStage(stageEndInfo.stageId) ? 'Follow-up' : stageEndInfo.stageId}
                      {stageEndInfo.category && !isFollowupStage(stageEndInfo.stageId) && (
                        <span className="text-cafe-500 ml-1">({stageEndInfo.category})</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Duration */}
                {stageEndInfo.duration && (
                  <>
                    <div className="hidden sm:block w-px h-5 bg-gradient-to-b from-transparent via-cafe-700/50 to-transparent"></div>
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center gap-1 opacity-70">
                        <Clock className="w-3 h-3 text-cafe-500" />
                        <span className="text-[9px] font-bold text-cafe-500 uppercase tracking-widest select-none">
                          Duration
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-cafe-950/80 rounded-md border border-cafe-700/30 shadow-sm">
                        <span className="text-[11px] font-mono text-cafe-200 font-medium">
                          {stageEndInfo.duration}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
