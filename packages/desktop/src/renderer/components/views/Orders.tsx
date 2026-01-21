/**
 * Orders View - 2-Panel Layout
 * Left: Order list (Kanban-style)
 * Right: Order details with tabs
 */

import { useEffect, useMemo, useState } from 'react';
import { useOrders } from '../../hooks/useOrders';
import { useOrderStore } from '../../store/useOrderStore';
import { useCafeStore } from '../../store/useCafeStore';
import type { Order } from '../../types/models';
import { OrderStatus } from '@codecafe/core';
import { OrderExecuteDialog } from '../order/OrderExecuteDialog';
import type { TimelineEvent } from '../orders';
import { OrderStageProgress, type StageInfo } from '../order/OrderStageProgress';
import { InteractiveTerminal } from '../order/InteractiveTerminal';
import { OrderTimelineView } from '../orders/OrderTimelineView';
import {
  Plus,
  Trash2,
  Box,
  Coffee,
  List,
  Activity,
  GitBranch,
  Split,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../../utils/cn';

type TabType = 'summary' | 'timeline';

// StatusDot component
function StatusDot({ status }: { status: OrderStatus }) {
  switch (status) {
    case OrderStatus.RUNNING:
      return (
        <div className="flex items-center gap-1.5 text-brand text-[10px] font-bold">
          <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
          RUNNING
        </div>
      );
    case OrderStatus.COMPLETED:
      return (
        <div className="flex items-center gap-1.5 text-emerald-500 text-[10px] font-bold">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          DONE
        </div>
      );
    case OrderStatus.CANCELLED:
      return (
        <div className="flex items-center gap-1.5 text-cafe-500 text-[10px] font-bold">
          <div className="w-2 h-2 rounded-full bg-cafe-500" />
          CANCELLED
        </div>
      );
    case OrderStatus.FAILED:
      return (
        <div className="flex items-center gap-1.5 text-red-500 text-[10px] font-bold">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          FAILED
        </div>
      );
    default:
      return (
        <div className="flex items-center gap-1.5 text-cafe-500 text-[10px] font-bold">
          <div className="w-2 h-2 rounded-full bg-cafe-600" />
          PENDING
        </div>
      );
  }
}

// TabButton component
function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors',
        active
          ? 'border-brand text-brand'
          : 'border-transparent text-cafe-400 hover:text-cafe-200'
      )}
    >
      {icon}
      {label}
    </button>
  );
}

