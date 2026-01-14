import { useEffect, useMemo } from 'react';
import { useOrders } from '../../hooks/useOrders';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { formatRelativeTime } from '../../utils/formatters';
import type { Order } from '../../types/models';

interface OrderItemProps {
  order: Order;
  onViewLog: (orderId: string) => void;
  onCancel: (orderId: string) => void;
}

function OrderItem({ order, onViewLog, onCancel }: OrderItemProps): JSX.Element {
  const isCancellable = order.status === 'PENDING' || order.status === 'RUNNING';

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
            {order.error && (
              <div className="text-red-500 mt-2 font-medium">Error: {order.error}</div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
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
          />
        ))}
      </div>
    </Card>
  );
}
