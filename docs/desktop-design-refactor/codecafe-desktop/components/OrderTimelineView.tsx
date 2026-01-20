import React from 'react';
import { WorkflowLog } from '../types';
import { Play, CheckCircle2, XCircle, MessageSquare, Terminal, Circle } from 'lucide-react';

interface OrderTimelineViewProps {
  logs: WorkflowLog[];
}

export const OrderTimelineView: React.FC<OrderTimelineViewProps> = ({ logs }) => {
  // Filter for significant events, or group standard logs
  const timelineEvents = logs.reduce((acc, log) => {
    const last = acc[acc.length - 1];
    
    // Group consecutive standard logs/info/ai into a single block to reduce noise
    if (['info', 'ai', 'system'].includes(log.type) && last && last.type === 'log_group') {
      last.count++;
      last.endTime = log.timestamp;
      return acc;
    } 
    
    if (['info', 'ai', 'system'].includes(log.type)) {
      acc.push({
        type: 'log_group',
        id: log.id,
        timestamp: log.timestamp,
        endTime: log.timestamp,
        count: 1,
        content: log.content
      });
    } else {
      // Significant events (stage_start, stage_complete, input, error) stand alone
      acc.push(log);
    }
    return acc;
  }, [] as any[]);

  return (
    <div className="p-6 space-y-6 relative">
      <div className="absolute left-6 top-6 bottom-6 w-px bg-cafe-800/50"></div>
      
      {timelineEvents.map((event, idx) => (
        <div key={event.id} className="relative flex gap-4 animate-in fade-in slide-in-from-left-2" style={{ animationDelay: `${idx * 50}ms` }}>
          {/* Icon */}
          <div className="relative z-10 shrink-0">
             <div className={`
               w-8 h-8 rounded-full flex items-center justify-center border-2 shadow-lg
               ${event.type === 'stage_start' ? 'bg-blue-900/20 border-blue-500/50 text-blue-400' :
                 event.type === 'stage_complete' ? 'bg-emerald-900/20 border-emerald-500/50 text-emerald-400' :
                 event.type === 'stage_fail' || event.type === 'error' ? 'bg-red-900/20 border-red-500/50 text-red-400' :
                 event.type === 'input' ? 'bg-yellow-900/20 border-yellow-500/50 text-yellow-400' :
                 'bg-cafe-900 border-cafe-700 text-cafe-500'}
             `}>
               {event.type === 'stage_start' && <Play className="w-3.5 h-3.5" />}
               {event.type === 'stage_complete' && <CheckCircle2 className="w-3.5 h-3.5" />}
               {event.type === 'stage_fail' || event.type === 'error' ? <XCircle className="w-3.5 h-3.5" /> : null}
               {event.type === 'input' && <MessageSquare className="w-3.5 h-3.5" />}
               {event.type === 'log_group' && <Terminal className="w-3.5 h-3.5" />}
             </div>
          </div>

          {/* Content */}
          <div className="flex-1 pt-1">
             <div className="flex justify-between items-baseline mb-1">
               <span className={`text-xs font-bold uppercase tracking-wider
                 ${event.type === 'stage_start' ? 'text-blue-400' :
                   event.type === 'stage_complete' ? 'text-emerald-400' :
                   event.type === 'stage_fail' || event.type === 'error' ? 'text-red-400' :
                   event.type === 'input' ? 'text-yellow-400' :
                   'text-cafe-500'}
               `}>
                 {event.type === 'log_group' ? 'Activity Log' : event.type.replace('_', ' ')}
               </span>
               <span className="text-[10px] font-mono text-cafe-600">{event.timestamp}</span>
             </div>
             
             <div className={`
               p-3 rounded-lg border text-sm
               ${event.type === 'stage_start' ? 'bg-blue-950/10 border-blue-900/20 text-blue-100' :
                 event.type === 'stage_complete' ? 'bg-emerald-950/10 border-emerald-900/20 text-emerald-100' :
                 event.type === 'stage_fail' ? 'bg-red-950/10 border-red-900/20 text-red-100' :
                 event.type === 'input' ? 'bg-yellow-950/10 border-yellow-900/20 text-yellow-100 italic' :
                 'bg-cafe-900 border-cafe-800 text-cafe-400'}
             `}>
               {event.type === 'log_group' ? (
                 <div className="flex items-center justify-between">
                   <span className="truncate">{event.content}</span>
                   {event.count > 1 && (
                     <span className="text-[10px] bg-cafe-800 px-2 py-0.5 rounded-full text-cafe-500 ml-2 whitespace-nowrap">
                       +{event.count - 1} entries
                     </span>
                   )}
                 </div>
               ) : (
                 event.content
               )}
             </div>
          </div>
        </div>
      ))}
    </div>
  );
};