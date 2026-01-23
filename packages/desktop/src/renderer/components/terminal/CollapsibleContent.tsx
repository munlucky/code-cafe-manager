/**
 * CollapsibleContent Component
 * 접을 수 있는 콘텐츠 래퍼 컴포넌트
 */

import { useState, type ReactNode } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

interface CollapsibleContentProps {
  summary: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  icon?: LucideIcon;
  metadata?: {
    lines?: number;
    size?: string;
  };
  className?: string;
}

export function CollapsibleContent({
  summary,
  children,
  defaultExpanded = false,
  icon: Icon,
  metadata,
  className,
}: CollapsibleContentProps): JSX.Element {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const metadataText = [
    metadata?.lines && `${metadata.lines} lines`,
    metadata?.size,
  ]
    .filter(Boolean)
    .join(' | ');

  return (
    <div className={cn('rounded border border-cafe-800', className)}>
      {/* Header - clickable to toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-left',
          'bg-cafe-900/50 hover:bg-cafe-900 transition-colors',
          'text-xs text-cafe-400'
        )}
      >
        <ChevronDown
          className={cn(
            'w-4 h-4 transition-transform duration-200 flex-shrink-0',
            expanded ? 'rotate-0' : '-rotate-90'
          )}
        />
        {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
        <span className="truncate flex-1">{summary}</span>
        {metadataText && (
          <span className="text-cafe-600 text-[10px] flex-shrink-0">
            {metadataText}
          </span>
        )}
      </button>

      {/* Content */}
      {expanded && (
        <div className="max-h-96 overflow-auto bg-cafe-950/50">
          {children}
        </div>
      )}
    </div>
  );
}
