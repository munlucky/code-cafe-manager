/**
 * CodeBlock Component
 * IDE 스타일의 코드블럭을 렌더링하는 컴포넌트
 * - 라인 번호
 * - 기본 신택스 하이라이팅
 * - 복사 기능
 */

import { useState, useMemo } from 'react';
import { Copy, Check, FileCode } from 'lucide-react';
import { cn } from '../../utils/cn';

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
  showLineNumbers?: boolean;
}

/** 언어별 파일 확장자 매핑 */
const languageExtensions: Record<string, string> = {
  typescript: '.tsx',
  ts: '.tsx',
  tsx: '.tsx',
  javascript: '.jsx',
  js: '.jsx',
  jsx: '.jsx',
  python: '.py',
  py: '.py',
  rust: '.rs',
  go: '.go',
  java: '.java',
  cpp: '.cpp',
  c: '.c',
  css: '.css',
  scss: '.scss',
  html: '.html',
  json: '.json',
  yaml: '.yml',
  yml: '.yml',
  bash: '.sh',
  sh: '.sh',
  sql: '.sql',
  markdown: '.md',
  md: '.md',
};

/** 기본 신택스 하이라이팅 토큰 타입 */
type TokenType = 'keyword' | 'string' | 'comment' | 'number' | 'operator' | 'function' | 'variable' | 'type' | 'plain';

interface Token {
  type: TokenType;
  value: string;
}

