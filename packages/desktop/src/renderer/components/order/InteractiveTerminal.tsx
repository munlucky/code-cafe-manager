/**
 * Interactive Terminal Component
 * 오더의 터미널 출력을 표시하고 사용자 입력을 받는 컴포넌트
 *
 * Design: cafe 테마 기반의 터미널 UI
 */

import { useEffect, useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { Terminal as TerminalIcon, ArrowRight, Sparkles, MessageSquare, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '../../utils/cn';

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
}: InteractiveTerminalProps): JSX.Element {
  const [output, setOutput] = useState<OrderOutputEvent[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [autoScroll, setAutoScroll] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  // 중복 검사를 위한 Set (타임스탬프+내용 기반)
  const seenKeysRef = useRef<Set<string>>(new Set());

  // 중복 없이 로그 추가
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

    // content는 이미 execution-manager에서 ANSI를 HTML로 변환함
    setOutput((prev) => [...prev, event]);
  }, []);

  useEffect(() => {
    setLoading(true);
    setOutput([]);
    seenKeysRef.current.clear();

    // 구독 시작
    window.codecafe.order.subscribeOutput(orderId).then((result: any) => {
      if (result.success) {
        console.log('[InteractiveTerminal] Subscribed to order:', orderId);
        setLoading(false);
      } else {
        console.error('[InteractiveTerminal] Failed to subscribe:', result.error);
        setLoading(false);
      }
    });

    // 출력 이벤트 리스너
    const cleanup = window.codecafe.order.onOutput((event: OrderOutputEvent) => {
      if (event.orderId === orderId) {
        addOutputEvent(event);
      }
    });

    return () => {
      window.codecafe.order.unsubscribeOutput(orderId);
      if (cleanup) cleanup();
    };
  }, [orderId, addOutputEvent]);

  // Auto-scroll - smooth scroll to terminal end
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [output, autoScroll]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ko-KR', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'stderr':
        return 'text-red-400';
      case 'system':
        return 'text-blue-400';
      case 'user-input':
        return 'text-yellow-400';
      default:
        return 'text-gray-300';
    }
  };

  const getTypePrefix = (type: string) => {
    switch (type) {
      case 'stderr':
        return '[ERR]';
      case 'system':
        return '[SYS]';
      case 'user-input':
        return '[YOU]';
      default:
        return '';
    }
  };

  const handleSendInput = async () => {
    if (!inputValue.trim() || !onSendInput || sending) return;

    const message = inputValue.trim();
    setInputValue('');
    setHistoryIndex(-1);

    // 히스토리에 추가
    setInputHistory((prev) => [message, ...prev.slice(0, 49)]);

    // 로컬 출력에 추가
    setOutput((prev) => [
      ...prev,
      {
        orderId,
        timestamp: new Date().toISOString(),
        type: 'user-input',
        content: message,
      },
    ]);

    setSending(true);
    try {
      await onSendInput(message);
    } catch (error) {
      console.error('[InteractiveTerminal] Failed to send input:', error);
      setOutput((prev) => [
        ...prev,
        {
          orderId,
          timestamp: new Date().toISOString(),
          type: 'stderr',
          content: `Failed to send: ${error instanceof Error ? error.message : String(error)}`,
        },
      ]);
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
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={cn(
              'text-[10px] px-2 py-0.5 rounded transition-colors',
              autoScroll
                ? 'bg-brand/20 text-brand border border-brand/30'
                : 'bg-cafe-800 text-cafe-500 border border-cafe-700'
            )}
          >
            {autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
          </button>
          <div className="flex gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50"></div>
          </div>
        </div>
      </div>

      {/* Logs Area */}
      <div ref={outputRef} className="flex-1 overflow-y-auto p-4 terminal-scroll">
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
        {!loading && output.length === 0 && (
          <div className="text-cafe-600">Waiting for output...</div>
        )}

        <div className="space-y-1">
          {output.map((e, i) => (
            <div key={i} className="flex group items-start hover:bg-white/5 px-2 py-0.5 rounded -mx-2 transition-colors">
              <span className="text-cafe-700 text-[10px] w-14 shrink-0 select-none pt-0.5 tracking-tighter opacity-50 font-sans">
                {formatTimestamp(e.timestamp)}
              </span>
              <div className={cn(
                'flex-1 break-all whitespace-pre-wrap leading-relaxed',
                e.type === 'stderr' ? 'text-red-400' :
                e.type === 'system' ? 'text-blue-400' :
                e.type === 'user-input' ? 'text-yellow-400 italic' :
                'text-cafe-400'
              )}>
                {e.type === 'user-input' && <span className="mr-2 text-yellow-500">➜</span>}
                {e.type === 'system' && <span className="mr-2 text-blue-400">🤖</span>}
                {/* Render HTML content (ANSI colors converted by execution-manager) */}
                <span dangerouslySetInnerHTML={{ __html: e.content }} />
              </div>
            </div>
          ))}
          {/* Thinking Indicator */}
          {isRunning && output.length > 0 && (
            <div className="flex items-center text-cafe-600 mt-2 pl-16 animate-pulse">
              <span className="w-1.5 h-3 bg-brand block mr-2"></span>
              <span className="text-xs">Processing...</span>
            </div>
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>

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
        <span>{output.length} lines</span>
        {inputHistory.length > 0 && (
          <span>{inputHistory.length} in history</span>
        )}
      </div>
    </div>
  );
}
