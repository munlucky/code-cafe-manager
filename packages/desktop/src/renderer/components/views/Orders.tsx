import { useEffect } from 'react';
import { useOrders } from '../../hooks/useOrders';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { formatRelativeTime } from '../../utils/formatters';

export function Orders() {
  const { orders, fetchOrders, getOrderLog, cancelOrder } = useOrders();

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleViewLog = async (orderId: string) => {
    const log = await getOrderLog(orderId);
    alert(`Order Log:\n\n${log || 'No logs yet'}`);
  };

  const handleCancel = async (orderId: string) => {
    if (confirm(`Cancel order ${orderId}?`)) {
      try {
        await cancelOrder(orderId);
      } catch (error) {
        alert(`Failed to cancel order: ${error}`);
      }
    }
  };

  if (orders.length === 0) {
    return (
      <Card>
        <EmptyState message="No orders yet. Create one from New Order tab." />
      </Card>
    );
  }

  const sortedOrders = [...orders].reverse();

  return (
    <Card>
      <h3 className="text-xl font-bold mb-4 text-coffee">All Orders</h3>
      <div className="space-y-3">
        {sortedOrders.map((order) => (
          <div
            key={order.id}
            className="p-4 bg-background rounded border border-border"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <strong className="text-bone text-lg">{order.recipeName}</strong>
                  <StatusBadge status={order.status} />
                </div>
                <div className="text-sm text-gray-500 space-y-1">
                  <div>ID: {order.id}</div>
                  <div>Provider: {order.provider}</div>
                  <div>Barista: {order.baristaId || 'Not assigned'}</div>
                  <div>Created: {formatRelativeTime(order.createdAt)}</div>
                  {order.error && (
                    <div className="text-red-500 mt-2">Error: {order.error}</div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => handleViewLog(order.id)}>
                  View Log
                </Button>
                {(order.status === 'PENDING' || order.status === 'RUNNING') && (
                  <Button
                    variant="secondary"
                    onClick={() => handleCancel(order.id)}
                    className="bg-red-700 hover:bg-red-600"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
