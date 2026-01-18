import { type ReactElement, useState, useEffect, useRef } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X, AlignLeft, List, Activity } from 'lucide-react';
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
            "bg-gray-900 border border-border shadow-2xl rounded-xl flex flex-col overflow-hidden"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gray-800">
            <div>
               <DialogPrimitive.Title className="text-lg font-bold text-bone flex items-center gap-2">
                 <Activity className="w-5 h-5 text-coffee" />
                 {order.workflowName}
               </DialogPrimitive.Title>
               <DialogPrimitive.Description className="text-sm text-gray-500 font-mono mt-1">
                 ID: {order.id}
               </DialogPrimitive.Description>
            </div>
            <div className="flex items-center gap-4">
               {/* Tabs */}
               <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700">
                  <button
                    onClick={() => handleTabChange('summary')}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-all",
                      currentTab === 'summary' 
                        ? "bg-gray-700 text-bone shadow-sm" 
                        : "text-gray-400 hover:text-gray-200"
                    )}
                  >
                    <AlignLeft className="w-4 h-4" />
                    Summary
                  </button>
                  <button
                    onClick={() => handleTabChange('timeline')}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-2 transition-all",
                      currentTab === 'timeline' 
                        ? "bg-gray-700 text-bone shadow-sm" 
                        : "text-gray-400 hover:text-gray-200"
                    )}
                  >
                    <List className="w-4 h-4" />
                    Timeline
                  </button>
               </div>

               <DialogPrimitive.Close asChild>
                 <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-white">
                   <X className="w-5 h-5" />
                 </Button>
               </DialogPrimitive.Close>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden bg-gray-900 relative flex flex-col">
             {currentTab === 'summary' && (
               <>
                 {/* Summary Section */}
                 <div className="flex-1 overflow-auto p-6 max-w-2xl mx-auto w-full">
                   <OrderSummaryView 
                     stages={stages} 
                     isRunning={order.status === OrderStatus.RUNNING}
                     awaitingInput={{ required: false }}
                     onSendInput={handleSendInput}
                   />
                 </div>

                 {/* Output Section at Bottom */}
                 <div className="border-t border-gray-700 bg-black flex flex-col" style={{ height: '300px' }}>
                   <div className="px-4 py-2 border-b border-gray-800 bg-gray-900 flex items-center gap-2">
                     <Activity className="w-4 h-4 text-coffee" />
                     <span className="text-sm font-semibold text-bone">Terminal Output</span>
                     {outputLines.length > 0 && (
                       <span className="text-xs bg-coffee text-black px-2 py-0.5 rounded-full">
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
                       <div className="text-gray-500 italic">No output yet. Execute the order to see terminal output here.</div>
                     ) : (
                       outputLines.map((line, idx) => (
                         <div key={idx} className="whitespace-pre-wrap mb-1">
                           <span className="text-gray-600 text-xs mr-2">
                             {new Date(line.timestamp).toLocaleTimeString()}
                           </span>
                           <span 
                             className={cn(
                               line.type === 'stderr' && 'text-red-400',
                               line.type === 'stdout' && 'text-gray-200',
                               line.type === 'system' && 'text-yellow-400'
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
