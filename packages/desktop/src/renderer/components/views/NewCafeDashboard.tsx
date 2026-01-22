import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Plus,
  Terminal as TerminalIcon,
  Cpu,
  GitCommit,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Trash2,
  MessageSquare,
  ArrowRight,
  Split,
  Box,
  Coffee,
  Sparkles,
  XCircle,
  Clock,
  List
} from 'lucide-react';
import type { Cafe, DesignOrder, Recipe, OrderStatus } from '../../types/design';
import { OrderStageProgressBar, type StageInfo } from '../order/OrderStageProgress';
import { OrderTimelineView, type TimelineEvent } from '../orders/OrderTimelineView';

interface NewCafeDashboardProps {
  cafe: Cafe;
  orders: DesignOrder[];
  workflows: Recipe[];
  onCreateOrder: (cafeId: string, workflowId: string, description: string, useWorktree: boolean) => void;
  onDeleteOrder: (orderId: string) => void;
  onCancelOrder: (orderId: string) => void;
  onSendInput: (orderId: string, input: string) => void;
  getStagesForOrder: (order: DesignOrder) => StageInfo[];
  timelineEvents: Record<string, TimelineEvent[]>;
}

const StatusBadge = ({ status, size = 'sm' }: { status: OrderStatus, size?: 'sm' | 'lg' }) => {
  const baseClasses = "flex items-center font-bold rounded-md border";
  const sizeClasses = size === 'lg' ? "text-xs px-2.5 py-1" : "text-[10px] px-2 py-0.5";

  switch (status) {
    case 'RUNNING':
      return <span className={`${baseClasses} ${sizeClasses} text-brand-light bg-brand/10 border-brand/20`}><Loader2 className={`mr-1.5 animate-spin ${size === 'lg' ? 'w-3.5 h-3.5' : 'w-3 h-3'}`} /> RUNNING</span>;
    case 'COMPLETED':
      return <span className={`${baseClasses} ${sizeClasses} text-emerald-400 bg-emerald-900/20 border-emerald-900/30`}><CheckCircle2 className={`mr-1.5 ${size === 'lg' ? 'w-3.5 h-3.5' : 'w-3 h-3'}`} /> COMPLETED</span>;
    case 'WAITING_INPUT':
      return <span className={`${baseClasses} ${sizeClasses} text-orange-400 bg-orange-900/20 border-orange-900/30`}><AlertCircle className={`mr-1.5 ${size === 'lg' ? 'w-3.5 h-3.5' : 'w-3 h-3'}`} /> WAITING INPUT</span>;
    case 'FAILED':
      return <span className={`${baseClasses} ${sizeClasses} text-red-400 bg-red-900/20 border-red-900/30`}><AlertCircle className={`mr-1.5 ${size === 'lg' ? 'w-3.5 h-3.5' : 'w-3 h-3'}`} /> FAILED</span>;
    default:
      return <span className={`${baseClasses} ${sizeClasses} text-cafe-500 bg-cafe-800 border-cafe-700`}>PENDING</span>;
  }
};

