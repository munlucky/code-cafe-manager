/**
 * Terminal Output Panel Component
 * 개별 오더의 터미널 출력을 표시하는 패널
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Ansi from 'ansi-to-html';

// Security: Conditional logging - only in development mode
const isDev = process.env.NODE_ENV === 'development';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const devLog: (...args: any[]) => void = isDev ? console.log.bind(console) : () => {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const devError: (...args: any[]) => void = isDev ? console.error.bind(console) : () => {};

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
 * 출력 상태 타입
 */
type OutputStatus = 'initializing' | 'ready' | 'running' | 'completed' | 'failed';

/**
 * Strip ANSI escape codes from text
 */
function stripAnsiCodes(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
}

export function TerminalOutputPanel({ orderId }: TerminalOutputPanelProps): JSX.Element {
  const { i18n } = useTranslation();
  const [output, setOutput] = useState<OrderOutputEvent[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<OutputStatus>('initializing');
  const [lastReceivedAt, setLastReceivedAt] = useState<Date | null>(null);
  const outputRef = useRef<HTMLPreElement>(null);
  const logCounterRef = useRef(0);
  const lastLogTimeRef = useRef(0);

  // 출력 이벤트 핸들러 (useCallback으로 안정적인 참조 유지)
  const handleOutput = useCallback((event: OrderOutputEvent) => {
    if (event.orderId === orderId) {
      const now = Date.now();
      logCounterRef.current++;

      // 수신 로깅: 50번째마다 또는 5초 이상 간격 시
      const shouldLog = logCounterRef.current % 50 === 0 ||
        (now - lastLogTimeRef.current > 5000 && logCounterRef.current > 0);

      if (shouldLog) {
        devLog(`[TerminalOutputPanel] Received ${logCounterRef.current} chunks for order ${orderId}`);
        lastLogTimeRef.current = now;
      }

      // 상태 업데이트
      setLastReceivedAt(new Date(event.timestamp));
      setStatus('running');
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
      setStatus('initializing');
      logCounterRef.current = 0;
      lastLogTimeRef.current = 0;

      // 구독 시작
      const result = await window.codecafe.order.subscribeOutput(orderId);

      if (!isMounted || cleanupCalled) return;

      if (result.success) {
        const history = result.data?.history || [];
        if (history.length > 0) {
          setOutput(history as OrderOutputEvent[]);
        }
        devLog('[TerminalOutputPanel] Subscribed to order:', orderId);
        setLoading(false);
        setStatus('ready');
      } else {
        devError('[TerminalOutputPanel] Failed to subscribe:', result.error);
        setLoading(false);
        setStatus('ready'); // 실패해도 ready로 표시 (error 표시는 별도)
      }
    };

    // 비동기 구독
    subscribe();

    // 출력 이벤트 리스너
    const cleanupListener = window.codecafe.order.onOutput(handleOutput);

    // 완료/실패 이벤트 리스너
    const handleCompleted = (data: any) => {
      if (data.orderId === orderId) {
        devLog('[TerminalOutputPanel] Order completed:', orderId);
        setStatus('completed');
      }
    };

    const handleFailed = (data: any) => {
      if (data.orderId === orderId) {
        devError('[TerminalOutputPanel] Order failed:', orderId, data.error);
        setStatus('failed');
      }
    };

    const cleanupCompleted = window.codecafe.order.onCompleted(handleCompleted);
    const cleanupFailed = window.codecafe.order.onFailed?.(handleFailed);

    return () => {
      cleanupCalled = true;
      // 구독 해제
      window.codecafe.order.unsubscribeOutput(orderId);
      if (cleanupListener) cleanupListener();
      if (cleanupCompleted) cleanupCompleted();
      if (cleanupFailed) cleanupFailed();
      devLog('[TerminalOutputPanel] Cleanup for order:', orderId);
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
    return date.toLocaleTimeString(i18n.language, {
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
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            Order: <span className="text-bone font-medium">{orderId}</span>
          </div>
          {/* 상태 표시 */}
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded ${
              status === 'initializing' ? 'bg-yellow-500/20 text-yellow-400' :
              status === 'running' ? 'bg-green-500/20 text-green-400' :
              status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
              status === 'failed' ? 'bg-red-500/20 text-red-400' :
              'bg-gray-500/20 text-gray-400'
            }`}>
              {status === 'initializing' ? 'Initializing...' :
               status === 'running' ? 'Running' :
               status === 'completed' ? 'Completed' :
               status === 'failed' ? 'Failed' :
               'Ready'}
            </span>
          </div>
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
      <div className="px-4 py-2 border-t border-border bg-bone/5 text-xs text-gray-500 flex justify-between">
        <span>{output.length} lines</span>
        {lastReceivedAt && (
          <span>Last received: {formatTimestamp(lastReceivedAt.toISOString())}</span>
        )}
      </div>
    </div>
  );
}
