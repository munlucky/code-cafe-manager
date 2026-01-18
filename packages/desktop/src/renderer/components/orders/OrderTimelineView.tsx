import { type ReactElement, useState, useMemo } from 'react';
import { 
  CheckCircle, 
  Circle, 
  XCircle, 
  Terminal, 
  Clock, 
  MessageSquare, 
  Play, 
  ChevronDown, 
  ChevronRight, 
  AlertTriangle 
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

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString('ko-KR', { 
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
    <div className={cn("flex flex-col h-full bg-gray-900 overflow-hidden", className)}>
       {/* Header is handled by container */}
       
       <div className="flex-1 overflow-auto p-4 space-y-4">
          {events.length === 0 && (
            <div className="text-center text-gray-500 py-10">
              No timeline events recorded yet.
            </div>
          )}

          {groupedEvents.map((group) => {
            if (group.type === 'event') {
              const event = group.data as TimelineEvent;
              return <TimelineEventItem key={group.id} event={event} />;
            } else {
               const logs = group.data as TimelineEvent[];
               return <LogGroup key={group.id} logs={logs} />;
            }
          })}
       </div>
    </div>
  );
}

function TimelineEventItem({ event }: { event: TimelineEvent }) {
  const getIcon = () => {
    switch (event.type) {
      case 'stage_start': return <Play className="w-4 h-4 text-blue-400" />;
      case 'stage_complete': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'stage_fail': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'input': return <MessageSquare className="w-4 h-4 text-yellow-400" />;
      case 'system': return <Terminal className="w-4 h-4 text-gray-400" />;
      default: return <Circle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getBgColor = () => {
    switch (event.type) {
       case 'stage_fail': return 'bg-red-500/10 border-red-500/30';
       case 'input': return 'bg-yellow-500/10 border-yellow-500/30';
       case 'stage_start': return 'bg-blue-500/10 border-blue-500/30';
       case 'stage_complete': return 'bg-green-500/10 border-green-500/30';
       default: return 'bg-gray-800 border-gray-700';
    }
  };

  return (
    <div className={cn("flex gap-3 p-3 rounded-lg border", getBgColor())}>
       <div className="mt-0.5">{getIcon()}</div>
       <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start">
             <span className="text-sm font-medium text-bone">
                {event.stageName ? `${event.stageName}: ` : ''}{event.type.replace('_', ' ').toUpperCase()}
             </span>
             <span className="text-xs text-gray-500 font-mono ml-2 shrink-0">
                {formatTime(event.timestamp)}
             </span>
          </div>
          <div className="text-xs text-gray-300 mt-1 whitespace-pre-wrap">
             {event.content}
          </div>
       </div>
    </div>
  );
}

function LogGroup({ logs }: { logs: TimelineEvent[] }) {
  const [expanded, setExpanded] = useState(false);
  const previewCount = 3;
  const hasMore = logs.length > previewCount;

  return (
    <div className="ml-2 pl-4 border-l-2 border-gray-800 space-y-1">
       {/* Preview logs */}
       {(expanded ? logs : logs.slice(0, previewCount)).map(log => (
         <div key={log.id} className="text-xs font-mono text-gray-400 flex gap-2 hover:bg-gray-800/50 rounded px-1">
           <span className="text-gray-600 shrink-0 select-none">{formatTime(log.timestamp)}</span>
           <span className="break-all whitespace-pre-wrap">{log.content}</span>
         </div>
       ))}
       
       {hasMore && (
         <button 
           onClick={() => setExpanded(!expanded)}
           className="text-xs text-coffee hover:underline flex items-center gap-1 mt-1 px-1"
         >
           {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
           {expanded ? 'Show less' : `Show ${logs.length - previewCount} more lines...`}
         </button>
       )}
    </div>
  );
}
