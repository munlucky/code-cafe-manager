/**
 * StatusBadge component for displaying order status
 */

import React from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { OrderStatus } from '../../types/design';

interface StatusBadgeProps {
  status: OrderStatus;
  size?: 'sm' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'sm',
}) => {
  const baseClasses = 'flex items-center font-bold rounded-md border';
  const sizeClasses =
    size === 'lg' ? 'text-xs px-2.5 py-1' : 'text-[10px] px-2 py-0.5';
  const iconSize = size === 'lg' ? 'w-3.5 h-3.5' : 'w-3 h-3';

  switch (status) {
    case 'RUNNING':
      return (
        <span
          className={`${baseClasses} ${sizeClasses} text-brand-light bg-brand/10 border-brand/20`}
        >
          <Loader2 className={`mr-1.5 animate-spin ${iconSize}`} /> RUNNING
        </span>
      );
    case 'COMPLETED':
      return (
        <span
          className={`${baseClasses} ${sizeClasses} text-emerald-400 bg-emerald-900/20 border-emerald-900/30`}
        >
          <CheckCircle2 className={`mr-1.5 ${iconSize}`} /> COMPLETED
        </span>
      );
    case 'WAITING_INPUT':
      return (
        <span
          className={`${baseClasses} ${sizeClasses} text-orange-400 bg-orange-900/20 border-orange-900/30`}
        >
          <AlertCircle className={`mr-1.5 ${iconSize}`} /> WAITING INPUT
        </span>
      );
    case 'FAILED':
      return (
        <span
          className={`${baseClasses} ${sizeClasses} text-red-400 bg-red-900/20 border-red-900/30`}
        >
          <AlertCircle className={`mr-1.5 ${iconSize}`} /> FAILED
        </span>
      );
    default:
      return (
        <span
          className={`${baseClasses} ${sizeClasses} text-cafe-500 bg-cafe-800 border-cafe-700`}
        >
          PENDING
        </span>
      );
  }
};
