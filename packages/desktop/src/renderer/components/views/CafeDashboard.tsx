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
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { NewOrderDialog } from '../order/NewOrderDialog';

// Mock data removed in favor of real API 연동


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

interface OrderCardProps {
  order: Order;
  onViewTerminal?: (orderId: string) => void;
  onCancelOrder?: (orderId: string) => void;
  onClick?: (orderId: string) => void;
}

function OrderCard({ order, onViewTerminal, onCancelOrder, onClick }: OrderCardProps): ReactElement {
  const config = STATUS_CONFIG[order.status];
  const Icon = config.icon;
  const isRunning = order.status === OrderStatus.RUNNING;
  const isCancellable = order.status === OrderStatus.RUNNING || order.status === OrderStatus.PENDING;

  return (
    <Card 
      className="p-4 hover:border-coffee transition-colors cursor-pointer"
      onClick={() => onClick?.(order.id)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-bone mb-1">{order.workflowName}</h3>
          <p className="text-sm text-gray-400">ID: {order.id}</p>
        </div>
        <Badge variant={config.variant} className="flex items-center gap-1">
          <Icon className="w-3 h-3" />
          {config.label}
        </Badge>
      </div>

      {Object.keys(order.vars).length > 0 && (
        <div className="mb-3 space-y-1">
          {Object.entries(order.vars).map(([key, value]) => (
            <div key={key} className="text-sm">
              <span className="text-gray-400">{key}:</span>{' '}
              <span className="text-bone">{String(value)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mb-2 text-sm">
        <span className="text-gray-400">Provider:</span>
        <span className="text-bone">{order.provider}</span>
      </div>

      <div className="text-xs text-gray-500 space-y-1">
        <div>Created: {new Date(order.createdAt).toLocaleString()}</div>
        {order.startedAt && <div>Started: {new Date(order.startedAt).toLocaleString()}</div>}
        {order.endedAt && <div>Ended: {new Date(order.endedAt).toLocaleString()}</div>}
      </div>

      {order.error && (
        <div className="mt-3 p-2 bg-red-900/20 border border-red-500/50 rounded text-red-300 text-xs">
          {order.error}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        {isRunning && onViewTerminal && (
          <Button
            variant="primary"
            onClick={() => onViewTerminal(order.id)}
            className="flex-1 text-sm"
          >
            View Terminal
          </Button>
        )}
        {isCancellable && onCancelOrder && (
          <Button
            variant="destructive"
            onClick={() => onCancelOrder(order.id)}
            className="flex-1 text-sm"
          >
            Cancel Order
          </Button>
        )}
      </div>
    </Card>
  );
}

interface OrderListProps {
  orders: Order[];
  onNewOrder: () => void;
  onViewTerminal: (orderId: string) => void;
  onCancelOrder: (orderId: string) => void;
  onClick: (orderId: string) => void;
}

function OrderList({
  orders,
  onNewOrder,
  onViewTerminal,
  onCancelOrder,
  onClick,
}: OrderListProps): ReactElement {
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title="No Orders Yet"
        description="Create your first order to get started"
        action={
          <Button onClick={onNewOrder} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Order
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          onViewTerminal={onViewTerminal}
          onCancelOrder={onCancelOrder}
          onClick={onClick}
        />
      ))}
    </div>
  );
}

interface OrderKanbanProps {
  orders: Order[];
  onViewTerminal: (orderId: string) => void;
  onCancelOrder: (orderId: string) => void;
  onClick: (orderId: string) => void;
}

function OrderKanban({ orders, onViewTerminal, onCancelOrder, onClick }: OrderKanbanProps): ReactElement {
  const columns = useMemo(() => {
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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 h-full">
      {(Object.entries(columns) as [OrderStatus, Order[]][]).map(([status, ordersList]) => {
        const config = STATUS_CONFIG[status];
        return (
          <div key={status} className="flex flex-col min-w-0">
            <div className="mb-3 pb-2 border-b border-border">
              <h3 className="font-semibold text-bone text-sm sm:text-base">{config.label}</h3>
              <p className="text-xs sm:text-sm text-gray-400">{ordersList.length} orders</p>
            </div>
            <div className="space-y-3 overflow-auto">
              {ordersList.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onViewTerminal={onViewTerminal}
                  onCancelOrder={onCancelOrder}
                  onClick={onClick}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
  const currentCafe = getCurrentCafe();
  const [orders, setOrders] = useState<Order[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewOrderDialog, setShowNewOrderDialog] = useState(false);

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
      
      // Reload orders when there's an event
      window.codecafe.getAllOrders().then((response) => {
        if (response.success && response.data) {
          setOrders(response.data);
        }
      });
    };

    const handleOrderAssigned = (data: any) => {
      console.log('[Cafe Dashboard] Order assigned:', data);
      handleOrderEvent(data);
    };

    const handleOrderCompleted = (data: any) => {
      console.log('[Cafe Dashboard] Order completed:', data);
      handleOrderEvent(data);
    };

    // Set up event listeners
    window.codecafe.onOrderEvent(handleOrderEvent);
    window.codecafe.onOrderAssigned(handleOrderAssigned);
    window.codecafe.onOrderCompleted(handleOrderCompleted);

    // Cleanup is handled by the next effect call
  }, []);

  const activeOrdersCount = useMemo(
    () => orders.filter((o) => o.status === OrderStatus.RUNNING).length,
    [orders]
  );

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
    // 오더 목록 새로고침
    window.codecafe.getAllOrders().then((response) => {
      if (response.success && response.data) {
        setOrders(response.data);
      }
    });
  };

  const handleViewTerminal = (orderId: string): void => {
    setView('terminals');
  };

  const handleOrderClick = (orderId: string): void => {
    setView('orders');
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order?')) {
      return;
    }
    try {
      const response = await window.codecafe.order.cancel(orderId);
      if (response.success) {
        // Optimistically update UI or wait for event
        setOrders((prevOrders) =>
          prevOrders.map((o) =>
            o.id === orderId ? { ...o, status: OrderStatus.CANCELLED } : o
          )
        );
      } else {
        alert(`Failed to cancel order: ${response.error?.message}`);
      }
    } catch (err: any) {
      alert(`Failed to cancel order: ${err.message}`);
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
            {(['list', 'kanban'] as const).map((mode) => (
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
        {viewMode === 'list' ? (
          <OrderList
            orders={orders}
            onNewOrder={handleNewOrder}
            onViewTerminal={handleViewTerminal}
            onCancelOrder={handleCancelOrder}
            onClick={handleOrderClick}
          />
        ) : (
          <OrderKanban
            orders={orders}
            onViewTerminal={handleViewTerminal}
            onCancelOrder={handleCancelOrder}
            onClick={handleOrderClick}
          />
        )}
      </div>

      {/* New Order Dialog */}
      <NewOrderDialog
        isOpen={showNewOrderDialog}
        onClose={() => setShowNewOrderDialog(false)}
        cafeId={currentCafe.id}
        onSuccess={handleOrderCreated}
      />
    </div>
  );
}
