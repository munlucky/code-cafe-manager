/**
 * Cafe Dashboard View
 * Order management for a specific Cafe
 */

import { useEffect, useState, useMemo, type ReactElement } from 'react';
import {
  Plus,
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react';
import { OrderStatus, type Order } from '../../types/models';

import { useCafeStore } from '../../store/useCafeStore';
import { useViewStore } from '../../store/useViewStore';
import { useOrderStore } from '../../store/useOrderStore';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { NewOrderDialog } from '../order/NewOrderDialog';
import { OrderExecuteDialog } from '../order/OrderExecuteDialog';
import { OrderCard as NewOrderCard, OrderModal, type TimelineEvent } from '../orders';
import type { StageInfo } from '../order/OrderStageProgress';

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; variant: 'default' | 'success' | 'error' | 'warning'; icon: LucideIcon }
> = {
  [OrderStatus.PENDING]: { label: 'Pending', variant: 'default', icon: Clock },
  [OrderStatus.RUNNING]: { label: 'Running', variant: 'warning', icon: AlertCircle },
  [OrderStatus.COMPLETED]: { label: 'Completed', variant: 'success', icon: CheckCircle },
  [OrderStatus.FAILED]: { label: 'Failed', variant: 'error', icon: XCircle },
  [OrderStatus.CANCELLED]: { label: 'Cancelled', variant: 'default', icon: XCircle },
};

interface InfoItemProps {
  label: string;
  value: string | number;
}

function InfoItem({ label, value }: InfoItemProps): ReactElement {
  return (
    <div>
      <span className="text-gray-400">{label}:</span>{' '}
      <span className="text-bone font-medium">{value}</span>
    </div>
  );
}

