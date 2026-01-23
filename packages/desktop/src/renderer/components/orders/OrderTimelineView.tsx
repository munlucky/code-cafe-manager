import { type ReactElement, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  Circle,
  XCircle,
  Terminal,
  MessageSquare,
  Play,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { cn } from '../../utils/cn';

export type TimelineEventType = 'stage_start' | 'stage_complete' | 'stage_fail' | 'log' | 'input' | 'system';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  timestamp: string;
  content: string;
  stageName?: string;
  metadata?: any;
}

interface OrderTimelineViewProps {
  events: TimelineEvent[];
  className?: string;
}

function formatTime(isoString: string, locale: string): string {
  try {
    return new Date(isoString).toLocaleTimeString(locale, {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (e) {
    return isoString;
  }
}

export function OrderTimelineView({
  events,
  className
}: OrderTimelineViewProps): ReactElement {
  const { i18n } = useTranslation();

  // Group logs between major events
  const groupedEvents = useMemo(() => {
    const groups: Array<{
      type: 'event' | 'logs';
      data: TimelineEvent | TimelineEvent[];
      id: string;
    }> = [];

    let currentLogs: TimelineEvent[] = [];

    events.forEach((event) => {
      if (event.type === 'log') {
        currentLogs.push(event);
      } else {
        // Flush logs
        if (currentLogs.length > 0) {
          groups.push({
            type: 'logs',
            data: [...currentLogs],
            id: `logs-${currentLogs[0].id}`
          });
          currentLogs = [];
        }
        groups.push({ type: 'event', data: event, id: event.id });
      }
    });

    if (currentLogs.length > 0) {
      groups.push({
        type: 'logs',
        data: [...currentLogs],
        id: `logs-${currentLogs[0].id}`
      });
    }

    return groups;
  }, [events]);

  return (
    <div className={cn("flex flex-col h-full bg-cafe-950 overflow-hidden", className)}>
      {/* Timeline with left connecting line */}
      <div className="flex-1 overflow-auto p-6 space-y-6 relative">
        {/* Vertical connecting line */}
        <div className="absolute left-6 top-6 bottom-6 w-px bg-cafe-800/50" />

        {events.length === 0 && (
          <div className="text-center text-cafe-500 py-10">
            No timeline events recorded yet.
          </div>
        )}

        {groupedEvents.map((group, idx) => {
          if (group.type === 'event') {
            const event = group.data as TimelineEvent;
            return <TimelineEventItem key={group.id} event={event} index={idx} locale={i18n.language} />;
          } else {
            const logs = group.data as TimelineEvent[];
            return <LogGroup key={group.id} logs={logs} locale={i18n.language} />;
          }
        })}
      </div>
    </div>
  );
}

function TimelineEventItem({ event, index = 0, locale }: { event: TimelineEvent; index?: number; locale: string }) {
  const getIcon = () => {
    switch (event.type) {
      case 'stage_start': return <Play className="w-3.5 h-3.5" />;
      case 'stage_complete': return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'stage_fail': return <XCircle className="w-3.5 h-3.5" />;
      case 'input': return <MessageSquare className="w-3.5 h-3.5" />;
      case 'system': return <Terminal className="w-3.5 h-3.5" />;
      default: return <Circle className="w-3.5 h-3.5" />;
    }
  };

  const getIconStyle = () => {
    switch (event.type) {
      case 'stage_fail': return 'bg-red-900/20 border-red-500/50 text-red-400';
      case 'input': return 'bg-yellow-900/20 border-yellow-500/50 text-yellow-400';
      case 'stage_start': return 'bg-blue-900/20 border-blue-500/50 text-blue-400';
      case 'stage_complete': return 'bg-emerald-900/20 border-emerald-500/50 text-emerald-400';
      default: return 'bg-cafe-900 border-cafe-700 text-cafe-500';
    }
  };

  const getContentStyle = () => {
    switch (event.type) {
      case 'stage_fail': return 'bg-red-950/10 border-red-900/20 text-red-100';
      case 'input': return 'bg-yellow-950/10 border-yellow-900/20 text-yellow-100 italic';
      case 'stage_start': return 'bg-blue-950/10 border-blue-900/20 text-blue-100';
      case 'stage_complete': return 'bg-emerald-950/10 border-emerald-900/20 text-emerald-100';
      default: return 'bg-cafe-900 border-cafe-800 text-cafe-400';
    }
  };

  const getLabelStyle = () => {
    switch (event.type) {
      case 'stage_fail': return 'text-red-400';
      case 'input': return 'text-yellow-400';
      case 'stage_start': return 'text-blue-400';
      case 'stage_complete': return 'text-emerald-400';
      default: return 'text-cafe-500';
    }
  };

  return (
    <div
      className="relative flex gap-4 animate-in fade-in slide-in-from-left-2"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Icon */}
      <div className="relative z-10 shrink-0">
        <div className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center border-2 shadow-lg',
          getIconStyle()
        )}>
          {getIcon()}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 pt-1">
        <div className="flex justify-between items-baseline mb-1">
          <span className={cn('text-xs font-bold uppercase tracking-wider', getLabelStyle())}>
            {event.type.replace('_', ' ')}
          </span>
          <span className="text-[10px] font-mono text-cafe-600">{formatTime(event.timestamp, locale)}</span>
        </div>

        <div className={cn('p-3 rounded-lg border text-sm', getContentStyle())}>
          {event.stageName && (
            <span className="font-bold mr-2">{event.stageName}:</span>
          )}
          {event.content}
        </div>
      </div>
    </div>
  );
}

function LogGroup({ logs, locale }: { logs: TimelineEvent[]; locale: string }) {
  const [expanded, setExpanded] = useState(false);
  const previewCount = 3;
  const hasMore = logs.length > previewCount;

  return (
    <div className="ml-12 pl-4 border-l-2 border-cafe-800 space-y-1">
      {/* Preview logs */}
      {(expanded ? logs : logs.slice(0, previewCount)).map(log => (
        <div key={log.id} className="text-xs font-mono text-cafe-400 flex gap-2 hover:bg-cafe-800/50 rounded px-2 py-0.5">
          <span className="text-cafe-600 shrink-0 select-none">{formatTime(log.timestamp, locale)}</span>
          <span className="break-all whitespace-pre-wrap">{log.content}</span>
        </div>
      ))}

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-brand hover:underline flex items-center gap-1 mt-1 px-2"
        >
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {expanded ? 'Show less' : `Show ${logs.length - previewCount} more lines...`}
        </button>
      )}
    </div>
  );
}
