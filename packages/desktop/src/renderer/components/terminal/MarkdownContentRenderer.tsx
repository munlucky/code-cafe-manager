/**
 * MarkdownContentRenderer Component
 * 마크다운 콘텐츠(특히 코드블럭)를 렌더링하는 재사용 가능한 컴포넌트
 */

import { cn } from '../../utils/cn';
import { CodeBlock, parseMarkdownCodeBlocks } from './CodeBlock';

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
  const parsedContent = parseMarkdownCodeBlocks(content);
  const hasCodeBlocks = parsedContent.some((p) => p.type === 'code');

  if (!hasCodeBlocks) {
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
        {content}
      </div>
    );
  }

  // 코드블럭이 있으면 파싱된 콘텐츠 렌더링
  return (
    <div className={cn('space-y-2', className)}>
      {parsedContent.map((part, index) =>
        part.type === 'code' ? (
          <CodeBlock key={index} code={part.content} language={part.language} />
        ) : (
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
        )
      )}
    </div>
  );
}