/** 언어별 키워드 정의 */
const keywords: Record<string, string[]> = {
  typescript: ['import', 'export', 'from', 'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'interface', 'type', 'extends', 'implements', 'async', 'await', 'new', 'this', 'throw', 'try', 'catch', 'finally', 'default', 'switch', 'case', 'break', 'continue', 'typeof', 'instanceof', 'in', 'of', 'as', 'is', 'keyof', 'readonly', 'public', 'private', 'protected', 'static', 'abstract', 'enum', 'namespace', 'module', 'declare', 'true', 'false', 'null', 'undefined', 'void', 'never', 'any', 'unknown', 'boolean', 'number', 'string', 'object', 'symbol', 'bigint'],
  javascript: ['import', 'export', 'from', 'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'extends', 'async', 'await', 'new', 'this', 'throw', 'try', 'catch', 'finally', 'default', 'switch', 'case', 'break', 'continue', 'typeof', 'instanceof', 'in', 'of', 'true', 'false', 'null', 'undefined', 'void'],
  python: ['import', 'from', 'as', 'def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally', 'with', 'raise', 'pass', 'break', 'continue', 'and', 'or', 'not', 'in', 'is', 'lambda', 'yield', 'global', 'nonlocal', 'assert', 'True', 'False', 'None', 'async', 'await'],
  rust: ['fn', 'let', 'mut', 'const', 'if', 'else', 'for', 'while', 'loop', 'match', 'return', 'break', 'continue', 'struct', 'enum', 'impl', 'trait', 'type', 'use', 'mod', 'pub', 'self', 'super', 'crate', 'where', 'async', 'await', 'move', 'dyn', 'static', 'ref', 'as', 'in', 'true', 'false', 'Some', 'None', 'Ok', 'Err'],
  go: ['package', 'import', 'func', 'var', 'const', 'type', 'struct', 'interface', 'map', 'chan', 'if', 'else', 'for', 'range', 'switch', 'case', 'default', 'break', 'continue', 'return', 'go', 'defer', 'select', 'fallthrough', 'goto', 'true', 'false', 'nil', 'iota'],
};

/** 기본 토크나이저 (언어별 키워드 기반) */
function tokenize(code: string, language?: string): Token[][] {
  const lines = code.split('\n');
  const lang = language?.toLowerCase() || '';
  const langKeywords = keywords[lang] || keywords['typescript'] || [];

  return lines.map(line => {
    const tokens: Token[] = [];
    let remaining = line;
    let pos = 0;

    while (remaining.length > 0) {
      let matched = false;

      // 주석 (// 또는 #)
      if (remaining.startsWith('//') || (lang === 'python' && remaining.startsWith('#'))) {
        tokens.push({ type: 'comment', value: remaining });
        break;
      }

      // 문자열 (', ", `)
      const stringMatch = remaining.match(/^(['"`])(?:[^\\]|\\.)*?\1/);
      if (stringMatch) {
        tokens.push({ type: 'string', value: stringMatch[0] });
        remaining = remaining.slice(stringMatch[0].length);
        matched = true;
        continue;
      }

      // 숫자
      const numberMatch = remaining.match(/^0x[0-9a-fA-F]+|^\d+\.?\d*(?:[eE][+-]?\d+)?/);
      if (numberMatch) {
        tokens.push({ type: 'number', value: numberMatch[0] });
        remaining = remaining.slice(numberMatch[0].length);
        matched = true;
        continue;
      }

      // 키워드 또는 식별자
      const identMatch = remaining.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/);
      if (identMatch) {
        const word = identMatch[0];
        if (langKeywords.includes(word)) {
          tokens.push({ type: 'keyword', value: word });
        } else if (/^[A-Z]/.test(word)) {
          tokens.push({ type: 'type', value: word });
        } else if (remaining.slice(word.length).match(/^\s*\(/)) {
          tokens.push({ type: 'function', value: word });
        } else {
          tokens.push({ type: 'variable', value: word });
        }
        remaining = remaining.slice(word.length);
        matched = true;
        continue;
      }

      // 연산자
      const opMatch = remaining.match(/^[+\-*/%=<>!&|^~?:]+|^[{}[\]();,.:]/);
      if (opMatch) {
        tokens.push({ type: 'operator', value: opMatch[0] });
        remaining = remaining.slice(opMatch[0].length);
        matched = true;
        continue;
      }

      // 공백
      const spaceMatch = remaining.match(/^\s+/);
      if (spaceMatch) {
        tokens.push({ type: 'plain', value: spaceMatch[0] });
        remaining = remaining.slice(spaceMatch[0].length);
        matched = true;
        continue;
      }

      // 기타 문자
      if (!matched) {
        tokens.push({ type: 'plain', value: remaining[0] });
        remaining = remaining.slice(1);
      }
    }

    return tokens;
  });
}

/** 토큰 타입별 스타일 */
const tokenStyles: Record<TokenType, string> = {
  keyword: 'text-purple-400',      // import, export, const, etc.
  string: 'text-green-400',        // "string", 'string'
  comment: 'text-cafe-600 italic', // // comment
  number: 'text-orange-400',       // 123, 0xff
  operator: 'text-cafe-400',       // +, -, =, etc.
  function: 'text-blue-400',       // functionName()
  variable: 'text-cafe-200',       // variable
  type: 'text-cyan-400',           // TypeName
  plain: 'text-cafe-300',          // default
};

export function CodeBlock({ code, language, className, showLineNumbers = true }: CodeBlockProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const lines = code.split('\n');
  const lineCount = lines.length;
  const lineNumberWidth = Math.max(2, String(lineCount).length);

  const tokenizedLines = useMemo(() => tokenize(code, language), [code, language]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  const ext = language ? (languageExtensions[language.toLowerCase()] || `.${language}`) : '';

  return (
    <div className={cn('rounded-lg border border-cafe-700/50 overflow-hidden bg-cafe-950', className)}>
      {/* Header - IDE style */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-cafe-900 border-b border-cafe-800/50">
        <div className="flex items-center gap-2">
          {/* Traffic lights */}
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-cafe-500 ml-2">
            <FileCode className="w-3 h-3" />
            <span className="font-mono">{language || 'code'}{ext}</span>
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

      {/* Code Content - with line numbers */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <tbody>
            {tokenizedLines.map((lineTokens, lineIndex) => (
              <tr
                key={lineIndex}
                className="hover:bg-cafe-900/30 transition-colors duration-75"
              >
                {/* Line number */}
                {showLineNumbers && (
                  <td
                    className="select-none text-right pr-3 pl-3 py-0 font-mono text-[11px] text-cafe-600 border-r border-cafe-800/30 bg-cafe-900/20 align-top"
                    style={{ width: `${lineNumberWidth + 2}ch`, minWidth: '2.5rem' }}
                  >
                    <span style={{ lineHeight: '1.5rem' }}>{lineIndex + 1}</span>
                  </td>
                )}
                {/* Code line */}
                <td className="pl-3 pr-3 py-0 align-top">
                  <code
                    className="font-mono text-[11px] whitespace-pre"
                    style={{ lineHeight: '1.5rem' }}
                  >
                    {lineTokens.length > 0 ? (
                      lineTokens.map((token, tokenIndex) => (
                        <span key={tokenIndex} className={tokenStyles[token.type]}>
                          {token.value}
                        </span>
                      ))
                    ) : (
                      <span>&nbsp;</span>
                    )}
                  </code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
