/**
 * DiffBlock Component
 * 코드 diff를 시각적으로 렌더링하는 컴포넌트
 * - 추가된 라인 (+): 녹색 배경
 * - 삭제된 라인 (-): 빨간색 배경
 * - 변경 없는 라인: 기본 배경
 * - 좌/우 라인 번호 표시
 */

import { useState, useMemo } from 'react';
import { Copy, Check, GitBranch } from 'lucide-react';
import { cn } from '../../utils/cn';

interface DiffBlockProps {
  content: string;
  language?: string;
  className?: string;
}

/** Diff 라인 타입 */
type DiffLineType = 'add' | 'remove' | 'context' | 'header';

interface DiffLine {
  type: DiffLineType;
  content: string;
  oldLineNum: number | null;
  newLineNum: number | null;
}

/**
 * Diff 콘텐츠인지 감지
 * +/- 로 시작하는 라인이 일정 비율 이상이면 diff로 판단
 */
export function isDiffContent(content: string): boolean {
  const lines = content.split('\n');
  if (lines.length < 2) return false;

  let diffLineCount = 0;
  let hasAddOrRemove = false;

  for (const line of lines) {
    const trimmed = line.trimStart();

    // diff 헤더 패턴
    if (trimmed.startsWith('@@') || trimmed.startsWith('diff ') ||
        trimmed.startsWith('---') || trimmed.startsWith('+++') ||
        trimmed.startsWith('index ')) {
      diffLineCount++;
      continue;
    }

    // +/- 라인 (코드 diff)
    if (/^[+\-]\s/.test(line) || /^[+\-][^+\-]/.test(line)) {
      diffLineCount++;
      hasAddOrRemove = true;
    }

    // 공백으로 시작하는 context 라인
    if (/^\s{1,2}[^\s]/.test(line)) {
      diffLineCount++;
    }
  }

  // diff 라인 비율이 50% 이상이고, +/- 라인이 있어야 함
  return hasAddOrRemove && (diffLineCount / lines.length) >= 0.3;
}

/**
 * Diff 라인 파싱
 */
function parseDiffLines(content: string): DiffLine[] {
  const lines = content.split('\n');
  const result: DiffLine[] = [];

  let oldLineNum = 1;
  let newLineNum = 1;

  for (const line of lines) {
    // diff 헤더 (@@ -1,5 +1,7 @@)
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLineNum = parseInt(match[1], 10);
        newLineNum = parseInt(match[2], 10);
      }
      result.push({ type: 'header', content: line, oldLineNum: null, newLineNum: null });
      continue;
    }

    // 파일 헤더 (---, +++, diff, index)
    if (line.startsWith('---') || line.startsWith('+++') ||
        line.startsWith('diff ') || line.startsWith('index ')) {
      result.push({ type: 'header', content: line, oldLineNum: null, newLineNum: null });
      continue;
    }

    // 추가된 라인
    if (line.startsWith('+')) {
      result.push({ type: 'add', content: line.slice(1), oldLineNum: null, newLineNum: newLineNum++ });
      continue;
    }

    // 삭제된 라인
    if (line.startsWith('-')) {
      result.push({ type: 'remove', content: line.slice(1), oldLineNum: oldLineNum++, newLineNum: null });
      continue;
    }

    // Context 라인 (공백으로 시작하거나 일반 라인)
    result.push({
      type: 'context',
      content: line.startsWith(' ') ? line.slice(1) : line,
      oldLineNum: oldLineNum++,
      newLineNum: newLineNum++
    });
  }

  return result;
}

/**
 * 라인 타입별 스타일
 */
function getLineStyles(type: DiffLineType): {
  bg: string;
  text: string;
  lineNumBg: string;
  lineNumText: string;
  marker: string;
  markerText: string;
} {
  switch (type) {
    case 'add':
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-300',
        lineNumBg: 'bg-emerald-500/20',
        lineNumText: 'text-emerald-400',
        marker: '+',
        markerText: 'text-emerald-400 font-bold',
      };
    case 'remove':
      return {
        bg: 'bg-red-500/10',
        text: 'text-red-300',
        lineNumBg: 'bg-red-500/20',
        lineNumText: 'text-red-400',
        marker: '-',
        markerText: 'text-red-400 font-bold',
      };
    case 'header':
      return {
        bg: 'bg-brand/5',
        text: 'text-brand',
        lineNumBg: 'bg-brand/10',
        lineNumText: 'text-brand',
        marker: '',
        markerText: '',
      };
    default:
      return {
        bg: 'bg-transparent',
        text: 'text-cafe-300',
        lineNumBg: 'bg-cafe-900/30',
        lineNumText: 'text-cafe-600',
        marker: ' ',
        markerText: 'text-cafe-600',
      };
  }
}

export function DiffBlock({ content, language, className }: DiffBlockProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const diffLines = useMemo(() => parseDiffLines(content), [content]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  // 통계 계산
  const stats = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    for (const line of diffLines) {
      if (line.type === 'add') additions++;
      if (line.type === 'remove') deletions++;
    }
    return { additions, deletions };
  }, [diffLines]);

  return (
    <div className={cn('rounded-lg border border-cafe-700/50 overflow-hidden bg-cafe-950', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-cafe-900 border-b border-cafe-800/50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <GitBranch className="w-3.5 h-3.5 text-cafe-500" />
            <span className="text-[10px] font-medium text-cafe-400">
              {language || 'diff'}
            </span>
          </div>
          {/* 통계 */}
          <div className="flex items-center gap-2 text-[10px]">
            {stats.additions > 0 && (
              <span className="text-emerald-400">+{stats.additions}</span>
            )}
            {stats.deletions > 0 && (
              <span className="text-red-400">-{stats.deletions}</span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-cafe-500 hover:text-cafe-300 hover:bg-cafe-800 rounded transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-green-500" />
              <span className="text-green-500">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <tbody>
            {diffLines.map((line, index) => {
              const styles = getLineStyles(line.type);
              return (
                <tr
                  key={index}
                  className={cn('transition-colors duration-75', styles.bg, 'hover:brightness-110')}
                >
                  {/* Old line number */}
                  <td
                    className={cn(
                      'select-none text-right pr-1 pl-2 py-0 font-mono text-[10px] border-r border-cafe-800/30 align-top',
                      styles.lineNumBg,
                      styles.lineNumText
                    )}
                    style={{ width: '2.5rem', minWidth: '2.5rem' }}
                  >
                    <span style={{ lineHeight: '1.4rem' }}>
                      {line.oldLineNum ?? ''}
                    </span>
                  </td>

                  {/* New line number */}
                  <td
                    className={cn(
                      'select-none text-right pr-1 pl-1 py-0 font-mono text-[10px] border-r border-cafe-800/30 align-top',
                      styles.lineNumBg,
                      styles.lineNumText
                    )}
                    style={{ width: '2.5rem', minWidth: '2.5rem' }}
                  >
                    <span style={{ lineHeight: '1.4rem' }}>
                      {line.newLineNum ?? ''}
                    </span>
                  </td>

                  {/* Marker (+/-/ ) */}
                  <td
                    className={cn(
                      'select-none text-center py-0 font-mono text-[11px] align-top w-6',
                      styles.markerText
                    )}
                  >
                    <span style={{ lineHeight: '1.4rem' }}>{styles.marker}</span>
                  </td>

                  {/* Content */}
                  <td className="pl-1 pr-3 py-0 align-top">
                    <code
                      className={cn('font-mono text-[11px] whitespace-pre', styles.text)}
                      style={{ lineHeight: '1.4rem' }}
                    >
                      {line.content || ' '}
                    </code>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