export const NewCafeDashboard: React.FC<NewCafeDashboardProps> = ({
  cafe,
  orders,
  workflows,
  onCreateOrder,
  onDeleteOrder,
  onCancelOrder,
  onSendInput,
  getStagesForOrder,
  timelineEvents
}) => {
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewMode, setViewMode] = useState<'logs' | 'timeline'>('logs');
  const [elapsedByOrderId, setElapsedByOrderId] = useState<Record<string, number>>({});

  // Create Order Form State
  const [selectedWorkflow, setSelectedWorkflow] = useState(workflows[0]?.id || '');
  const [description, setDescription] = useState('');
  const [useWorktree, setUseWorktree] = useState(true);

  // Terminal State
  const [inputBuffer, setInputBuffer] = useState('');
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const activeOrder = orders.find(o => o.id === activeOrderId);

  useEffect(() => {
    if (!activeOrder) {
      return;
    }

    const isActive = activeOrder.status === 'RUNNING' || activeOrder.status === 'WAITING_INPUT';
    if (!isActive) {
      return;
    }

    const startValue = activeOrder.startedAt || activeOrder.createdAt;
    const startMs = new Date(startValue as any).getTime();
    if (Number.isNaN(startMs)) {
      return;
    }

    const tick = () => {
      const elapsed = Date.now() - startMs;
      setElapsedByOrderId((prev) => ({
        ...prev,
        [activeOrder.id]: elapsed,
      }));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [activeOrder?.id, activeOrder?.status, activeOrder?.startedAt, activeOrder?.createdAt]);

  useEffect(() => {
    if (orders.length === 0) {
      setElapsedByOrderId({});
      return;
    }

    const orderIds = new Set(orders.map((o) => o.id));
    setElapsedByOrderId((prev) => {
      const next: Record<string, number> = {};
      for (const [orderId, elapsed] of Object.entries(prev)) {
        if (orderIds.has(orderId)) {
          next[orderId] = elapsed;
        }
      }
      return next;
    });
  }, [orders]);

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

  // Auto-scroll terminal
  useEffect(() => {
    if (activeOrder && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeOrder?.logs.length, activeOrderId]);

  // Set first order as active when none selected
  useEffect(() => {
    if (!activeOrderId && orders.length > 0) {
      setActiveOrderId(orders[0].id);
    }
  }, [orders, activeOrderId]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateOrder(cafe.id, selectedWorkflow, description, useWorktree);
    setShowCreateModal(false);
    setDescription('');
  };

  const handleTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder || !inputBuffer.trim()) return;
    onSendInput(activeOrder.id, inputBuffer);
    setInputBuffer('');
  };

  return (
    <div className="flex h-screen bg-cafe-950 overflow-hidden">
      {/* Left Panel: Order List */}
      <div className="w-80 border-r border-cafe-800 flex flex-col bg-cafe-900 shadow-xl z-10">
        <div className="p-5 border-b border-cafe-800 bg-cafe-900">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-cafe-100 truncate text-lg tracking-tight">{cafe.name}</h2>
            <span className="text-[10px] bg-cafe-800 px-2 py-1 rounded-md text-cafe-400 font-mono border border-cafe-700">
              {cafe.settings.baseBranch}
            </span>
          </div>
          <p className="text-xs text-cafe-500 font-mono truncate mb-6 flex items-center opacity-70">
            <GitCommit className="w-3 h-3 mr-1" />
            {cafe.path}
          </p>

          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full flex items-center justify-center px-4 py-3 bg-brand hover:bg-brand-hover text-white text-sm rounded-xl transition-all font-bold shadow-lg shadow-brand/20 hover:shadow-brand/40 transform hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Order
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {orders.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center h-full text-cafe-600">
              <Coffee className="w-8 h-8 mb-3 opacity-20" />
              <span className="text-sm font-medium">No active orders</span>
              <span className="text-xs opacity-60 mt-1">Start brewing some code</span>
            </div>
          ) : (
            <div className="divide-y divide-cafe-800/50">
              {orders.map(order => (
                <div
                  key={order.id}
                  onClick={() => setActiveOrderId(order.id)}
                  className={`p-4 cursor-pointer transition-all duration-200 border-l-4 ${
                    activeOrderId === order.id
                      ? 'bg-cafe-800 border-brand'
                      : 'hover:bg-cafe-800/50 border-transparent'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-mono text-cafe-500">#{order.id.substring(0,6)}</span>
                    <StatusBadge status={order.status} />
                  </div>
                  <h3 className={`text-sm font-semibold mb-1.5 ${activeOrderId === order.id ? 'text-white' : 'text-cafe-300'}`}>
                    {order.workflowName}
                  </h3>
                  {/* Stage Progress Bar */}
                  {getStagesForOrder(order).length > 0 && (
                    <div className="mt-2">
                      <OrderStageProgressBar stages={getStagesForOrder(order)} />
                    </div>
                  )}
                  {order.worktreeInfo && (
                    <div className="flex items-center text-[10px] text-cafe-500 mt-2 bg-cafe-950/50 p-1.5 rounded border border-cafe-800/50">
                      <Split className="w-3 h-3 mr-1.5 text-brand/70" />
                      <span className="truncate font-mono">{order.worktreeInfo.branch}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Panel: Execution / Empty State */}
      <div className="flex-1 flex flex-col min-w-0 bg-terminal-bg">
        {!activeOrder ? (
          <div className="flex-1 flex flex-col items-center justify-center text-cafe-600 bg-cafe-950">
            <div className="w-24 h-24 bg-cafe-900 rounded-full flex items-center justify-center mb-6 shadow-2xl border border-cafe-800">
              <Cpu className="w-10 h-10 opacity-30 text-brand" />
            </div>
            <p className="text-xl font-medium text-cafe-400">Select an order</p>
            <p className="text-sm opacity-50 mt-2">View execution logs and worktree details</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="h-16 border-b border-cafe-800 flex items-center justify-between px-6 bg-cafe-900 shadow-md z-10">
              <div className="flex items-center space-x-4">
                <div className="flex flex-col">
                  <div className="flex items-center">
                    <h2 className="font-bold text-cafe-100 mr-3 text-lg">Order #{activeOrder.id.substring(0,8)}</h2>
                    <StatusBadge status={activeOrder.status} size="lg" />
                    {elapsedByOrderId[activeOrder.id] !== undefined && (
                      <span className="ml-2 text-[11px] font-mono text-cafe-400 bg-cafe-950/60 border border-cafe-800 px-2 py-1 rounded">
                        {formatElapsed(elapsedByOrderId[activeOrder.id])}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                 {activeOrder.worktreeInfo && (
                    <div className="flex items-center px-3 py-1.5 bg-cafe-950 rounded-lg border border-cafe-800 shadow-inner">
                      <Box className="w-3.5 h-3.5 text-brand mr-2" />
                      <span className="text-xs text-cafe-300 font-mono">
                        {activeOrder.worktreeInfo.path.split('/').pop()}
                      </span>
                    </div>
                 )}
                {/* View Mode Toggle */}
                <div className="flex border border-cafe-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode('logs')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      viewMode === 'logs' ? 'bg-brand text-white' : 'bg-cafe-900 text-cafe-400 hover:text-white'
                    }`}
                  >
                    <TerminalIcon className="w-3.5 h-3.5" />
                    Logs
                  </button>
                  <button
                    onClick={() => setViewMode('timeline')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      viewMode === 'timeline' ? 'bg-brand text-white' : 'bg-cafe-900 text-cafe-400 hover:text-white'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    Timeline
                  </button>
                </div>
                <div className="h-6 w-px bg-cafe-800 mx-2"></div>
                {/* Cancel Button - only for running orders */}
                {(activeOrder.status === 'RUNNING' || activeOrder.status === 'WAITING_INPUT') && (
                  <button
                    onClick={() => onCancelOrder(activeOrder.id)}
                    className="p-2 text-cafe-500 hover:text-yellow-400 hover:bg-yellow-900/10 rounded-lg transition-colors"
                    title="Cancel Order"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => onDeleteOrder(activeOrder.id)}
                  className="p-2 text-cafe-500 hover:text-red-400 hover:bg-red-900/10 rounded-lg transition-colors"
                  title="Delete Order & Worktree"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content View - Logs or Timeline */}
            {viewMode === 'logs' ? (
              <div className="flex-1 bg-terminal-bg p-8 overflow-y-auto terminal-scroll font-mono text-sm relative shadow-inner">
                 {/* Welcome Banner in Terminal */}
                 <div className="mb-8 pb-6 border-b border-cafe-800/30">
                    <div className="text-cafe-500 mb-2 font-medium flex items-center">
                      <Sparkles className="w-4 h-4 mr-2 text-brand" />
                      Started execution via <span className="text-brand ml-1.5">BaristaEngineV2</span>
                    </div>
                    <div className="text-cafe-600 text-xs flex gap-4">
                      <span>Workflow: <span className="text-cafe-400">{activeOrder.workflowName}</span></span>
                      <span>Provider: <span className="text-cafe-400">Claude Code</span></span>
                      <span>Isolation: <span className="text-cafe-400">{activeOrder.worktreeInfo ? 'Enabled' : 'Disabled'}</span></span>
                    </div>
                 </div>

                 {/* Logs */}
                 <div className="space-y-4 max-w-5xl">
                   {activeOrder.logs.map((log) => (
                     <div key={log.id} className="flex group animate-in fade-in duration-300 items-start">
                       <span className="text-cafe-700 text-[11px] w-20 shrink-0 select-none pt-1 font-mono tracking-tighter opacity-70">{log.timestamp}</span>
                       <div className={`flex-1 break-all whitespace-pre-wrap leading-relaxed ${
                         log.type === 'error' ? 'text-red-400 bg-red-950/10 p-2 rounded -mt-2' :
                         log.type === 'success' ? 'text-emerald-400 font-medium' :
                         log.type === 'system' ? 'text-blue-400 opacity-80' :
                         log.type === 'ai' ? 'text-cafe-200' :
                         'text-cafe-400'
                       }`}>
                         {log.type === 'system' && <span className="mr-2 opacity-50">➜</span>}
                         {log.type === 'ai' && <span className="mr-2 text-brand">🤖</span>}
                         <span dangerouslySetInnerHTML={{ __html: log.content }} />
                       </div>
                     </div>
                   ))}
                   {activeOrder.status === 'RUNNING' && (
                     <div className="flex items-center text-cafe-500 mt-4 animate-pulse ml-20">
                       <span className="w-1.5 h-3 bg-brand block mr-2.5"></span>
                       Thinking...
                     </div>
                   )}
                   <div ref={terminalEndRef} />
                 </div>
              </div>
            ) : (
              <div className="flex-1 overflow-hidden">
                <OrderTimelineView events={timelineEvents[activeOrder.id] || []} />
              </div>
            )}

            {/* Input Area (Conditional) */}
            {activeOrder.status === 'WAITING_INPUT' ? (
              <div className="border-t border-brand/30 bg-cafe-900/90 backdrop-blur-sm p-6 animate-in slide-in-from-bottom-2 absolute bottom-0 w-full z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-center mb-3 text-brand-light text-sm font-bold tracking-wide">
                    <div className="w-2 h-2 rounded-full bg-brand animate-ping mr-2.5"></div>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    INPUT REQUIRED
                  </div>
                  <form onSubmit={handleTerminalSubmit} className="relative group">
                    <input
                      autoFocus
                      type="text"
                      value={inputBuffer}
                      onChange={(e) => setInputBuffer(e.target.value)}
                      placeholder="Type your response to the barista..."
                      className="w-full bg-cafe-950 border border-cafe-700 text-cafe-100 rounded-xl pl-5 pr-14 py-4 focus:ring-2 focus:ring-brand focus:border-transparent outline-none font-mono shadow-inner transition-all"
                    />
                    <button
                      type="submit"
                      disabled={!inputBuffer.trim()}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 bg-brand hover:bg-brand-hover text-white rounded-lg disabled:opacity-50 disabled:bg-cafe-800 transition-colors"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="h-2 bg-cafe-900 border-t border-cafe-800"></div>
            )}
          </>
        )}
      </div>

      {/* Create Order Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-cafe-900 border border-cafe-700 rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-6 border-b border-cafe-800 bg-cafe-850">
              <h2 className="text-xl font-bold text-white flex items-center">
                <Plus className="w-5 h-5 mr-2 text-brand" />
                New Order
              </h2>
              <p className="text-cafe-500 text-sm mt-1">Orchestrate a new workflow for <span className="text-cafe-300 font-mono font-medium">{cafe.name}</span></p>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-6">
              <div>
                <label className="block text-xs font-bold text-cafe-500 uppercase mb-3 tracking-wider">Select Workflow</label>
                <div className="grid grid-cols-1 gap-2.5">
                  {workflows.map(wf => (
                    <div
                      key={wf.id}
                      onClick={() => setSelectedWorkflow(wf.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all duration-200 ${
                        selectedWorkflow === wf.id
                          ? 'bg-brand/10 border-brand/50 shadow-sm'
                          : 'bg-cafe-950 border-cafe-800 hover:border-cafe-600'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-bold ${selectedWorkflow === wf.id ? 'text-brand-light' : 'text-cafe-200'}`}>{wf.name}</span>
                        {selectedWorkflow === wf.id && <CheckCircle2 className="w-5 h-5 text-brand" />}
                      </div>
                      <p className="text-xs text-cafe-500">{wf.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-cafe-500 uppercase mb-2 tracking-wider">Description / Prompt</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What would you like the barista to do?"
                  className="w-full h-24 bg-cafe-950 border border-cafe-700 text-cafe-200 rounded-xl p-4 focus:ring-2 focus:ring-brand outline-none text-sm resize-none font-mono"
                />
              </div>

              <div className="flex items-center p-3.5 bg-cafe-950 rounded-xl border border-cafe-800">
                <div className="flex items-center h-5">
                    <input
                    type="checkbox"
                    id="worktree"
                    checked={useWorktree}
                    onChange={(e) => setUseWorktree(e.target.checked)}
                    className="w-5 h-5 rounded border-cafe-600 text-brand bg-cafe-800 focus:ring-brand focus:ring-offset-cafe-900 cursor-pointer"
                    />
                </div>
                <label htmlFor="worktree" className="ml-3 flex-1 cursor-pointer">
                  <span className="block text-sm font-bold text-cafe-200">Isolate in Worktree</span>
                  <span className="block text-xs text-cafe-500 mt-0.5">Creates a temporary git worktree to prevent conflicts.</span>
                </label>
                <div className="bg-cafe-800 p-1.5 rounded-lg">
                    <Split className="w-5 h-5 text-cafe-500" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-cafe-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 text-cafe-400 hover:text-cafe-200 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-brand/20"
                >
                  Create Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
