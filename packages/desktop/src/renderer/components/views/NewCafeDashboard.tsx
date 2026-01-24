import React, { useState, useEffect, useCallback } from 'react';
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
  ArrowRight,
  Split,
  Box,
  Coffee,
  XCircle,
  List,
  GitMerge,
  MessageSquarePlus,
  RefreshCw
} from 'lucide-react';
import type { Cafe, DesignOrder, Recipe, OrderStatus } from '../../types/design';
import { OrderStageProgressBar, type StageInfo } from '../order/OrderStageProgress';
import { OrderTimelineView, type TimelineEvent } from '../orders/OrderTimelineView';
import { InteractiveTerminal } from '../order/InteractiveTerminal';

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

  // Create Order Form State
  const [selectedWorkflow, setSelectedWorkflow] = useState(workflows[0]?.id || '');
  const [description, setDescription] = useState('');
  const [useWorktree, setUseWorktree] = useState(true);

  const activeOrder = orders.find(o => o.id === activeOrderId);

  // Worktree Management State
  const [isMerging, setIsMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState<{ success: boolean; message: string } | null>(null);

  // Followup State
  const [isFollowupMode, setIsFollowupMode] = useState(false);
  const [isFollowupExecuting, setIsFollowupExecuting] = useState(false);

  const isCompleted = activeOrder?.status === 'COMPLETED';
  const isRunning = activeOrder?.status === 'RUNNING';
  const isWaitingInput = activeOrder?.status === 'WAITING_INPUT';

  // 입력 가능 조건: 실행 중, 입력 대기, followup 모드, 또는 완료 상태 (후속 명령 가능)
  const canSendInput = isRunning || isWaitingInput || isFollowupMode || isCompleted;

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

  const handleSendInput = useCallback(async (message: string) => {
    // Debug logging
    console.log('[NewCafeDashboard] handleSendInput called:', { activeOrderId, activeOrder, ordersCount: orders.length });

    if (!activeOrder) {
      console.error('[NewCafeDashboard] activeOrder is undefined:', { activeOrderId, orders });
      return;
    }

    if (!activeOrder.id) {
      console.error('[NewCafeDashboard] activeOrder.id is undefined:', { activeOrder, activeOrderId });
      return;
    }

    // Followup 모드 또는 완료 상태에서는 executeFollowup 사용
    if (isFollowupMode || isCompleted) {
      setIsFollowupExecuting(true);
      try {
        // executeFollowup은 completed/followup 상태에서 바로 동작
        // 앱 재시작 후 복원된 세션에서도 enterFollowup 없이 바로 실행 가능
        const response = await window.codecafe.order.executeFollowup(activeOrder.id, message);
        if (!response.success) {
          throw new Error(response.error?.message || 'Failed to execute followup');
        }
        // 성공 시 followup 모드로 전환
        if (!isFollowupMode) {
          setIsFollowupMode(true);
        }
      } finally {
        setIsFollowupExecuting(false);
      }
    } else {
      // Running 상태에서는 sendInput 사용
      onSendInput(activeOrder.id, message);
    }
  }, [activeOrder, isFollowupMode, isCompleted]);

  // Followup 모드 진입
  const handleEnterFollowup = useCallback(async () => {
    if (!activeOrder) return;
    try {
      const response = await window.codecafe.order.enterFollowup(activeOrder.id);
      if (response.success) {
        setIsFollowupMode(true);
      } else {
        console.error('Failed to enter followup mode:', response.error);
      }
    } catch (error) {
      console.error('Failed to enter followup mode:', error);
    }
  }, [activeOrder]);

  // Followup 모드 종료
  const handleFinishFollowup = useCallback(async () => {
    if (!activeOrder) return;
    try {
      const response = await window.codecafe.order.finishFollowup(activeOrder.id);
      if (response.success) {
        setIsFollowupMode(false);
      } else {
        console.error('Failed to finish followup:', response.error);
      }
    } catch (error) {
      console.error('Failed to finish followup:', error);
    }
  }, [activeOrder]);

  // Worktree 병합 처리
  const handleMergeWorktree = useCallback(async (deleteAfterMerge: boolean = false) => {
    if (!activeOrder?.worktreeInfo?.path || !activeOrder?.worktreeInfo?.repoPath) {
      console.error('No worktree info available');
      return;
    }

    setIsMerging(true);
    setMergeResult(null);

    try {
      const response = await window.codecafe.worktree.mergeToTarget({
        worktreePath: activeOrder.worktreeInfo.path,
        repoPath: activeOrder.worktreeInfo.repoPath,
        targetBranch: activeOrder.worktreeInfo.baseBranch || 'main',
        deleteAfterMerge,
        squash: false,
        autoCommit: true, // 미커밋 변경사항 자동 커밋
      });

      if (response.success && response.data) {
        setMergeResult({
          success: true,
          message: `Merged to ${response.data.targetBranch}${deleteAfterMerge ? ' (worktree removed)' : ''}`,
        });
      } else {
        setMergeResult({
          success: false,
          message: response.error?.message || 'Merge failed',
        });
      }
    } catch (error) {
      setMergeResult({
        success: false,
        message: error instanceof Error ? error.message : 'Merge failed',
      });
    } finally {
      setIsMerging(false);
    }
  }, [activeOrder]);

  // Worktree만 삭제 (브랜치 유지)
  const handleRemoveWorktreeOnly = useCallback(async () => {
    if (!activeOrder?.worktreeInfo?.path || !activeOrder?.worktreeInfo?.repoPath) {
      console.error('No worktree info available');
      return;
    }

    setIsMerging(true);
    setMergeResult(null);
    try {
      const response = await window.codecafe.worktree.removeOnly(
        activeOrder.worktreeInfo.path,
        activeOrder.worktreeInfo.repoPath
      );

      if (response.success && response.data) {
        setMergeResult({
          success: true,
          message: `Worktree removed, branch '${response.data.branch}' preserved`,
        });
      } else {
        setMergeResult({
          success: false,
          message: response.error?.message || 'Failed to remove worktree',
        });
      }
    } catch (error) {
      setMergeResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to remove worktree',
      });
    } finally {
      setIsMerging(false);
    }
  }, [activeOrder]);

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
                    <span className="text-xs font-mono text-cafe-500">#{order.id.replace(/^order-/, '').substring(0,8)}</span>
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
                {/* Followup Buttons - 완료 상태에서 추가 명령 가능 */}
                {isCompleted && !isFollowupMode && (
                  <button
                    onClick={handleEnterFollowup}
                    className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center gap-1.5"
                    title="Continue with followup commands"
                  >
                    <MessageSquarePlus className="w-3.5 h-3.5" />
                    Continue
                  </button>
                )}
                {isFollowupMode && (
                  <button
                    onClick={handleFinishFollowup}
                    className="px-3 py-1.5 text-xs font-medium bg-cafe-700 hover:bg-cafe-600 text-white rounded-lg transition-colors flex items-center gap-1.5"
                    title="Finish followup mode"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Finish
                  </button>
                )}
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
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Worktree Management Panel - 완료 상태에서 worktree가 있을 때 */}
                {isCompleted && activeOrder.worktreeInfo && (
                  <div className="mx-4 mt-4 p-4 bg-cafe-900 border border-green-500/30 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <GitMerge className="w-4 h-4 text-green-400" />
                        <h3 className="text-sm font-medium text-green-400">Worktree Management</h3>
                      </div>
                      <button
                        onClick={() => setViewMode('timeline')}
                        className="text-xs text-cafe-500 hover:text-cafe-300"
                      >
                        Close
                      </button>
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1 px-3 py-2 bg-cafe-950 rounded border border-cafe-800">
                        <div className="flex items-center gap-2 text-xs">
                          <GitCommit className="w-3 h-3 text-brand" />
                          <span className="font-mono text-cafe-300">{activeOrder.worktreeInfo.branch}</span>
                        </div>
                      </div>
                    </div>

                    {mergeResult && (
                      <div className={`text-xs p-2 rounded mb-3 ${
                        mergeResult.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {mergeResult.message}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleMergeWorktree(false)}
                        disabled={isMerging}
                        className="flex-1 px-3 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <GitMerge className={`w-3 h-3 ${isMerging ? 'animate-spin' : ''}`} />
                        {isMerging ? 'Merging...' : 'Merge to Main'}
                      </button>
                      <button
                        onClick={() => handleMergeWorktree(true)}
                        disabled={isMerging}
                        className="px-3 py-2 bg-cafe-800 hover:bg-cafe-700 text-yellow-400 text-xs font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        <GitMerge className="w-3 h-3" />
                        Merge & Delete
                      </button>
                      <button
                        onClick={handleRemoveWorktreeOnly}
                        disabled={isMerging}
                        className="px-3 py-2 bg-cafe-800 hover:bg-cafe-700 text-red-400 text-xs font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove Only
                      </button>
                    </div>
                    <div className="text-[10px] text-cafe-600 mt-2">
                      * "Remove Only" preserves the branch for later use
                    </div>
                  </div>
                )}
                <InteractiveTerminal
                  orderId={activeOrder.id}
                  onSendInput={canSendInput ? handleSendInput : undefined}
                  isRunning={isRunning || isFollowupExecuting}
                  isAwaitingInput={isWaitingInput}
                  worktreePath={activeOrder.worktreeInfo?.path}
                  startedAt={activeOrder.startedAt}
                  className={isCompleted && activeOrder.worktreeInfo ? 'flex-1' : 'h-full'}
                  placeholder={isFollowupMode || isCompleted ? 'Enter followup command...' : undefined}
                />
              </div>
            ) : (
              <div className="flex-1 overflow-hidden">
                <OrderTimelineView events={timelineEvents[activeOrder.id] || []} />
              </div>
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
