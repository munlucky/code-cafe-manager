import React, { useRef, useEffect, useState } from 'react';
import { Terminal as TerminalIcon, ArrowRight, Sparkles, MessageSquare } from 'lucide-react';
import { Order, OrderStatus, WorkflowLog } from '../types';

interface InteractiveTerminalProps {
  order: Order;
  onSendInput: (input: string) => void;
}

export const InteractiveTerminal: React.FC<InteractiveTerminalProps> = ({ order, onSendInput }) => {
  const [inputBuffer, setInputBuffer] = useState('');
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic
  useEffect(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      // Scroll if already at bottom or if it's a new order load
      const isAtBottom = scrollHeight - scrollTop === clientHeight;
      
      if (isAtBottom || order.logs.length < 5) {
         terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [order.logs.length, order.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputBuffer.trim()) return;
    onSendInput(inputBuffer);
    setInputBuffer('');
  };

  return (
    <div className="flex flex-col h-full bg-terminal-bg font-mono text-sm relative rounded-xl overflow-hidden border border-cafe-800 shadow-inner">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-cafe-900 border-b border-cafe-800">
        <div className="flex items-center text-cafe-400 text-xs">
          <TerminalIcon className="w-3.5 h-3.5 mr-2" />
          <span>Console Output</span>
        </div>
        <div className="flex gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50"></div>
        </div>
      </div>

      {/* Logs Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 terminal-scroll">
        {/* Welcome Message */}
        <div className="mb-6 pb-4 border-b border-cafe-800/30 text-cafe-500/60 text-xs">
            <div className="flex items-center mb-1">
                <Sparkles className="w-3 h-3 mr-2 text-brand" />
                BaristaEngine v2.0.1 Initialized
            </div>
            <div>Target: {order.worktreeInfo ? order.worktreeInfo.path : 'Local Main'}</div>
        </div>

        <div className="space-y-1">
            {order.logs.map((log) => (
                <div key={log.id} className="flex group items-start hover:bg-white/5 px-2 py-0.5 rounded -mx-2 transition-colors">
                    <span className="text-cafe-700 text-[10px] w-14 shrink-0 select-none pt-0.5 tracking-tighter opacity-50 font-sans">
                        {log.timestamp}
                    </span>
                    <div className={`flex-1 break-all whitespace-pre-wrap leading-relaxed ${
                        log.type === 'error' || log.type === 'stage_fail' ? 'text-red-400' :
                        log.type === 'success' || log.type === 'stage_complete' ? 'text-emerald-400' :
                        log.type === 'system' ? 'text-blue-400' :
                        log.type === 'stage_start' ? 'text-brand font-bold' :
                        log.type === 'ai' ? 'text-cafe-200' :
                        log.type === 'input' ? 'text-yellow-400 italic' :
                        'text-cafe-400'
                    }`}>
                        {log.type === 'stage_start' && <span className="mr-2 text-brand">▶</span>}
                        {log.type === 'input' && <span className="mr-2 text-yellow-500">➜</span>}
                        {log.type === 'ai' && <span className="mr-2 text-brand">🤖</span>}
                        {log.content}
                    </div>
                </div>
            ))}
            {/* Thinking Indicator */}
            {order.status === OrderStatus.RUNNING && (
                <div className="flex items-center text-cafe-600 mt-2 pl-16 animate-pulse">
                    <span className="w-1.5 h-3 bg-brand block mr-2"></span>
                    <span className="text-xs">Processing...</span>
                </div>
            )}
            <div ref={terminalEndRef} />
        </div>
      </div>

      {/* Input Area (Only when needed or running) */}
      {(order.status === OrderStatus.WAITING_INPUT || order.status === OrderStatus.RUNNING) && (
        <div className={`
            border-t border-cafe-800 p-3 transition-colors duration-300
            ${order.status === OrderStatus.WAITING_INPUT ? 'bg-brand/10 border-brand/30' : 'bg-cafe-900'}
        `}>
          {order.status === OrderStatus.WAITING_INPUT && (
             <div className="flex items-center mb-2 text-brand-light text-xs font-bold animate-pulse">
                 <MessageSquare className="w-3 h-3 mr-1.5" />
                 Input Required
             </div>
          )}
          <form onSubmit={handleSubmit} className="relative flex items-center">
            <span className="text-brand mr-2 font-bold">❯</span>
            <input
              autoFocus
              type="text"
              value={inputBuffer}
              onChange={(e) => setInputBuffer(e.target.value)}
              placeholder="Type command or response..."
              className="flex-1 bg-transparent border-none text-cafe-100 focus:ring-0 outline-none placeholder-cafe-700"
            />
            <button 
              type="submit"
              disabled={!inputBuffer.trim()}
              className="p-1.5 bg-cafe-800 hover:bg-brand text-cafe-400 hover:text-white rounded transition-colors disabled:opacity-50"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};