export function CafeDashboard(): ReactElement {
  const { getCurrentCafe, setCurrentCafe } = useCafeStore();
  const setView = useViewStore((s) => s.setView);
  const { stageResults } = useOrderStore();
  const currentCafe = getCurrentCafe();
  const [orders, setOrders] = useState<Order[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'kanban'>('kanban');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewOrderDialog, setShowNewOrderDialog] = useState(false);
  const [executeDialogOrder, setExecuteDialogOrder] = useState<Order | null>(null);
  const [modalOrder, setModalOrder] = useState<Order | null>(null);

  // Order에 대한 Stage 정보 생성
  const getStagesForOrder = (orderId: string): StageInfo[] => {
    const results = stageResults[orderId];
    if (!results) return [];
    
    return Object.values(results).map(r => ({
      name: r.stageId,
      status: r.status,
    }));
  };

  // Order에 대한 Timeline 이벤트 생성
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

  // Load orders from API
  useEffect(() => {
    const loadOrders = async () => {
      if (!currentCafe) return;

      try {
        setLoading(true);
        setError(null);
        const response = await window.codecafe.getAllOrders();
        
        if (response.success && response.data) {
          setOrders(response.data);
        } else {
          setError(response.error?.message || 'Failed to load orders');
        }
      } catch (err: any) {
        console.error('[Cafe Dashboard] Failed to load orders:', err);
        setError(err.message || 'Failed to load orders');
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [currentCafe]);

  // Subscribe to order events for real-time updates
  useEffect(() => {
    const handleOrderEvent = (event: any) => {
      console.log('[Cafe Dashboard] Order event:', event);
      window.codecafe.getAllOrders().then((response) => {
        if (response.success && response.data) {
          setOrders(response.data);
        }
      });
    };

    const cleanupOrderEvent = window.codecafe.onOrderEvent(handleOrderEvent);
    const cleanupOrderAssigned = window.codecafe.onOrderAssigned(handleOrderEvent);
    const cleanupOrderCompleted = window.codecafe.onOrderCompleted(handleOrderEvent);

    return () => {
      cleanupOrderEvent?.();
      cleanupOrderAssigned?.();
      cleanupOrderCompleted?.();
    };
  }, []);

  const activeOrdersCount = useMemo(
    () => orders.filter((o) => o.status === OrderStatus.RUNNING).length,
    [orders]
  );

  // Kanban view columns - must be before any conditional returns
  const kanbanColumns = useMemo(() => {
    const cols: Record<OrderStatus, Order[]> = {
      [OrderStatus.PENDING]: [],
      [OrderStatus.RUNNING]: [],
      [OrderStatus.COMPLETED]: [],
      [OrderStatus.FAILED]: [],
      [OrderStatus.CANCELLED]: [],
    };

    orders.forEach((order) => {
      if (cols[order.status]) {
        cols[order.status].push(order);
      }
    });
    return cols;
  }, [orders]);

  if (!currentCafe) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">No cafe selected</div>
      </div>
    );
  }

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-coffee border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400">Loading orders...</p>
        </div>
      </div>
    );
  }

  if (error && orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-bone mb-2">Failed to load orders</h3>
        <p className="text-gray-400 mb-6">{error}</p>
        <Button onClick={() => window.location.reload()} variant="secondary">
          Retry
        </Button>
      </div>
    );
  }

  const handleBackToLobby = (): void => {
    setCurrentCafe(null);
    setView('cafes');
  };

  const handleNewOrder = (): void => {
    setShowNewOrderDialog(true);
  };

  const handleOrderCreated = (orderId: string): void => {
    console.log('[Cafe Dashboard] Order created:', orderId);
    window.codecafe.getAllOrders().then((response) => {
      if (response.success && response.data) {
        setOrders(response.data);
      }
    });
  };

  const handleViewModal = (orderId: string): void => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      setModalOrder(order);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order?')) {
      return;
    }
    try {
      const response = await window.codecafe.order.cancel(orderId);
      if (response.success) {
        setOrders((prevOrders) =>
          prevOrders.map((o) =>
            o.id === orderId ? { ...o, status: OrderStatus.CANCELLED } : o
          )
        );
        setModalOrder(null);
      } else {
        alert(`Failed to cancel order: ${response.error?.message}`);
      }
    } catch (err: any) {
      alert(`Failed to cancel order: ${err.message}`);
    }
  };

  const handleExecuteOrder = (order: Order): void => {
    setExecuteDialogOrder(order);
  };

  const handleExecuteSubmit = async (orderId: string, prompt: string, vars: Record<string, string>): Promise<void> => {
    const response = await window.codecafe.order.execute(orderId, prompt, vars);
    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to execute order');
    }
    const ordersResponse = await window.codecafe.getAllOrders();
    if (ordersResponse.success && ordersResponse.data) {
      setOrders(ordersResponse.data);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Delete this order? This cannot be undone.')) {
      return;
    }
    try {
      const response = await window.codecafe.order.delete(orderId);
      if (response.success) {
        setOrders((prevOrders) => prevOrders.filter((o) => o.id !== orderId));
      } else {
        alert(`Failed to delete order: ${response.error?.message}`);
      }
    } catch (err: any) {
      alert(`Failed to delete order: ${err.message}`);
    }
  };

  const handleClearFinished = async () => {
    const finishedOrders = orders.filter(
      (o) => o.status === OrderStatus.COMPLETED || o.status === OrderStatus.FAILED || o.status === OrderStatus.CANCELLED
    );
    if (finishedOrders.length === 0) {
      alert('No finished orders to clear.');
      return;
    }
    if (!confirm(`Delete ${finishedOrders.length} finished orders?`)) {
      return;
    }
    try {
      const orderIds = finishedOrders.map((o) => o.id);
      const response = await window.codecafe.order.deleteMany(orderIds);
      if (response.success && response.data) {
        setOrders((prevOrders) => prevOrders.filter((o) => !response.data!.deleted.includes(o.id)));
      }
    } catch (err: any) {
      alert(`Failed to clear orders: ${err.message}`);
    }
  };


  return (
    <div className="h-full overflow-auto flex flex-col">
      {/* Header */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={handleBackToLobby}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-bone truncate">{currentCafe.name}</h1>
            <p className="text-xs sm:text-sm text-gray-400 truncate">{currentCafe.path}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle */}
          <div className="flex border border-border rounded overflow-hidden">
            {(['grid', 'kanban'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-2 sm:px-3 py-1 text-xs sm:text-sm capitalize transition-colors ${
                  viewMode === mode
                    ? 'bg-coffee text-bone'
                    : 'bg-background text-gray-400 hover:text-bone'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <Button onClick={handleNewOrder} className="flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Order</span>
            <span className="sm:hidden">New</span>
          </Button>
          <Button
            variant="secondary"
            onClick={handleClearFinished}
            className="text-sm text-red-400 hover:text-red-300"
          >
            <span className="hidden sm:inline">Clear Finished</span>
            <span className="sm:hidden">Clear</span>
          </Button>
        </div>
      </div>

      {/* Cafe Info */}
      <div className="mb-4 p-3 bg-card border border-border rounded">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm">
          <InfoItem label="Branch" value={currentCafe.currentBranch} />
          <InfoItem label="Active Orders" value={activeOrdersCount} />
          <InfoItem label="Base Branch" value={currentCafe.settings.baseBranch} />
        </div>
      </div>

      {/* Orders */}
      <div className="flex-1 overflow-auto">
        {orders.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No Orders Yet"
            description="Create your first order to get started"
            action={
              <Button onClick={handleNewOrder} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                New Order
              </Button>
            }
          />
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.map((order) => (
              <NewOrderCard
                key={order.id}
                order={order}
                stages={getStagesForOrder(order.id)}
                onView={handleViewModal}
                onCancel={handleCancelOrder}
                onDelete={handleDeleteOrder}
                onExecute={(orderId) => {
                  const o = orders.find(x => x.id === orderId);
                  if (o) handleExecuteOrder(o);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 h-full">
            {(Object.entries(kanbanColumns) as [OrderStatus, Order[]][]).map(([status, ordersList]) => {
              const config = STATUS_CONFIG[status];
              return (
                <div key={status} className="flex flex-col min-w-0">
                  <div className="mb-3 pb-2 border-b border-border">
                    <h3 className="font-semibold text-bone text-sm sm:text-base">{config.label}</h3>
                    <p className="text-xs sm:text-sm text-gray-400">{ordersList.length} orders</p>
                  </div>
                  <div className="space-y-3 overflow-auto">
                    {ordersList.map((order) => (
                      <NewOrderCard
                        key={order.id}
                        order={order}
                        stages={getStagesForOrder(order.id)}
                        onView={handleViewModal}
                        onCancel={handleCancelOrder}
                        onDelete={handleDeleteOrder}
                        onExecute={(orderId) => {
                          const o = orders.find(x => x.id === orderId);
                          if (o) handleExecuteOrder(o);
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Order Modal */}
      {modalOrder && (
        <OrderModal
          isOpen={!!modalOrder}
          onClose={() => setModalOrder(null)}
          order={modalOrder}
          stages={getStagesForOrder(modalOrder.id)}
          timelineEvents={getTimelineForOrder(modalOrder.id)}
          onSendInput={async (msg) => {
            await window.codecafe.order.sendInput(modalOrder.id, msg);
          }}
        />
      )}

      {/* New Order Dialog */}
      <NewOrderDialog
        isOpen={showNewOrderDialog}
        onClose={() => setShowNewOrderDialog(false)}
        cafeId={currentCafe.id}
        onSuccess={handleOrderCreated}
      />

      {/* Execute Order Dialog */}
      <OrderExecuteDialog
        isOpen={executeDialogOrder !== null}
        onClose={() => setExecuteDialogOrder(null)}
        onExecute={handleExecuteSubmit}
        order={executeDialogOrder}
      />
    </div>
  );
}
