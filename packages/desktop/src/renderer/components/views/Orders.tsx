import { useEffect, useMemo, useState } from 'react';
import { useOrders } from '../../hooks/useOrders';
import { useOrderStore } from '../../store/useOrderStore';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import type { Order } from '../../types/models';
import { OrderStatus } from '@codecafe/core';
import { OrderExecuteDialog } from '../order/OrderExecuteDialog';
import { OrderDetailView } from '../order/OrderDetailView';
import { OrderCard, OrderModal, type TimelineEvent } from '../orders';
import type { StageInfo } from '../order/OrderStageProgress';

type ViewMode = 'grid' | 'list';

export function Orders(): JSX.Element {
  const { orders, fetchOrders, getOrderLog, cancelOrder, executeOrder } = useOrders();
  const { sessionStatuses, stageResults, updateStageResult } = useOrderStore();
  const [executeDialogOrder, setExecuteDialogOrder] = useState<Order | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalOrder, setModalOrder] = useState<Order | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  // Workflow 캐시: workflowId -> stages[]
  const [workflowStages, setWorkflowStages] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Stage 이벤트 리스너 - stageResults 업데이트
  useEffect(() => {
    // order:stage-started 이벤트 리스너
    const cleanupStageStarted = window.codecafe.order.onStageStarted((data: { orderId: string; stageId: string; provider?: string }) => {
      updateStageResult(data.orderId, data.stageId, {
        status: 'running',
        startedAt: new Date().toISOString(),
      });
    });

    // order:stage-completed 이벤트 리스너
    const cleanupStageCompleted = window.codecafe.order.onStageCompleted((data: { orderId: string; stageId: string; output?: string; duration?: number }) => {
      updateStageResult(data.orderId, data.stageId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        duration: data.duration,
      });
    });

    // order:stage-failed 이벤트 리스너
    const cleanupStageFailed = window.codecafe.order.onStageFailed((data: { orderId: string; stageId: string; error?: string }) => {
      updateStageResult(data.orderId, data.stageId, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        error: data.error,
      });
    });

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

  // Workflow 스테이지 로드 - 각 order의 workflowId로 stages 목록 가져오기
  useEffect(() => {
    const uniqueWorkflowIds = Array.from(new Set(orders.map(o => o.workflowId).filter(Boolean)));

    uniqueWorkflowIds.forEach(async (workflowId) => {
      if (!workflowId || workflowStages[workflowId]) return;

      try {
        const response = await window.codecafe.workflow.get(workflowId);
        if (response.success && response.data?.stages) {
          setWorkflowStages(prev => ({
            ...prev,
            [workflowId]: response.data.stages,
          }));
        }
      } catch (error) {
        console.error(`Failed to load workflow ${workflowId}:`, error);
      }
    });
  }, [orders, workflowStages]);

  // Order에 대한 Stage 정보 생성
  // workflow의 전체 stage 목록을 기반으로, stageResults에서 상태를 찾음
  const getStagesForOrder = (order: Order): StageInfo[] => {
    const orderStages = workflowStages[order.workflowId] || [];
    const results = stageResults[order.id] || {};

    // workflow stages를 기반으로 StageInfo 생성
    return orderStages.map(stageId => {
      const stageResult = results[stageId];
      const isCompleted = order.status === OrderStatus.COMPLETED;
      const isFailed = order.status === OrderStatus.FAILED;
      const isRunning = order.status === OrderStatus.RUNNING;

      // stageResult가 있으면 그 상태 사용, 없으면 order 상태 기반 추정
      let status: StageInfo['status'] = 'pending';

      if (stageResult) {
        status = stageResult.status;
      } else if (isCompleted) {
        status = 'completed';
      } else if (isFailed) {
        status = 'failed';
      } else if (isRunning) {
        // 첫 번째 미완료 stage는 running 상태로 표시
        const stageIndex = orderStages.indexOf(stageId);
        const hasEarlierIncomplete = orderStages
          .slice(0, stageIndex)
          .some(s => !results[s] || results[s].status !== 'completed');
        if (!hasEarlierIncomplete) {
          status = 'running';
        }
      }

      return {
        name: stageId.charAt(0).toUpperCase() + stageId.slice(1),
        status,
      };
    });

    // fallback: workflow stages가 없으면 stageResults만 사용
    if (orderStages.length === 0 && Object.keys(results).length > 0) {
      return Object.values(results).map(r => ({
        name: r.stageId,
        status: r.status,
      }));
    }

    return [];
  };

  // Order에 대한 Timeline 이벤트 생성 (placeholder)
  const getTimelineForOrder = (orderId: string): TimelineEvent[] => {
    const results = stageResults[orderId];
    if (!results) return [];
    
    const events: TimelineEvent[] = [];
    Object.values(results).forEach(r => {
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
    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  };

  async function handleViewLog(orderId: string): Promise<void> {
    const log = await getOrderLog(orderId);
    alert(`Order Log:\n\n${log || 'No logs yet'}`);
  }

  async function handleCancel(orderId: string): Promise<void> {
    if (!confirm(`Cancel order ${orderId}?`)) {
      return;
    }

    try {
      await cancelOrder(orderId);
      setSelectedOrder(null);
      setModalOrder(null);
    } catch (error) {
      alert(`Failed to cancel order: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function handleViewDetail(order: Order): void {
    setSelectedOrder(order);
  }

  function handleViewModal(orderId: string): void {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      setModalOrder(order);
    }
  }

  function handleOpenExecuteDialog(order: Order): void {
    setExecuteDialogOrder(order);
  }

  async function handleExecuteOrder(orderId: string, prompt: string, vars: Record<string, string>): Promise<void> {
    await executeOrder(orderId, prompt, vars);
    const response = await window.codecafe.order.get(orderId);
    if (response.success && response.data) {
      setSelectedOrder(response.data);
    }
  }

  // Order 상세 뷰 표시
  if (selectedOrder) {
    return (
      <OrderDetailView
        order={selectedOrder}
        onBack={() => setSelectedOrder(null)}
        onCancel={handleCancel}
      />
    );
  }

  if (orders.length === 0) {
    return (
      <Card>
        <EmptyState message="No orders yet. Create one from New Order tab." />
      </Card>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-coffee">All Orders</h3>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'grid' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            Grid
          </Button>
          <Button
            variant={viewMode === 'list' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            List
          </Button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              stages={getStagesForOrder(order)}
              onView={handleViewModal}
              onCancel={handleCancel}
              onExecute={(orderId) => {
                const o = orders.find(x => x.id === orderId);
                if (o) handleOpenExecuteDialog(o);
              }}
            />
          ))}
        </div>
      ) : (
        <Card className="p-4">
          <div className="space-y-3">
            {sortedOrders.map((order) => (
              <div key={order.id} className="p-3 bg-gray-800 rounded border border-border flex items-center justify-between">
                <div>
                  <div className="font-bold text-bone">{order.workflowName}</div>
                  <div className="text-xs text-gray-500">{order.id.slice(0, 8)} • {order.provider}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => handleViewModal(order.id)}>
                    View
                  </Button>
                  {(order.status === OrderStatus.PENDING || order.status === OrderStatus.RUNNING) && (
                    <Button size="sm" variant="secondary" onClick={() => handleCancel(order.id)} className="text-red-400">
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Order Modal */}
      {modalOrder && (
        <OrderModal
          isOpen={!!modalOrder}
          onClose={() => setModalOrder(null)}
          order={modalOrder}
          stages={getStagesForOrder(modalOrder)}
          timelineEvents={getTimelineForOrder(modalOrder.id)}
          onSendInput={async (msg) => {
            await window.codecafe.order.sendInput(modalOrder.id, msg);
          }}
        />
      )}

      {/* Execute Dialog */}
      <OrderExecuteDialog
        isOpen={executeDialogOrder !== null}
        onClose={() => setExecuteDialogOrder(null)}
        onExecute={handleExecuteOrder}
        order={executeDialogOrder}
      />
    </>
  );
}
