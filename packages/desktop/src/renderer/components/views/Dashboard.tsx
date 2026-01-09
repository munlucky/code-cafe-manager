import { useEffect } from 'react';
import { useBaristas } from '../../hooks/useBaristas';
import { useOrders } from '../../hooks/useOrders';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { formatRelativeTime } from '../../utils/formatters';

export function Dashboard() {
  const { baristas, fetchBaristas } = useBaristas();
  const { orders, fetchOrders } = useOrders();

  useEffect(() => {
    fetchBaristas();
    fetchOrders();
  }, []);

  const recentOrders = [...orders].reverse().slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <h3 className="text-xl font-bold mb-4 text-coffee">Baristas</h3>
        {baristas.length === 0 ? (
          <EmptyState message="No baristas yet" />
        ) : (
          <div className="space-y-3">
            {baristas.slice(0, 5).map((barista) => (
              <div
                key={barista.id}
                className="flex items-center justify-between p-3 bg-background rounded border border-border"
              >
                <div>
                  <strong className="text-bone">{barista.provider}</strong>
                  <div className="text-xs text-gray-500 mt-1">ID: {barista.id}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Current Order: {barista.currentOrderId || 'None'}
                  </div>
                </div>
                <StatusBadge status={barista.status} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="text-xl font-bold mb-4 text-coffee">Recent Orders</h3>
        {recentOrders.length === 0 ? (
          <EmptyState message="No orders yet" />
        ) : (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-3 bg-background rounded border border-border"
              >
                <div>
                  <strong className="text-bone">{order.recipeName}</strong>
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
    </div>
  );
}
