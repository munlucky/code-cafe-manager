/**
 * FilePreview Component
 * 파일 콘텐츠를 라인 번호와 함께 미리보기하는 컴포넌트
 */

import { cn } from '../../utils/cn';

interface FilePreviewProps {
  content: string;
  fileName?: string;
  maxLines?: number;
  className?: string;
}

/** 라인 번호 패턴 제거 (예: "     1->" 형식) */
function stripLineNumberPrefix(line: string): string {
  return line.replace(/^\s*\d+->\s?/, '');
}

export function FilePreview({
  content,
  fileName,
  maxLines = 50,
  className,
}: FilePreviewProps): JSX.Element {
  const rawLines = content.split('\n');
  const totalLines = rawLines.length;
  const isTruncated = totalLines > maxLines;
  const displayLines = isTruncated ? rawLines.slice(0, maxLines) : rawLines;

  return (
    <div className={cn('font-mono text-xs', className)}>
      {/* File name header if provided */}
      {fileName && (
        <div className="px-3 py-1.5 bg-cafe-800/50 border-b border-cafe-800 text-cafe-400 text-[10px]">
          {fileName}
        </div>
      )}

      {/* Line content with numbers */}
      <div className="flex">
        {/* Line numbers column */}
        <div className="flex-shrink-0 py-2 pr-2 text-right bg-cafe-900/30 border-r border-cafe-800 select-none">
          {displayLines.map((_, index) => (
            <div
              key={index}
              className="px-2 text-cafe-600 leading-5"
            >
              {index + 1}
            </div>
          ))}
          {isTruncated && (
            <div className="px-2 text-cafe-600 leading-5">...</div>
          )}
        </div>

        {/* Code content column */}
        <div className="flex-1 py-2 pl-3 overflow-x-auto">
          {displayLines.map((line, index) => (
            <div
              key={index}
              className="text-cafe-300 leading-5 whitespace-pre"
            >
              {stripLineNumberPrefix(line) || ' '}
            </div>
          ))}
          {isTruncated && (
            <div className="text-cafe-500 leading-5 italic">
              ... {totalLines - maxLines} more lines
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
