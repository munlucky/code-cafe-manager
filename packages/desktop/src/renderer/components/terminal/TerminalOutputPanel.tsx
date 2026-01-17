/**
 * Terminal Output Panel Component
 * 개별 오더의 터미널 출력을 표시하는 패널
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import Ansi from 'ansi-to-html';

interface OrderOutputEvent {
  orderId: string;
  timestamp: string;
  type: 'stdout' | 'stderr' | 'system';
  content: string;
}

interface TerminalOutputPanelProps {
  orderId: string;
}

/**
 * Strip ANSI escape codes from text
 */
function stripAnsiCodes(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
}

export function TerminalOutputPanel({ orderId }: TerminalOutputPanelProps): JSX.Element {
  const [output, setOutput] = useState<OrderOutputEvent[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [loading, setLoading] = useState(true);
  const outputRef = useRef<HTMLPreElement>(null);

  // 출력 이벤트 핸들러 (useCallback으로 안정적인 참조 유지)
  const handleOutput = useCallback((event: OrderOutputEvent) => {
    if (event.orderId === orderId) {
      setOutput((prev) => [...prev, event]);
    }
  }, [orderId]);

  useEffect(() => {
    // 컴포넌트 마운트 상태 추적 (Strict Mode 대응)
    let isMounted = true;
    let cleanupCalled = false;

    const subscribe = async () => {
      if (!isMounted || cleanupCalled) return;

      setLoading(true);
      setOutput([]);

      // 구독 시작
      const result = await window.codecafe.order.subscribeOutput(orderId);

      if (!isMounted || cleanupCalled) return;

      if (result.success) {
        console.log('[TerminalOutputPanel] Subscribed to order:', orderId);
        setLoading(false);
      } else {
        console.error('[TerminalOutputPanel] Failed to subscribe:', result.error);
        setLoading(false);
      }
    };

    // 비동기 구독
    subscribe();

    // 출력 이벤트 리스너
    const cleanupListener = window.codecafe.order.onOutput(handleOutput);

    return () => {
      cleanupCalled = true;
      // 구독 해제
      window.codecafe.order.unsubscribeOutput(orderId);
      if (cleanupListener) cleanupListener();
      console.log('[TerminalOutputPanel] Cleanup for order:', orderId);
    };
  }, [orderId, handleOutput]);

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
      second: '2-digit'
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'stderr':
        return 'text-red-400';
      case 'system':
        return 'text-blue-400';
      default:
        return 'text-gray-300';
    }
  };

  return (
    <div className="flex flex-col h-full bg-background border border-border rounded">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-bone/5">
        <div className="text-sm text-gray-500">
          Order: <span className="text-bone font-medium">{orderId}</span>
        </div>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            autoScroll
              ? 'bg-coffee text-white hover:bg-coffee/80'
              : 'bg-border text-gray-400 hover:bg-border/80'
          }`}
        >
          {autoScroll ? '⏸ Pause' : '▶ Resume'} Auto-scroll
        </button>
      </div>

      {/* Output */}
      <pre
        ref={outputRef}
        className="flex-1 overflow-auto bg-gray-900 text-white p-4 font-mono text-xs leading-relaxed"
      >
        {loading && (
          <div className="text-gray-500">Connecting to order output stream...</div>
        )}
        {!loading && output.length === 0 && (
          <div className="text-gray-500">Waiting for output...</div>
        )}
        {output.map((e, i) => (
          <div key={i} className="mb-1">
            <span className="text-gray-600 mr-2">[{formatTimestamp(e.timestamp)}]</span>
            <span 
              className={getTypeColor(e.type)} 
              dangerouslySetInnerHTML={{ __html: e.content }}
            />
          </div>
        ))}
      </pre>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border bg-bone/5 text-xs text-gray-500">
        {output.length} lines
      </div>
    </div>
  );
}
