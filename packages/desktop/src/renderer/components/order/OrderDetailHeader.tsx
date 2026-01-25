/**
 * OrderDetailHeader component - displays order header with actions
 */

import React, { memo } from 'react';
import {
  Terminal as TerminalIcon,
  Box,
  List,
  MessageSquarePlus,
  XCircle,
  Trash2,
} from 'lucide-react';
import type { DesignOrder } from '../../types/design';
import { StatusBadge } from '../ui/StatusBadge';

interface OrderDetailHeaderProps {
  order: DesignOrder;
  viewMode: 'logs' | 'timeline';
  isFollowupMode: boolean;
  onViewModeChange: (mode: 'logs' | 'timeline') => void;
  onEnterFollowup: () => void;
  onFinishFollowup: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

export const OrderDetailHeader: React.FC<OrderDetailHeaderProps> = memo(
  function OrderDetailHeader({
    order,
    viewMode,
    isFollowupMode,
    onViewModeChange,
    onEnterFollowup,
    onFinishFollowup,
    onCancel,
    onDelete,
  }) {
    const isCompleted = order.status === 'COMPLETED';
    const isRunningOrWaiting =
      order.status === 'RUNNING' || order.status === 'WAITING_INPUT';

    return (
      <div className="h-16 border-b border-cafe-800 flex items-center justify-between px-6 bg-cafe-900 shadow-md z-10">
        <div className="flex items-center space-x-4">
          <div className="flex flex-col">
            <div className="flex items-center">
              <h2 className="font-bold text-cafe-100 mr-3 text-lg">
                Order #{order.id.substring(0, 8)}
              </h2>
              <StatusBadge status={order.status} size="lg" />
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Worktree info */}
          {order.worktreeInfo && (
            <div className="flex items-center px-3 py-1.5 bg-cafe-950 rounded-lg border border-cafe-800 shadow-inner">
              <Box className="w-3.5 h-3.5 text-brand mr-2" />
              <span className="text-xs text-cafe-300 font-mono">
                {order.worktreeInfo.path.split('/').pop()}
              </span>
            </div>
          )}

          {/* View Mode Toggle */}
          <div className="flex border border-cafe-700 rounded-lg overflow-hidden">
            <button
              onClick={() => onViewModeChange('logs')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === 'logs'
                  ? 'bg-brand text-white'
                  : 'bg-cafe-900 text-cafe-400 hover:text-white'
              }`}
            >
              <TerminalIcon className="w-3.5 h-3.5" />
              Logs
            </button>
            <button
              onClick={() => onViewModeChange('timeline')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === 'timeline'
                  ? 'bg-brand text-white'
                  : 'bg-cafe-900 text-cafe-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Timeline
            </button>
          </div>

          <div className="h-6 w-px bg-cafe-800 mx-2" />

          {/* Followup Buttons */}
          {isCompleted && !isFollowupMode && (
            <button
              onClick={onEnterFollowup}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center gap-1.5"
              title="Continue with followup commands"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              Continue
            </button>
          )}
          {isFollowupMode && (
            <button
              onClick={onFinishFollowup}
              className="px-3 py-1.5 text-xs font-medium bg-cafe-700 hover:bg-cafe-600 text-white rounded-lg transition-colors flex items-center gap-1.5"
              title="Finish followup mode"
            >
              <XCircle className="w-3.5 h-3.5" />
              Finish
            </button>
          )}

          {/* Cancel Button */}
          {isRunningOrWaiting && (
            <button
              onClick={onCancel}
              className="p-2 text-cafe-500 hover:text-yellow-400 hover:bg-yellow-900/10 rounded-lg transition-colors"
              title="Cancel Order"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}

          {/* Delete Button */}
          <button
            onClick={onDelete}
            className="p-2 text-cafe-500 hover:text-red-400 hover:bg-red-900/10 rounded-lg transition-colors"
            title="Delete Order & Worktree"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }
);
