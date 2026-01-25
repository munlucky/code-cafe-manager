/**
 * OrderList component - displays list of orders in the sidebar
 */

import React, { memo } from 'react';
import { Plus, Coffee, Split } from 'lucide-react';
import type { DesignOrder, Cafe } from '../../types/design';
import { StatusBadge } from '../ui/StatusBadge';
import {
  OrderStageProgressBar,
  type StageInfo,
} from '../order/OrderStageProgress';

interface OrderListProps {
  cafe: Cafe;
  orders: DesignOrder[];
  activeOrderId: string | null;
  onSelectOrder: (orderId: string) => void;
  onCreateClick: () => void;
  getStagesForOrder: (order: DesignOrder) => StageInfo[];
}

const OrderItem = memo(function OrderItem({
  order,
  isActive,
  onSelect,
  stages,
}: {
  order: DesignOrder;
  isActive: boolean;
  onSelect: () => void;
  stages: StageInfo[];
}) {
  return (
    <div
      onClick={onSelect}
      className={`p-4 cursor-pointer transition-all duration-200 border-l-4 ${
        isActive
          ? 'bg-cafe-800 border-brand'
          : 'hover:bg-cafe-800/50 border-transparent'
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-mono text-cafe-500">
          #{order.id.replace(/^order-/, '').substring(0, 8)}
        </span>
        <StatusBadge status={order.status} />
      </div>
      <h3
        className={`text-sm font-semibold mb-1.5 ${isActive ? 'text-white' : 'text-cafe-300'}`}
      >
        {order.workflowName}
      </h3>
      {stages.length > 0 && (
        <div className="mt-2">
          <OrderStageProgressBar stages={stages} />
        </div>
      )}
      {order.worktreeInfo && (
        <div className="flex items-center text-[10px] text-cafe-500 mt-2 bg-cafe-950/50 p-1.5 rounded border border-cafe-800/50">
          <Split className="w-3 h-3 mr-1.5 text-brand/70" />
          <span className="truncate font-mono">
            {order.worktreeInfo.branch}
          </span>
        </div>
      )}
    </div>
  );
});

export const OrderList: React.FC<OrderListProps> = memo(function OrderList({
  cafe,
  orders,
  activeOrderId,
  onSelectOrder,
  onCreateClick,
  getStagesForOrder,
}) {
  return (
    <div className="w-80 border-r border-cafe-800 flex flex-col bg-cafe-900 shadow-xl z-10">
      {/* Header */}
      <div className="p-5 border-b border-cafe-800 bg-cafe-900">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-cafe-100 truncate text-lg tracking-tight">
            {cafe.name}
          </h2>
          <span className="text-[10px] bg-cafe-800 px-2 py-1 rounded-md text-cafe-400 font-mono border border-cafe-700">
            {cafe.settings.baseBranch}
          </span>
        </div>
        <p className="text-xs text-cafe-500 font-mono truncate mb-6 flex items-center opacity-70">
          {cafe.path}
        </p>

        <button
          onClick={onCreateClick}
          className="w-full flex items-center justify-center px-4 py-3 bg-brand hover:bg-brand-hover text-white text-sm rounded-xl transition-all font-bold shadow-lg shadow-brand/20 hover:shadow-brand/40 transform hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Order
        </button>
      </div>

      {/* Order list */}
      <div className="flex-1 overflow-y-auto">
        {orders.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center h-full text-cafe-600">
            <Coffee className="w-8 h-8 mb-3 opacity-20" />
            <span className="text-sm font-medium">No active orders</span>
            <span className="text-xs opacity-60 mt-1">
              Start brewing some code
            </span>
          </div>
        ) : (
          <div className="divide-y divide-cafe-800/50">
            {orders.map((order) => (
              <OrderItem
                key={order.id}
                order={order}
                isActive={activeOrderId === order.id}
                onSelect={() => onSelectOrder(order.id)}
                stages={getStagesForOrder(order)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
