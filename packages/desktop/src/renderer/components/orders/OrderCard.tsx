import { type ReactElement } from 'react';
import { Clock, Play, X, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/Badge';
import { OrderStageProgressBar, type StageInfo } from '../order/OrderStageProgress';
import { formatRelativeTime } from '../../utils/formatters';
import type { Order } from '../../types/models';
import { OrderStatus } from '../../types/models';

interface OrderCardProps {
  order: Order;
  stages?: StageInfo[];
  onView: (orderId: string) => void;
  onCancel: (orderId: string) => void;
  onExecute?: (orderId: string) => void;
  onDelete?: (orderId: string) => void;
}

export function OrderCard({
  order,
  stages = [],
  onView,
  onCancel,
  onExecute,
  onDelete,
}: OrderCardProps): ReactElement {
  const isRunning = order.status === OrderStatus.RUNNING;
  const isPending = order.status === OrderStatus.PENDING;
  const isCancellable = isPending || isRunning;
  const isDeletable = order.status === OrderStatus.COMPLETED 
    || order.status === OrderStatus.FAILED 
    || order.status === OrderStatus.CANCELLED;
  
  const handleCardClick = () => {
    onView(order.id);
  };

  return (
    <Card 
      className="flex flex-col p-4 bg-gray-800 border border-border hover:bg-gray-700/50 hover:border-coffee/50 transition-colors shadow-md group h-full cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="overflow-hidden mr-2">
          <h3 className="text-base font-bold text-bone mb-1 line-clamp-1 group-hover:text-coffee transition-colors" title={order.workflowName}>
            {order.workflowName}
          </h3>
          <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
            <span>{order.id.slice(0, 8)}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {order.startedAt ? formatRelativeTime(order.startedAt) : formatRelativeTime(order.createdAt)}
            </span>
          </div>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Progress */}
      <div className="mb-4 flex-1">
        {stages.length > 0 ? (
          <div className="space-y-2">
             <div className="flex justify-between text-xs text-gray-400">
               <span>Progress</span>
               <span>{Math.round((stages.filter(s => s.status === 'completed').length / stages.length) * 100)}%</span>
             </div>
             <OrderStageProgressBar stages={stages} />
          </div>
        ) : (
          <div className="mt-2 text-xs text-gray-600 italic">No stages info</div>
        )}
      </div>

      {/* Footer / Actions */}
      <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-700/50">
        <div className="text-xs text-gray-500">
           {order.provider && <span className="text-gray-400 font-medium">{order.provider}</span>}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Execute Button for Pending */}
          {isPending && onExecute && (
            <Button
              variant="primary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onExecute(order.id);
              }}
              className="h-8 text-xs gap-1.5 bg-green-600 hover:bg-green-500"
            >
              <Play className="w-3.5 h-3.5" />
              Execute
            </Button>
          )}

          {/* Cancel Button for running/pending */}
          {isCancellable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onCancel(order.id);
              }}
              className="text-gray-400 hover:text-red-400 hover:bg-red-500/10 p-2 h-8 w-8"
              title="Cancel Order"
            >
              <X className="w-4 h-4" />
            </Button>
          )}

          {/* Delete Button for completed/failed/cancelled */}
          {isDeletable && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(order.id);
              }}
              className="text-gray-400 hover:text-red-400 hover:bg-red-500/10 p-2 h-8 w-8"
              title="Delete Order"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
