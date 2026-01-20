import { cn } from '../../utils/cn';
import type { BaristaStatus, OrderStatus } from '../../types/models';

const DEFAULT_STATUS_STYLE = 'border-l-4 border-cafe-600 bg-cafe-600/10';

const STATUS_STYLES: Record<string, string> = {
  idle: 'border-l-4 border-green-500 bg-green-500/10',
  running: 'border-l-4 border-blue-500 bg-blue-500/10',
  completed: 'border-l-4 border-green-500 bg-green-500/10',
  pending: 'border-l-4 border-cafe-600 bg-cafe-600/10',
  error: 'border-l-4 border-red-500 bg-red-500/10',
  failed: 'border-l-4 border-red-500 bg-red-500/10',
  paused: 'border-l-4 border-yellow-500 bg-yellow-500/10',
  cancelled: 'border-l-4 border-cafe-600 bg-cafe-600/10',
  stopped: 'border-l-4 border-cafe-600 bg-cafe-600/10',
};

export function StatusBadge({
  status,
}: {
  status: BaristaStatus | OrderStatus | string;
}) {
  const safeStatus = status || 'unknown';
  return (
    <div
      className={cn(
        'inline-block px-3 py-1 rounded text-sm font-semibold',
        STATUS_STYLES[safeStatus.toLowerCase()] || DEFAULT_STATUS_STYLE
      )}
    >
      {safeStatus}
    </div>
  );
}

// Generic Badge component with variants
const BADGE_VARIANTS = {
  default: 'bg-cafe-800/50 text-cafe-300 border border-cafe-700',
  cafe: 'bg-cafe-800 text-cafe-100 border border-cafe-700',
  brand: 'bg-brand/20 text-brand border border-brand/30',
  success: 'bg-green-500/10 text-green-300 border border-green-500/30',
  error: 'bg-red-500/10 text-red-300 border border-red-500/30',
  warning: 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/30',
  secondary: 'bg-blue-500/10 text-blue-300 border border-blue-500/30',
  outline: 'bg-transparent text-cafe-300 border border-cafe-700',
};

interface BadgeProps {
  variant?: 'default' | 'cafe' | 'brand' | 'success' | 'error' | 'warning' | 'secondary' | 'outline';
  className?: string;
  children: React.ReactNode;
}

export function Badge({ variant = 'default', className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        BADGE_VARIANTS[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
