/**
 * CollapsibleContent Component
 * 접을 수 있는 콘텐츠 래퍼 컴포넌트
 */

import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react';
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
    <div className={cn('rounded-lg border border-cafe-800 overflow-hidden bg-cafe-950/50', className)}>
      {/* Header - clickable to toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-1.5 text-left select-none',
          'bg-cafe-900/80 hover:bg-cafe-800 transition-colors',
          'text-xs text-cafe-400'
        )}
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 flex-shrink-0 text-cafe-500" />
        ) : (
          <ChevronRight className="w-3 h-3 flex-shrink-0 text-cafe-500" />
        )}
        {Icon && <Icon className="w-3 h-3 flex-shrink-0 text-brand" />}
        <span className="truncate flex-1 font-mono text-cafe-300">{summary}</span>
        {metadataText && (
          <span className="text-[10px] text-cafe-600 flex-shrink-0">
            {metadataText}
          </span>
        )}
      </button>

      {/* Content */}
      {expanded && (
        <div className="p-3 overflow-x-auto max-h-96 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="font-mono text-[11px] leading-relaxed text-cafe-300">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
