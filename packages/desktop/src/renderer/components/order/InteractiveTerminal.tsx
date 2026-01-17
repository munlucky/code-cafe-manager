/**
 * Interactive Terminal Component
 * 오더의 터미널 출력을 표시하고 사용자 입력을 받는 컴포넌트
 */

import { useEffect, useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { Send, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '../ui/Button';
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
}

/**
 * ANSI escape 코드 제거
 * 터미널 색상, 커서 제어 등의 코드를 strip
 */
function stripAnsi(text: string): string {
  // ANSI escape 코드 패턴들
  // - CSI sequences: ESC[ ... 또는 \x1b[ ...
  // - OSC sequences: ESC] ... ST (terminated by BEL or ESC)
  // - Other escape sequences
  // 참고: 모든 ANSI escape sequence는 \x1b (ESC)로 시작해야 함
  const ansiPattern = /\x1b\[[0-9;]*[a-zA-Z]|\x1b\][^\x07\x1b]*[\x07\x1b]|\x1b[PX^_][^\x1b]*\x1b\\|\x1b[@-Z\\-_]/g;
  return text.replace(ansiPattern, '');
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
  // 중복 검사를 위한 Set (타임스탬프+내용 기반)
  const seenKeysRef = useRef<Set<string>>(new Set());

  // 중복 없이 로그 추가
  const addOutputEvent = useCallback((event: OrderOutputEvent) => {
    const key = getLogKey(event);
    if (seenKeysRef.current.has(key)) {
      return; // 중복 무시
    }
    seenKeysRef.current.add(key);

    // ANSI escape 코드 제거
    const cleanedEvent: OrderOutputEvent = {
      ...event,
      content: stripAnsi(event.content),
    };

    // 빈 내용 필터링
    if (!cleanedEvent.content.trim()) {
      return;
    }

    setOutput((prev) => [...prev, cleanedEvent]);
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

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
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
    <div className={cn('flex flex-col h-full bg-background border border-border rounded', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-bone/5">
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-500')} />
          <span className="text-sm text-gray-500">
            Order: <span className="text-bone font-medium">{orderId.slice(0, 20)}...</span>
          </span>
        </div>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={cn(
            'text-xs px-2 py-1 rounded transition-colors',
            autoScroll
              ? 'bg-coffee text-white hover:bg-coffee/80'
              : 'bg-border text-gray-400 hover:bg-border/80'
          )}
        >
          {autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
        </button>
      </div>

      {/* Output */}
      <div
        ref={outputRef}
        className="flex-1 overflow-auto bg-gray-900 text-white p-4 font-mono text-xs leading-relaxed"
      >
        {loading && (
          <div className="text-gray-500">Connecting to terminal...</div>
        )}
        {!loading && output.length === 0 && (
          <div className="text-gray-500">Waiting for output...</div>
        )}
        {output.map((e, i) => (
          <div key={i} className="mb-0.5 whitespace-pre-wrap break-all">
            <span className="text-gray-600">[{formatTimestamp(e.timestamp)}]</span>
            {e.type !== 'stdout' && (
              <span className={cn('ml-1', getTypeColor(e.type))}>{getTypePrefix(e.type)}</span>
            )}
            <span className={cn('ml-1', getTypeColor(e.type))}>{e.content}</span>
          </div>
        ))}
      </div>

      {/* Input Area */}
      {isRunning && onSendInput && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-gray-800">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <ArrowUp className="w-3 h-3" />
            <ArrowDown className="w-3 h-3" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message to the AI agent..."
            className="flex-1 px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-coffee"
            disabled={sending}
          />
          <Button
            onClick={handleSendInput}
            disabled={!inputValue.trim() || sending}
            size="sm"
            className="flex items-center gap-1"
          >
            <Send className="w-3 h-3" />
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-1.5 border-t border-border bg-bone/5 text-xs text-gray-500 flex justify-between">
        <span>{output.length} lines</span>
        {inputHistory.length > 0 && (
          <span>{inputHistory.length} in history</span>
        )}
      </div>
    </div>
  );
}
