import { useEffect, useMemo, useState } from 'react';
import { useOrders } from '../../hooks/useOrders';
import { useViewStore } from '../../store/useViewStore';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { formatRelativeTime } from '../../utils/formatters';
import type { Order } from '../../types/models';
import { OrderStatus } from '@codecafe/core';
import { OrderExecuteDialog } from '../order/OrderExecuteDialog';
import { OrderDetailView } from '../order/OrderDetailView';

interface OrderItemProps {
  order: Order;
  onViewLog: (orderId: string) => void;
  onCancel: (orderId: string) => void;
  onViewDetail: (order: Order) => void;
  onExecute: (order: Order) => void;
}

function OrderItem({ order, onViewLog, onCancel, onViewDetail, onExecute }: OrderItemProps): JSX.Element {
  const isCancellable = order.status === OrderStatus.PENDING || order.status === OrderStatus.RUNNING;
  const isRunning = order.status === OrderStatus.RUNNING;
  const isPending = order.status === OrderStatus.PENDING;

  return (
    <div className="p-3 sm:p-4 bg-background rounded border border-border">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
            <strong className="text-bone text-base sm:text-lg truncate">{order.workflowName}</strong>
            <StatusBadge status={order.status} />
          </div>
          <div className="text-xs sm:text-sm text-gray-500 space-y-1">
            <div className="truncate">ID: {order.id}</div>
            <div>Provider: {order.provider}</div>
            <div>Barista: {order.baristaId || 'Not assigned'}</div>
            <div>Created: {formatRelativeTime(order.createdAt)}</div>
            {order.worktreeInfo && (
              <div className="mt-2 p-2 bg-bone/5 rounded border border-border/50">
                <div className="text-xs font-medium text-coffee mb-1">Worktree Info</div>
                <div>Branch: <span className="text-bone font-mono">{order.worktreeInfo.branch}</span></div>
                <div className="truncate">Path: <span className="text-bone font-mono text-xs">{order.worktreeInfo.path}</span></div>
              </div>
            )}
            {order.error && (
              <div className="text-red-500 mt-2 font-medium">Error: {order.error}</div>
            )}
          </div>
        </div>
        <div className="flex flex-row sm:flex-col gap-2 flex-wrap">
          {isPending && (
            <Button variant="primary" onClick={() => onExecute(order)} className="text-sm">
              ▶ Execute
            </Button>
          )}
          {isRunning && (
            <Button variant="primary" onClick={() => onViewDetail(order)} className="text-sm">
              View Terminal
            </Button>
          )}
          {!isPending && !isRunning && (
            <Button variant="secondary" onClick={() => onViewDetail(order)} className="text-sm">
              View Details
            </Button>
          )}
          <Button variant="secondary" onClick={() => onViewLog(order.id)} className="text-sm">
            View Log
          </Button>
          {isCancellable && (
            <Button
              variant="secondary"
              onClick={() => onCancel(order.id)}
              className="bg-red-700 hover:bg-red-600 text-sm"
            >
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Orders(): JSX.Element {
  const { orders, fetchOrders, getOrderLog, cancelOrder, executeOrder } = useOrders();
  const [executeDialogOrder, setExecuteDialogOrder] = useState<Order | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

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
    } catch (error) {
      alert(`Failed to cancel order: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function handleViewDetail(order: Order): void {
    setSelectedOrder(order);
  }

  function handleOpenExecuteDialog(order: Order): void {
    setExecuteDialogOrder(order);
  }

  async function handleExecuteOrder(orderId: string, prompt: string, vars: Record<string, string>): Promise<void> {
    await executeOrder(orderId, prompt, vars);
    // To avoid a race condition, fetch the specific order directly
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
      <Card className="p-3 sm:p-4">
        <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-coffee">All Orders</h3>
        <div className="space-y-2 sm:space-y-3">
          {sortedOrders.map((order) => (
            <OrderItem
              key={order.id}
              order={order}
              onViewLog={handleViewLog}
              onCancel={handleCancel}
              onViewDetail={handleViewDetail}
              onExecute={handleOpenExecuteDialog}
            />
          ))}
        </div>
      </Card>

      <OrderExecuteDialog
        isOpen={executeDialogOrder !== null}
        onClose={() => setExecuteDialogOrder(null)}
        onExecute={handleExecuteOrder}
        order={executeDialogOrder}
      />
    </>
  );
}
