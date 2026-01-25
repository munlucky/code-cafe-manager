/**
 * MarkdownContentRenderer Component
 * 마크다운 콘텐츠(특히 코드블럭)를 렌더링하는 재사용 가능한 컴포넌트
 */

import { cn } from '../../utils/cn';
import { CodeBlock, parseMarkdownCodeBlocks } from './CodeBlock';
import { AsciiDiagramBlock } from './AsciiDiagramBlock';
import { DiffBlock } from './DiffBlock';

/**
 * HTML 엔티티 디코딩
 * ANSI to HTML 변환 시 이스케이프된 문자를 복원
 * (보안: 이 함수는 이미 이스케이프된 콘텐츠에만 사용)
 */
function decodeHtmlEntities(text: string): string {
  const htmlDecodeMap: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#x27;': "'",
  };

  return text.replace(/&(?:amp|lt|gt|quot|#39|#x27);/g, (match) => htmlDecodeMap[match] || match);
}

interface MarkdownContentRendererProps {
  content: string;
  /** 텍스트 크기 클래스 (기본: text-xs) */
  textSize?: string;
  /** 텍스트 색상 클래스 (기본: text-cafe-300) */
  textColor?: string;
  /** 에러 텍스트 색상 클래스 (기본: text-red-400) */
  errorColor?: string;
  /** 에러 콘텐츠 여부 */
  isError?: boolean;
  /** 컨테이너 클래스 */
  className?: string;
}

/**
 * 마크다운 코드블럭을 파싱하여 텍스트와 코드를 적절히 렌더링
 */
export function MarkdownContentRenderer({
  content,
  textSize = 'text-xs',
  textColor = 'text-cafe-300',
  errorColor = 'text-red-400',
  isError = false,
  className,
}: MarkdownContentRendererProps): JSX.Element {
  // HTML 엔티티 디코딩 적용 (ANSI to HTML 변환 시 이스케이프된 문자 복원)
  const decodedContent = decodeHtmlEntities(content);
  const parsedContent = parseMarkdownCodeBlocks(decodedContent);
  const hasSpecialBlocks = parsedContent.some((p) => p.type === 'code' || p.type === 'diagram' || p.type === 'diff');

  if (!hasSpecialBlocks) {
    // 코드블럭이 없으면 단순 텍스트 렌더링
    return (
      <div
        className={cn(
          textSize,
          'whitespace-pre-wrap break-words',
          isError ? errorColor : textColor,
          className
        )}
      >
        {decodedContent}
      </div>
    );
  }

  // 코드블럭이 있으면 파싱된 콘텐츠 렌더링
  return (
    <div className={cn('space-y-2', className)}>
      {parsedContent.map((part, index) => {
        switch (part.type) {
          case 'diagram':
            return <AsciiDiagramBlock key={index} content={part.content} />;
          case 'diff':
            return <DiffBlock key={index} content={part.content} language={part.language} />;
          case 'code':
            return <CodeBlock key={index} code={part.content} language={part.language} />;
          default:
            return (
              <div
                key={index}
                className={cn(
                  textSize,
                  'whitespace-pre-wrap break-words',
                  isError ? errorColor : textColor
                )}
              >
                {part.content}
              </div>
            );
        }
      })}
    </div>
  );
}
