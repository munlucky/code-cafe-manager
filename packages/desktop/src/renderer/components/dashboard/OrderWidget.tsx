import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { formatRelativeTime } from '../../utils/formatters';
import type { Order } from '../../types/models';

interface OrderWidgetProps {
  orders: Order[];
}

export function OrderWidget({ orders }: OrderWidgetProps): JSX.Element {
  return (
    <Card>
      <h3 className="text-xl font-bold mb-4 text-coffee">Recent Orders</h3>
      {orders.length === 0 ? (
        <EmptyState message="No orders yet" />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between p-3 bg-background rounded border border-border"
            >
              <div>
                <strong className="text-bone">{order.workflowName}</strong>
                <div className="text-xs text-gray-500 mt-1">
                  Provider: {order.provider}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Started: {order.startedAt ? formatRelativeTime(order.startedAt) : 'Not started'}
                </div>
                {order.endedAt && (
                  <div className="text-xs text-gray-500 mt-1">
                    Ended: {formatRelativeTime(order.endedAt)}
                  </div>
                )}
                {order.error && (
                  <div className="text-xs text-red-500 mt-1">
                    Error: {order.error}
                  </div>
                )}
              </div>
              <StatusBadge status={order.status} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
