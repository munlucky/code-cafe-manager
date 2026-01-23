/**
 * CodeBlock Component
 * 마크다운 코드블럭을 렌더링하는 컴포넌트
 */

import { useState } from 'react';
import { Copy, Check, FileCode } from 'lucide-react';
import { cn } from '../../utils/cn';

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

export function CodeBlock({ code, language, className }: CodeBlockProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  return (
    <div className={cn('rounded-lg border border-cafe-800 overflow-hidden bg-cafe-950/80', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-cafe-900/80 border-b border-cafe-800">
        <div className="flex items-center gap-2 text-[10px] text-cafe-500">
          <FileCode className="w-3 h-3" />
          <span className="font-mono">{language || 'code'}</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-cafe-500 hover:text-cafe-300 transition-colors"
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

      {/* Code Content */}
      <div className="p-3 overflow-x-auto">
        <pre className="font-mono text-[11px] leading-relaxed text-cafe-200 whitespace-pre">
          {code}
        </pre>
      </div>
    </div>
  );
}

/** 마크다운 코드블럭 파싱 결과 */
export interface ParsedContent {
  type: 'text' | 'code';
  content: string;
  language?: string;
}

/** 마크다운 텍스트에서 코드블럭 파싱 */
export function parseMarkdownCodeBlocks(text: string): ParsedContent[] {
  const codeBlockPattern = /```(\w+)?\n([\s\S]*?)```/g;
  const parts: ParsedContent[] = [];
  let lastIndex = 0;

  let match;
  while ((match = codeBlockPattern.exec(text)) !== null) {
    // 코드블럭 이전 텍스트
    if (match.index > lastIndex) {
      const textContent = text.slice(lastIndex, match.index).trim();
      if (textContent) {
        parts.push({ type: 'text', content: textContent });
      }
    }

    // 코드블럭
    parts.push({
      type: 'code',
      language: match[1] || undefined,
      content: match[2].trim(),
    });

    lastIndex = match.index + match[0].length;
  }

  // 마지막 텍스트
  if (lastIndex < text.length) {
    const textContent = text.slice(lastIndex).trim();
    if (textContent) {
      parts.push({ type: 'text', content: textContent });
    }
  }

  // 코드블럭이 없으면 전체를 텍스트로 (일관성 있게 trim 및 빈 문자열 체크)
  if (parts.length === 0 && text) {
    const trimmedContent = text.trim();
    if (trimmedContent) {
      parts.push({ type: 'text', content: trimmedContent });
    }
  }

  return parts;
}
