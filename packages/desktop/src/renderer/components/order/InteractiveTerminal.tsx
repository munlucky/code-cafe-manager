/**
 * Interactive Terminal Component
 * 오더의 터미널 출력을 표시하고 사용자 입력을 받는 컴포넌트
 *
 * Design: cafe 테마 기반의 터미널 UI
 */

import { useEffect, useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { Terminal as TerminalIcon, ArrowRight, Sparkles, MessageSquare, ArrowUp, ArrowDown, ChevronsDown } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { ParsedLogEntry } from '../../types/terminal';
import { parseTerminalOutput, generateId } from '../../utils/terminal-log-parser';
import { TerminalLogEntry } from '../terminal';
import { useSmartScroll } from '../../hooks/useSmartScroll';

interface OrderOutputEvent {
  orderId: string;
  timestamp: string;
  type: 'stdout' | 'stderr' | 'system' | 'user-input';
  content: string;
}

interface InteractiveTerminalProps {
  orderId: string;
  onSendInput?: (message: string) => Promise<void>;
  className?: string;
  isRunning?: boolean;
  isAwaitingInput?: boolean;
  worktreePath?: string;
  startedAt?: string | Date | null;
}

/**
 * 로그 항목 고유 키 생성 (중복 검사용)
 */
function getLogKey(event: OrderOutputEvent): string {
  return `${event.timestamp}:${event.content}`;
}

export function InteractiveTerminal({
  orderId,
  onSendInput,
  className,
  isRunning = true,
  isAwaitingInput = false,
  worktreePath,
  startedAt,
}: InteractiveTerminalProps): JSX.Element {
  const [entries, setEntries] = useState<ParsedLogEntry[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // 중복 검사를 위한 Set (타임스탬프+내용 기반)
  const seenKeysRef = useRef<Set<string>>(new Set());

  // Smart scroll hook
  const { containerRef, endRef, isAtBottom, scrollToBottom } = useSmartScroll({
    threshold: 100,
  });

  // 중복 없이 로그 추가 (ParsedLogEntry로 변환)
  const addOutputEvent = useCallback((event: OrderOutputEvent) => {
    const key = getLogKey(event);
    if (seenKeysRef.current.has(key)) {
      return; // 중복 무시
    }
    seenKeysRef.current.add(key);

    // 빈 내용 필터링
    if (!event.content.trim()) {
      return;
    }

    // Parse raw content into structured ParsedLogEntry
    const parsedEntry = parseTerminalOutput(event.content);

    // Override type based on event type for better badge display
    if (event.type === 'stderr') {
      parsedEntry.type = 'system';
    } else if (event.type === 'user-input') {
      parsedEntry.type = 'user';
    }

    // Use event timestamp for consistency
    parsedEntry.timestamp = event.timestamp;

    setEntries((prev) => [...prev, parsedEntry]);
  }, []);

  useEffect(() => {
    let isActive = true;
    setLoading(true);
    setEntries([]);
    seenKeysRef.current.clear();

    // 출력 이벤트 리스너
    const cleanup = window.codecafe.order.onOutput((event: OrderOutputEvent) => {
      if (event.orderId === orderId) {
        addOutputEvent(event);
      }
    });

    // 구독 시작 (히스토리 포함)
    window.codecafe.order.subscribeOutput(orderId).then((result) => {
      if (!isActive) return;
      if (result.success) {
        const history = result.data?.history || [];
        if (history.length > 0) {
          history.forEach((event) => addOutputEvent(event as OrderOutputEvent));
        }
        console.log('[InteractiveTerminal] Subscribed to order:', orderId);
      } else {
        console.error('[InteractiveTerminal] Failed to subscribe:', result.error);
      }
      setLoading(false);
    });

    return () => {
      isActive = false;
      window.codecafe.order.unsubscribeOutput(orderId);
      if (cleanup) cleanup();
    };
  }, [orderId, addOutputEvent]);

  useEffect(() => {
    const startMs = startedAt ? new Date(startedAt).getTime() : NaN;
    if (!isRunning || !startedAt || Number.isNaN(startMs)) {
      setElapsedMs(null);
      return;
    }

    const tick = () => setElapsedMs(Date.now() - startMs);
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [isRunning, startedAt]);

  const formatElapsed = (ms: number): string => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
    }
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  };

  const handleSendInput = async () => {
    if (!inputValue.trim() || !onSendInput || sending) return;

    const message = inputValue.trim();
    setInputValue('');
    setHistoryIndex(-1);

    // 히스토리에 추가
    setInputHistory((prev) => [message, ...prev.slice(0, 49)]);

    // 로컬 출력에 추가 (ParsedLogEntry로 생성)
    const userEntry: ParsedLogEntry = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      type: 'user',
      content: message,
      isCollapsible: false,
    };
    setEntries((prev) => [...prev, userEntry]);

    setSending(true);
    try {
      await onSendInput(message);
    } catch (error) {
      console.error('[InteractiveTerminal] Failed to send input:', error);
      const errorEntry: ParsedLogEntry = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        type: 'system',
        content: `Failed to send: ${error instanceof Error ? error.message : String(error)}`,
        isCollapsible: false,
      };
      setEntries((prev) => [...prev, errorEntry]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendInput();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (inputHistory.length > 0) {
        const newIndex = Math.min(historyIndex + 1, inputHistory.length - 1);
        setHistoryIndex(newIndex);
        setInputValue(inputHistory[newIndex] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInputValue(inputHistory[newIndex] || '');
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputValue('');
      }
    }
  };

  return (
    <div className={cn('flex flex-col h-full bg-terminal-bg font-mono text-sm relative rounded-xl overflow-hidden border border-cafe-800 shadow-inner', className)}>
      {/* Terminal Header - macOS style */}
      <div className="flex items-center justify-between px-4 py-2 bg-cafe-900 border-b border-cafe-800">
        <div className="flex items-center text-cafe-400 text-xs">
          <TerminalIcon className="w-3.5 h-3.5 mr-2" />
          <span>Console Output</span>
          {isRunning && (
            <div className="flex items-center gap-2 ml-3">
              <span className="text-[10px] px-2 py-0.5 rounded bg-brand/20 text-brand border border-brand/30">
                RUNNING
              </span>
              {elapsedMs !== null && (
                <span className="text-[10px] font-mono text-cafe-500">
                  {formatElapsed(elapsedMs)}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50"></div>
          </div>
        </div>
      </div>

      {/* Logs Area */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4 terminal-scroll relative">
        {/* Welcome Message */}
        <div className="mb-6 pb-4 border-b border-cafe-800/30 text-cafe-500/60 text-xs">
          <div className="flex items-center mb-1">
            <Sparkles className="w-3 h-3 mr-2 text-brand" />
            BaristaEngine v2.0.1 Initialized
          </div>
          <div>Target: {worktreePath || 'Local Main'}</div>
        </div>

        {loading && (
          <div className="text-cafe-600 animate-pulse">Connecting to terminal...</div>
        )}
        {!loading && entries.length === 0 && (
          <div className="text-cafe-600">Waiting for output...</div>
        )}

        <div className="space-y-0.5">
          {entries.map((entry) => (
            <TerminalLogEntry key={entry.id} entry={entry} />
          ))}
          {/* Thinking Indicator */}
          {isRunning && entries.length > 0 && (
            <div className="flex items-center text-cafe-600 mt-2 pl-16 animate-pulse">
              <span className="w-1.5 h-3 bg-brand block mr-2"></span>
              <span className="text-xs">Processing...</span>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {/* Scroll to Bottom Button */}
      {!isAtBottom && (
        <button
          onClick={scrollToBottom}
          className={cn(
            'absolute bottom-24 right-4 z-10',
            'flex items-center gap-1 px-3 py-1.5 rounded-full',
            'bg-cafe-800/90 hover:bg-cafe-700 border border-cafe-600',
            'text-cafe-300 text-xs shadow-lg transition-all',
            'backdrop-blur-sm'
          )}
        >
          <ChevronsDown className="w-3.5 h-3.5" />
          <span>Scroll to bottom</span>
        </button>
      )}

      {/* Input Area - Highlight when awaiting input */}
      {(isAwaitingInput || isRunning) && onSendInput && (
        <div className={cn(
          'border-t border-cafe-800 p-3 transition-colors duration-300',
          isAwaitingInput ? 'bg-brand/10 border-brand/30' : 'bg-cafe-900'
        )}>
          {isAwaitingInput && (
            <div className="flex items-center mb-2 text-brand-light text-xs font-bold animate-pulse">
              <MessageSquare className="w-3 h-3 mr-1.5" />
              Input Required
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); handleSendInput(); }} className="relative flex items-center">
            <span className="text-brand mr-2 font-bold">❯</span>
            <input
              ref={inputRef}
              autoFocus={isAwaitingInput}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type command or response..."
              className="flex-1 bg-transparent border-none text-cafe-100 focus:ring-0 outline-none placeholder-cafe-700"
              disabled={sending}
            />
            <div className="flex items-center gap-2 text-cafe-600 mr-2">
              <ArrowUp className="w-3 h-3" />
              <ArrowDown className="w-3 h-3" />
            </div>
            <button
              type="submit"
              disabled={!inputValue.trim() || sending}
              className="p-1.5 bg-cafe-800 hover:bg-brand text-cafe-400 hover:text-white rounded transition-colors disabled:opacity-50"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-1.5 border-t border-cafe-800 bg-cafe-900/50 text-[10px] text-cafe-600 flex justify-between">
        <span>{entries.length} entries</span>
        {inputHistory.length > 0 && (
          <span>{inputHistory.length} in history</span>
        )}
      </div>
    </div>
  );
}
