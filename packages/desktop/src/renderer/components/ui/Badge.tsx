import { cn } from '../../utils/cn';
import type { BaristaStatus, OrderStatus } from '../../types/models';

const STATUS_STYLES: Record<string, string> = {
  IDLE: 'border-l-4 border-green-500 bg-green-500/10',
  idle: 'border-l-4 border-green-500 bg-green-500/10',
  RUNNING: 'border-l-4 border-blue-500 bg-blue-500/10',
  running: 'border-l-4 border-blue-500 bg-blue-500/10',
  COMPLETED: 'border-l-4 border-green-500 bg-green-500/10',
  completed: 'border-l-4 border-green-500 bg-green-500/10',
  PENDING: 'border-l-4 border-gray-500 bg-gray-500/10',
  pending: 'border-l-4 border-gray-500 bg-gray-500/10',
  ERROR: 'border-l-4 border-red-500 bg-red-500/10',
  error: 'border-l-4 border-red-500 bg-red-500/10',
  FAILED: 'border-l-4 border-red-500 bg-red-500/10',
  failed: 'border-l-4 border-red-500 bg-red-500/10',
  CANCELLED: 'border-l-4 border-gray-500 bg-gray-500/10',
  STOPPED: 'border-l-4 border-gray-500 bg-gray-500/10',
};

export function StatusBadge({
  status,
}: {
  status: BaristaStatus | OrderStatus | string;
}) {
  return (
    <div
      className={cn(
        'inline-block px-3 py-1 rounded text-sm font-semibold',
        STATUS_STYLES[status] || 'border-l-4 border-gray-500 bg-gray-500/10'
      )}
    >
      {status}
    </div>
  );
}
