import { useEffect, useMemo } from 'react';
import { useOrders } from '../../hooks/useOrders';
import { useViewStore } from '../../store/useViewStore';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { formatRelativeTime } from '../../utils/formatters';
import type { Order } from '../../types/models';
import { OrderStatus } from '@codecafe/core';

interface OrderItemProps {
  order: Order;
  onViewLog: (orderId: string) => void;
  onCancel: (orderId: string) => void;
  onViewTerminal: (orderId: string) => void;
}

function OrderItem({ order, onViewLog, onCancel, onViewTerminal }: OrderItemProps): JSX.Element {
  const isCancellable = order.status === OrderStatus.PENDING || order.status === OrderStatus.RUNNING;
  const isRunning = order.status === OrderStatus.RUNNING;

  return (
    <div className="p-4 bg-background rounded border border-border">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <strong className="text-bone text-lg">{order.workflowName}</strong>
            <StatusBadge status={order.status} />
          </div>
          <div className="text-sm text-gray-500 space-y-1">
            <div>ID: {order.id}</div>
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
        <div className="flex flex-col gap-2">
          {isRunning && (
            <Button variant="primary" onClick={() => onViewTerminal(order.id)}>
              View Terminal
            </Button>
          )}
          <Button variant="secondary" onClick={() => onViewLog(order.id)}>
            View Log
          </Button>
          {isCancellable && (
            <Button
              variant="secondary"
              onClick={() => onCancel(order.id)}
              className="bg-red-700 hover:bg-red-600"
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
  const { orders, fetchOrders, getOrderLog, cancelOrder } = useOrders();
  const setView = useViewStore((s) => s.setView);

  useEffect(() => {
    fetchOrders();
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
    } catch (error) {
      alert(`Failed to cancel order: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function handleViewTerminal(orderId: string): void {
    setView('terminals');
  }

  if (orders.length === 0) {
    return (
      <Card>
        <EmptyState message="No orders yet. Create one from New Order tab." />
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="text-xl font-bold mb-4 text-coffee">All Orders</h3>
      <div className="space-y-3">
        {sortedOrders.map((order) => (
          <OrderItem
            key={order.id}
            order={order}
            onViewLog={handleViewLog}
            onCancel={handleCancel}
            onViewTerminal={handleViewTerminal}
          />
        ))}
      </div>
    </Card>
  );
}
