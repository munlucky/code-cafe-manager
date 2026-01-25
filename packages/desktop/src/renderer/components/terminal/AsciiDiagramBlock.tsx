/**
 * AsciiDiagramBlock Component
 * ASCII 다이어그램/박스 아트를 시각적으로 렌더링하는 컴포넌트
 * - 박스 문자 (┌, ─, ┐, │, └, ┘, ├, ┤, ┬, ┴, ┼ 등)
 * - 화살표 문자 (▼, ▲, ◀, ▶, →, ←, ↑, ↓)
 * - 플로우차트 스타일 다이어그램
 */

import { useState } from 'react';
import { Copy, Check, Layout } from 'lucide-react';
import { cn } from '../../utils/cn';

interface AsciiDiagramBlockProps {
  content: string;
  className?: string;
}

/** ASCII 박스 문자 패턴 */
const BOX_DRAWING_CHARS = /[┌┐└┘│─├┤┬┴┼╔╗╚╝║═╠╣╦╩╬┏┓┗┛┃━┣┫┳┻╋]/;

/** 화살표 문자 패턴 */
const ARROW_CHARS = /[▼▲◀▶→←↑↓⇒⇐⇑⇓➔➜➝]/;

/** 체크/상태 마커 패턴 */
const STATUS_MARKERS = /[✓✔✗✘❌⚠️⭕●○◆◇■□]/;

/**
 * ASCII 다이어그램인지 감지
 * 박스 문자, 화살표, 상태 마커 등이 포함되어 있으면 다이어그램으로 판단
 */
export function isAsciiDiagram(content: string): boolean {
  const lines = content.split('\n');

  // 박스 문자가 3개 이상의 라인에서 발견되면 다이어그램
  let boxLineCount = 0;
  let hasArrowOrMarker = false;

  for (const line of lines) {
    if (BOX_DRAWING_CHARS.test(line)) {
      boxLineCount++;
    }
    if (ARROW_CHARS.test(line) || STATUS_MARKERS.test(line)) {
      hasArrowOrMarker = true;
    }
  }

  // 박스 라인이 3개 이상이거나, 박스 라인이 있고 화살표/마커가 있으면 다이어그램
  return boxLineCount >= 3 || (boxLineCount >= 1 && hasArrowOrMarker);
}

/**
 * 라인 내용에 따른 스타일 결정
 */
function getLineStyle(line: string): string {
  // 상태 마커가 있는 라인
  if (/✓|✔/.test(line)) {
    return 'text-emerald-400';
  }
  if (/✗|✘|❌/.test(line)) {
    return 'text-red-400';
  }
  if (/⚠️/.test(line)) {
    return 'text-yellow-400';
  }

  // 번호가 있는 헤더 라인 (예: "│  1. 사용자가...")
  if (/│\s*\d+\./.test(line)) {
    return 'text-brand';
  }

  // 기본 스타일
  return 'text-cafe-300';
}

/**
 * 텍스트 콘텐츠 렌더링
 */
function renderContent(text: string): JSX.Element {
  return <>{text}</>;
}

export function AsciiDiagramBlock({ content, className }: AsciiDiagramBlockProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const lines = content.split('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  return (
    <div className={cn('rounded-lg border border-brand/20 overflow-hidden bg-cafe-950/80', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-brand/10 border-b border-brand/20">
        <div className="flex items-center gap-2">
          <Layout className="w-3.5 h-3.5 text-brand" />
          <span className="text-[10px] font-medium text-brand uppercase tracking-wider">
            Diagram
          </span>
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
      <div className="p-4 overflow-x-auto">
        <pre className="font-mono text-[11px] leading-relaxed whitespace-pre">
          {lines.map((line, index) => (
            <div
              key={index}
              className={cn(
                'min-h-[1.25rem]',
                getLineStyle(line)
              )}
            >
              {renderContent(line) || ' '}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