export function Orders(): JSX.Element {
  const { orders, fetchOrders, cancelOrder, executeOrder } = useOrders();
  const { stageResults, updateStageResult } = useOrderStore();
  const currentCafe = useCafeStore((s) => s.getCurrentCafe());
  const [executeDialogOrder, setExecuteDialogOrder] = useState<Order | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [showCreateModal, setShowCreateModal] = useState(false);
  // Workflow 캐시: workflowId -> stages[]
  const [workflowStages, setWorkflowStages] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Session 이벤트 리스너 - Order 상태 변경 시 목록 갱신
  useEffect(() => {
    const cleanupSessionStarted = window.codecafe.order.onSessionStarted(
      (data: { orderId: string }) => {
        // Order 상태가 RUNNING으로 변경됨 - 목록 갱신
        fetchOrders();
      }
    );

    const cleanupSessionCompleted = window.codecafe.order.onSessionCompleted(
      (data: { orderId: string }) => {
        fetchOrders();
      }
    );

    const cleanupSessionFailed = window.codecafe.order.onSessionFailed(
      (data: { orderId: string; error?: string }) => {
        fetchOrders();
      }
    );

    return () => {
      cleanupSessionStarted();
      cleanupSessionCompleted();
      cleanupSessionFailed();
    };
  }, [fetchOrders]);

  // Stage 이벤트 리스너 - stageResults 업데이트
  useEffect(() => {
    const cleanupStageStarted = window.codecafe.order.onStageStarted(
      (data: { orderId: string; stageId: string; provider?: string }) => {
        updateStageResult(data.orderId, data.stageId, {
          status: 'running',
          startedAt: new Date().toISOString(),
        });
      }
    );

    const cleanupStageCompleted = window.codecafe.order.onStageCompleted(
      (data: { orderId: string; stageId: string; output?: string; duration?: number }) => {
        updateStageResult(data.orderId, data.stageId, {
          status: 'completed',
          completedAt: new Date().toISOString(),
          duration: data.duration,
        });
      }
    );

    const cleanupStageFailed = window.codecafe.order.onStageFailed(
      (data: { orderId: string; stageId: string; error?: string }) => {
        updateStageResult(data.orderId, data.stageId, {
          status: 'failed',
          completedAt: new Date().toISOString(),
          error: data.error,
        });
      }
    );

    return () => {
      cleanupStageStarted();
      cleanupStageCompleted();
      cleanupStageFailed();
    };
  }, [updateStageResult]);

  // 주기적으로 갱신
  useEffect(() => {
    const interval = setInterval(() => {
      fetchOrders();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const sortedOrders = useMemo(() => {
    return [...orders].reverse();
  }, [orders]);

  const activeOrder = orders.find((o) => o.id === activeOrderId);

  // Workflow 스테이지 로드
  useEffect(() => {
    const uniqueWorkflowIds = Array.from(
      new Set(orders.map((o) => o.workflowId).filter(Boolean))
    );

    uniqueWorkflowIds.forEach(async (workflowId) => {
      if (!workflowId || workflowStages[workflowId]) return;

      try {
        const response = await window.codecafe.workflow.get(workflowId);
        if (response.success && response.data?.stages) {
          setWorkflowStages((prev) => ({
            ...prev,
            [workflowId]: response.data!.stages,
          }));
        }
      } catch (error) {
        console.error(`Failed to load workflow ${workflowId}:`, error);
      }
    });
  }, [orders, workflowStages]);

  // Order에 대한 Stage 정보 생성
  const getStagesForOrder = (order: Order): StageInfo[] => {
    const orderStages = workflowStages[order.workflowId] || [];
    const results = stageResults[order.id] || {};

    if (orderStages.length === 0 && Object.keys(results).length > 0) {
      return Object.values(results).map((r) => ({
        name: r.stageId,
        status: r.status,
      }));
    }

    return orderStages.map((stageId) => {
      const stageResult = results[stageId];
      const isCompleted = order.status === OrderStatus.COMPLETED;
      const isFailed = order.status === OrderStatus.FAILED;
      const isRunning = order.status === OrderStatus.RUNNING;

      let status: StageInfo['status'] = 'pending';

      if (stageResult) {
        status = stageResult.status;
      } else if (isCompleted) {
        status = 'completed';
      } else if (isFailed) {
        status = 'failed';
      } else if (isRunning) {
        const stageIndex = orderStages.indexOf(stageId);
        const hasEarlierIncomplete = orderStages
          .slice(0, stageIndex)
          .some((s) => !results[s] || results[s].status !== 'completed');
        if (!hasEarlierIncomplete) {
          status = 'running';
        }
      }

      return {
        name: stageId.charAt(0).toUpperCase() + stageId.slice(1),
        status,
      };
    });
  };

  // Order에 대한 Timeline 이벤트 생성
  const getTimelineForOrder = (orderId: string): TimelineEvent[] => {
    const results = stageResults[orderId];
    if (!results) return [];

    const events: TimelineEvent[] = [];
    Object.values(results).forEach((r) => {
      if (r.startedAt) {
        events.push({
          id: `${r.stageId}-start`,
          type: 'stage_start',
          timestamp: r.startedAt,
          content: `Stage started`,
          stageName: r.stageId,
        });
      }
      if (r.completedAt) {
        events.push({
          id: `${r.stageId}-complete`,
          type: r.status === 'failed' ? 'stage_fail' : 'stage_complete',
          timestamp: r.completedAt,
          content: r.error || `Stage completed`,
          stageName: r.stageId,
        });
      }
    });
    return events.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  };

  async function handleCancel(orderId: string): Promise<void> {
    if (!confirm(`Cancel order ${orderId}?`)) {
      return;
    }

    try {
      await cancelOrder(orderId);
      if (activeOrderId === orderId) {
        setActiveOrderId(null);
      }
    } catch (error) {
      alert(`Failed to cancel order: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function handleDelete(orderId: string): Promise<void> {
    if (!confirm(`Delete order ${orderId}? This will also remove the worktree if any.`)) {
      return;
    }

    try {
      await window.codecafe.order.delete(orderId);
      if (activeOrderId === orderId) {
        setActiveOrderId(null);
      }
      fetchOrders();
    } catch (error) {
      alert(`Failed to delete order: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function handleOpenExecuteDialog(order: Order): void {
    setExecuteDialogOrder(order);
  }

  async function handleExecuteOrder(
    orderId: string,
    prompt: string,
    vars: Record<string, string>
  ): Promise<void> {
    await executeOrder(orderId, prompt, vars);
    setActiveOrderId(orderId);
    setActiveTab('summary');
  }

  async function handleSendInput(orderId: string, input: string): Promise<void> {
    await window.codecafe.order.sendInput(orderId, input);
  }

  return (
    <div className="flex h-full bg-cafe-950 overflow-hidden">
      {/* Left Panel: Order List */}
      <div className="w-80 border-r border-cafe-800 flex flex-col bg-cafe-900 shadow-xl z-10">
        <div className="p-5 border-b border-cafe-800 bg-cafe-900">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-cafe-100 truncate text-lg tracking-tight">
              {currentCafe?.name || 'Orders'}
            </h2>
            {currentCafe?.currentBranch && (
              <span className="text-[10px] bg-cafe-800 px-2 py-1 rounded-md text-cafe-400 font-mono border border-cafe-700 flex items-center">
                <GitBranch className="w-3 h-3 mr-1" />
                {currentCafe.currentBranch}
              </span>
            )}
          </div>
          {currentCafe?.path && (
            <p className="text-xs text-cafe-500 font-mono truncate mb-6 opacity-70">
              {currentCafe.path}
            </p>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full flex items-center justify-center px-4 py-3 bg-brand hover:bg-brand-hover text-white text-sm rounded-xl transition-all font-bold shadow-lg shadow-brand/20 hover:shadow-brand/40 transform hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Order
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {sortedOrders.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center h-full text-cafe-600">
              <Coffee className="w-8 h-8 mb-3 opacity-20" />
              <span className="text-sm font-medium">No active orders</span>
              <span className="text-xs opacity-60 mt-1">Start brewing some code</span>
            </div>
          ) : (
            sortedOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => setActiveOrderId(order.id)}
                className={cn(
                  'group relative p-4 cursor-pointer transition-all duration-200 rounded-xl border',
                  activeOrderId === order.id
                    ? 'bg-cafe-800 border-brand shadow-lg'
                    : 'bg-cafe-850/50 border-cafe-800 hover:border-cafe-600 hover:bg-cafe-800'
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-mono text-cafe-500 uppercase tracking-widest">
                    #{order.id.substring(0, 6)}
                  </span>
                  <StatusDot status={order.status} />
                </div>

                <h3
                  className={cn(
                    'text-sm font-bold mb-3',
                    activeOrderId === order.id ? 'text-white' : 'text-cafe-200'
                  )}
                >
                  {order.workflowName}
                </h3>

                <div className="flex items-center justify-between">
                  {order.worktreeInfo?.path ? (
                    <div className="flex items-center text-[10px] text-cafe-500 bg-cafe-950/50 px-2 py-1 rounded">
                      <Split className="w-3 h-3 mr-1.5 text-brand/70" />
                      <span className="truncate max-w-[100px]">worktree</span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-cafe-600">Main Repo</div>
                  )}

                  <ChevronRight
                    className={cn(
                      'w-4 h-4 text-cafe-600 transition-transform',
                      activeOrderId === order.id
                        ? 'translate-x-1 text-brand'
                        : 'group-hover:translate-x-1'
                    )}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Panel: Order Details */}
      <div className="flex-1 flex flex-col min-w-0 bg-terminal-bg">
        {!activeOrder ? (
          <div className="flex-1 flex flex-col items-center justify-center text-cafe-600 bg-cafe-950">
            <div className="w-24 h-24 bg-cafe-900 rounded-full flex items-center justify-center mb-6 shadow-2xl border border-cafe-800 animate-pulse">
              <Box className="w-10 h-10 opacity-30 text-brand" />
            </div>
            <p className="text-xl font-medium text-cafe-400">Select an order</p>
            <p className="text-sm opacity-50 mt-2">View execution logs and worktree details</p>
          </div>
        ) : (
          <>
            {/* Detail Header */}
            <div className="h-16 border-b border-cafe-800 flex items-center justify-between px-6 bg-cafe-900 shadow-md z-10">
              <div className="flex items-center gap-4">
                <div>
                  <h2 className="font-bold text-cafe-100 text-lg flex items-center">
                    {activeOrder.workflowName}
                    <span className="ml-3 text-xs font-normal text-cafe-500 font-mono bg-cafe-800 px-2 py-0.5 rounded">
                      #{activeOrder.id.substring(0, 8)}
                    </span>
                  </h2>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {activeOrder.status === OrderStatus.PENDING && (
                  <button
                    onClick={() => handleOpenExecuteDialog(activeOrder)}
                    className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-sm rounded-lg transition-colors font-medium"
                  >
                    Execute
                  </button>
                )}
                <button
                  onClick={() => handleDelete(activeOrder.id)}
                  className="p-2 text-cafe-500 hover:text-red-400 hover:bg-red-900/10 rounded-lg transition-colors"
                  title="Delete Order & Worktree"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tabs & Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex border-b border-cafe-800 bg-cafe-900/50 px-6">
                <TabButton
                  active={activeTab === 'summary'}
                  onClick={() => setActiveTab('summary')}
                  icon={<List className="w-4 h-4 mr-2" />}
                  label="Console & Progress"
                />
                <TabButton
                  active={activeTab === 'timeline'}
                  onClick={() => setActiveTab('timeline')}
                  icon={<Activity className="w-4 h-4 mr-2" />}
                  label="Timeline Events"
                />
              </div>

              <div className="flex-1 overflow-hidden relative">
                {activeTab === 'summary' && (
                  <div className="absolute inset-0 flex flex-col p-6 gap-6">
                    {/* Top: Progress */}
                    <div className="bg-cafe-900 p-5 rounded-xl border border-cafe-800 shadow-lg shrink-0">
                      <OrderStageProgress
                        stages={getStagesForOrder(activeOrder)}
                      />
                    </div>

                    {/* Bottom: Terminal */}
                    <div className="flex-1 min-h-0">
                      <InteractiveTerminal
                        orderId={activeOrder.id}
                        onSendInput={async (input) => handleSendInput(activeOrder.id, input)}
                        isRunning={activeOrder.status === OrderStatus.RUNNING}
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'timeline' && (
                  <div className="absolute inset-0 overflow-y-auto">
                    <OrderTimelineView events={getTimelineForOrder(activeOrder.id)} />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create Order Modal - placeholder, uses existing dialog */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-cafe-900 border border-cafe-700 rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-6 border-b border-cafe-800 bg-cafe-850">
              <h2 className="text-xl font-bold text-white flex items-center">
                <Plus className="w-5 h-5 mr-2 text-brand" />
                New Order
              </h2>
              <p className="text-cafe-500 text-sm mt-1">
                Create a new order from the New Order tab or use workflow view
              </p>
            </div>
            <div className="p-6">
              <p className="text-cafe-400 text-sm mb-6">
                Orders are created from the <span className="text-brand font-medium">New Order</span> view.
                Navigate there to create a new workflow execution.
              </p>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 text-cafe-400 hover:text-cafe-200 font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Execute Dialog */}
      <OrderExecuteDialog
        isOpen={executeDialogOrder !== null}
        onClose={() => setExecuteDialogOrder(null)}
        onExecute={handleExecuteOrder}
        order={executeDialogOrder}
      />
    </div>
  );
}
