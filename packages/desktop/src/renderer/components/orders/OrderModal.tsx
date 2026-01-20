import { type ReactElement, useState, useEffect, useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X, List, Activity } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button } from '../ui/Button';
import { OrderSummaryView } from './OrderSummaryView';
import { OrderTimelineView, type TimelineEvent } from './OrderTimelineView';
import type { Order } from '../../types/models';
import { OrderStatus } from '../../types/models';
import type { StageInfo } from '../order/OrderStageProgress';

interface OrderModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  stages: StageInfo[];
  timelineEvents: TimelineEvent[];
  // Actions
  onSendInput?: (message: string) => void;
  activeTab?: 'summary' | 'timeline';
  onTabChange?: (tab: 'summary' | 'timeline') => void;
}

type TabType = 'summary' | 'timeline';

interface OutputLine {
  timestamp: string;
  type: 'stdout' | 'stderr' | 'system';
  content: string;
}

export function OrderModal({
  order,
  isOpen,
  onClose,
  stages,
  timelineEvents,
  onSendInput,
  activeTab = 'summary',
  onTabChange,
}: OrderModalProps): ReactElement {
  const [internalTab, setInternalTab] = useState<TabType>('summary');
  const [outputLines, setOutputLines] = useState<OutputLine[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  
  const currentTab = onTabChange ? activeTab : internalTab;
  const handleTabChange = (tab: TabType) => {
    if (onTabChange) onTabChange(tab);
    else setInternalTab(tab);
  };

  // Wrap onSendInput with order status validation
  const handleSendInput = (message: string) => {
    if (order.status !== OrderStatus.RUNNING) {
      console.warn(`[OrderModal] Cannot send input: order ${order.id} is not running (status: ${order.status})`);
      return;
    }
    onSendInput?.(message);
  };

  // Load historical logs when modal opens
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // Load history only once per order
    if (historyLoaded === order.id) {
      return;
    }

    const loadHistory = async () => {
      try {
        const response = await window.codecafe.getOrderLog(order.id);
        if (response.success && response.data) {
          // Parse raw log text into output lines
          // Since logs are plain text, we'll treat each non-empty line as stdout
          const lines = response.data.split('\n').filter(line => line.trim());
          const parsedLines: OutputLine[] = lines.map((line, idx) => ({
            timestamp: new Date().toISOString(), // Logs don't have individual timestamps
            type: 'stdout' as const,
            content: line,
          }));
          setOutputLines(parsedLines);
        }
        setHistoryLoaded(order.id);
      } catch (error) {
        console.error('Failed to load order log:', error);
        setHistoryLoaded(order.id); // Mark as loaded even on error to avoid retry loops
      }
    };

    loadHistory();
  }, [isOpen, order.id, historyLoaded]);

  // Subscribe to real-time order:output events
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleOutput = (data: { orderId: string; timestamp: string; type: string; content: string }) => {
      if (data.orderId !== order.id) return;
      
      setOutputLines(prev => [...prev, {
        timestamp: data.timestamp,
        type: data.type as 'stdout' | 'stderr' | 'system',
        content: data.content,
      }]);
    };

    const cleanup = window.codecafe.order.onOutput(handleOutput);
    return () => cleanup?.();
  }, [isOpen, order.id]);

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [outputLines]);

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] duration-200",
            "w-[90vw] max-w-4xl h-[80vh] max-h-[800px]",
            "bg-cafe-950 border border-cafe-700 shadow-2xl rounded-2xl flex flex-col overflow-hidden"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-cafe-800 bg-cafe-900">
            <div>
              <DialogPrimitive.Title className="text-lg font-bold text-cafe-100 flex items-center gap-2">
                <Activity className="w-5 h-5 text-brand" />
                {order.workflowName}
                <span className="ml-3 text-xs font-normal text-cafe-500 font-mono bg-cafe-800 px-2 py-0.5 rounded">#{order.id.substring(0, 8)}</span>
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-cafe-500 font-mono mt-1">
                {order.id}
              </DialogPrimitive.Description>
            </div>
            <div className="flex items-center gap-4">
              {/* Tabs */}
              <div className="flex border-b border-cafe-800 bg-cafe-900/50">
                <button
                  onClick={() => handleTabChange('summary')}
                  className={cn(
                    "flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                    currentTab === 'summary'
                      ? "border-brand text-brand"
                      : "border-transparent text-cafe-400 hover:text-cafe-200"
                  )}
                >
                  <List className="w-4 h-4 mr-2" />
                  Console & Progress
                </button>
                <button
                  onClick={() => handleTabChange('timeline')}
                  className={cn(
                    "flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                    currentTab === 'timeline'
                      ? "border-brand text-brand"
                      : "border-transparent text-cafe-400 hover:text-cafe-200"
                  )}
                >
                  <Activity className="w-4 h-4 mr-2" />
                  Timeline Events
                </button>
              </div>

              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-cafe-400 hover:text-cafe-100">
                  <X className="w-5 h-5" />
                </Button>
              </DialogPrimitive.Close>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden bg-terminal-bg relative flex flex-col">
            {currentTab === 'summary' && (
              <>
                {/* Summary Section */}
                <div className="shrink-0 p-6 bg-cafe-900 border-b border-cafe-800">
                  <OrderSummaryView
                    stages={stages}
                    isRunning={order.status === OrderStatus.RUNNING}
                    awaitingInput={{ required: false }}
                    onSendInput={handleSendInput}
                  />
                </div>

                {/* Output Section at Bottom */}
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="px-4 py-2 border-b border-cafe-800 bg-cafe-900 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-brand" />
                    <span className="text-sm font-semibold text-cafe-200">Terminal Output</span>
                    {outputLines.length > 0 && (
                      <span className="text-xs bg-brand text-cafe-950 px-2 py-0.5 rounded-full">
                        {outputLines.length}
                      </span>
                    )}
                  </div>

                  {/* Output Display */}
                  <div
                    ref={outputRef}
                    className="flex-1 overflow-auto p-4 font-mono text-sm"
                  >
                    {outputLines.length === 0 ? (
                      <div className="text-cafe-600 italic">No output yet. Execute the order to see terminal output here.</div>
                    ) : (
                      outputLines.map((line, idx) => (
                        <div key={idx} className="whitespace-pre-wrap mb-1 hover:bg-white/5 px-2 py-0.5 rounded -mx-2">
                          <span className="text-cafe-700 text-[10px] mr-2">
                            {new Date(line.timestamp).toLocaleTimeString()}
                          </span>
                          <span
                            className={cn(
                              line.type === 'stderr' && 'text-red-400',
                              line.type === 'stdout' && 'text-cafe-300',
                              line.type === 'system' && 'text-blue-400'
                            )}
                            dangerouslySetInnerHTML={{ __html: line.content }}
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}

            {currentTab === 'timeline' && (
              <OrderTimelineView events={timelineEvents} className="h-full" />
            )}
          </div>

        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
