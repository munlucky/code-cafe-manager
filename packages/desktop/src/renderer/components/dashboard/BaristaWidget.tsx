import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import type { Barista } from '../../types/models';

interface BaristaWidgetProps {
  baristas: Barista[];
}

export function BaristaWidget({ baristas }: BaristaWidgetProps): JSX.Element {
  return (
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
  );
}
