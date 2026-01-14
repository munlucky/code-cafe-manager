/**
 * Cafe Dashboard View
 * Order management for a specific Cafe
 */

import { useEffect, useState, useMemo, type ReactElement } from 'react';
import {
  Plus,
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react';
import { OrderStatus } from '@codecafe/core';
import type { Order } from '@codecafe/core';

import { useCafeStore } from '../../store/useCafeStore';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';

// Mock orders data (Phase 1)
const MOCK_ORDERS_DATA: Order[] = [
  {
    id: 'order-001',
    workflowId: 'feature-implementation',
    workflowName: 'Feature Implementation',
    baristaId: 'barista-001',
    status: OrderStatus.RUNNING,
    counter: '/path/to/cafe/worktree-1',
    provider: 'claude-code',
    vars: {
      feature: 'User Authentication',
      description: 'Implement JWT-based authentication',
    },
    createdAt: new Date('2026-01-12T09:00:00.000Z'),
    startedAt: new Date('2026-01-12T09:01:00.000Z'),
    endedAt: null,
    worktreeInfo: {
      path: '/path/to/cafe/.codecafe-worktrees/feature-auth',
      branch: 'feature/auth',
      baseBranch: 'main',
    },
  },
  {
    id: 'order-002',
    workflowId: 'bug-fix',
    workflowName: 'Bug Fix',
    baristaId: 'barista-002',
    status: OrderStatus.COMPLETED,
    counter: '/path/to/cafe/worktree-2',
    provider: 'codex',
    vars: {
      issue: 'Memory leak in event handler',
      severity: 'high',
    },
    createdAt: new Date('2026-01-12T08:00:00.000Z'),
    startedAt: new Date('2026-01-12T08:05:00.000Z'),
    endedAt: new Date('2026-01-12T08:45:00.000Z'),
    worktreeInfo: {
      path: '/path/to/cafe/.codecafe-worktrees/fix-memory-leak',
      branch: 'fix/memory-leak',
      baseBranch: 'main',
    },
  },
  {
    id: 'order-003',
    workflowId: 'refactor',
    workflowName: 'Code Refactoring',
    baristaId: null,
    status: OrderStatus.PENDING,
    counter: '/path/to/cafe',
    provider: 'claude-code',
    vars: {
      target: 'Database layer',
      goal: 'Extract to separate module',
    },
    createdAt: new Date('2026-01-12T10:00:00.000Z'),
    startedAt: null,
    endedAt: null,
  },
  {
    id: 'order-004',
    workflowId: 'feature-implementation',
    workflowName: 'Feature Implementation',
    baristaId: 'barista-003',
    status: OrderStatus.RUNNING,
    counter: '/path/to/cafe/worktree-3',
    provider: 'claude-code',
    vars: {
      feature: 'Dark Mode',
      description: 'Add theme toggle with localStorage persistence',
    },
    createdAt: new Date('2026-01-12T09:30:00.000Z'),
    startedAt: new Date('2026-01-12T09:35:00.000Z'),
    endedAt: null,
    worktreeInfo: {
      path: '/path/to/cafe/.codecafe-worktrees/feature-dark-mode',
      branch: 'feature/dark-mode',
      baseBranch: 'main',
    },
  },
  {
    id: 'order-005',
    workflowId: 'test-coverage',
    workflowName: 'Test Coverage Improvement',
    baristaId: 'barista-004',
    status: OrderStatus.FAILED,
    counter: '/path/to/cafe/worktree-4',
    provider: 'codex',
    vars: {
      module: 'User Service',
      targetCoverage: '90%',
    },
    createdAt: new Date('2026-01-12T07:00:00.000Z'),
    startedAt: new Date('2026-01-12T07:10:00.000Z'),
    endedAt: new Date('2026-01-12T07:55:00.000Z'),
    error: 'Test execution failed: TypeError in mock setup',
    worktreeInfo: {
      path: '/path/to/cafe/.codecafe-worktrees/test-user-service',
      branch: 'test/user-service',
      baseBranch: 'main',
    },
  },
];

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; variant: 'default' | 'success' | 'error' | 'warning'; icon: LucideIcon }
> = {
  [OrderStatus.PENDING]: { label: 'Pending', variant: 'default', icon: Clock },
  [OrderStatus.RUNNING]: { label: 'Running', variant: 'warning', icon: AlertCircle },
  [OrderStatus.COMPLETED]: { label: 'Completed', variant: 'success', icon: CheckCircle },
  [OrderStatus.FAILED]: { label: 'Failed', variant: 'error', icon: XCircle },
  [OrderStatus.CANCELLED]: { label: 'Cancelled', variant: 'default', icon: XCircle },
};

interface OrderCardProps {
  order: Order;
}

function OrderCard({ order }: OrderCardProps): ReactElement {
  const config = STATUS_CONFIG[order.status];
  const Icon = config.icon;

  return (
    <Card className="p-4 hover:border-coffee transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-bone mb-1">{order.workflowName}</h3>
          <p className="text-sm text-gray-400">ID: {order.id}</p>
        </div>
        <Badge variant={config.variant} className="flex items-center gap-1">
          <Icon className="w-3 h-3" />
          {config.label}
        </Badge>
      </div>

      {Object.keys(order.vars).length > 0 && (
        <div className="mb-3 space-y-1">
          {Object.entries(order.vars).map(([key, value]) => (
            <div key={key} className="text-sm">
              <span className="text-gray-400">{key}:</span>{' '}
              <span className="text-bone">{String(value)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mb-2 text-sm">
        <span className="text-gray-400">Provider:</span>
        <span className="text-bone">{order.provider}</span>
      </div>

      <div className="text-xs text-gray-500 space-y-1">
        <div>Created: {new Date(order.createdAt).toLocaleString()}</div>
        {order.startedAt && <div>Started: {new Date(order.startedAt).toLocaleString()}</div>}
        {order.endedAt && <div>Ended: {new Date(order.endedAt).toLocaleString()}</div>}
      </div>

      {order.error && (
        <div className="mt-3 p-2 bg-red-900/20 border border-red-500/50 rounded text-red-300 text-xs">
          {order.error}
        </div>
      )}
    </Card>
  );
}

interface OrderListProps {
  orders: Order[];
  onNewOrder: () => void;
}

function OrderList({ orders, onNewOrder }: OrderListProps): ReactElement {
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title="No Orders Yet"
        description="Create your first order to get started"
        action={
          <Button onClick={onNewOrder} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Order
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}

interface OrderKanbanProps {
  orders: Order[];
}

function OrderKanban({ orders }: OrderKanbanProps): ReactElement {
  const columns = useMemo(() => {
    const cols: Record<OrderStatus, Order[]> = {
      [OrderStatus.PENDING]: [],
      [OrderStatus.RUNNING]: [],
      [OrderStatus.COMPLETED]: [],
      [OrderStatus.FAILED]: [],
      [OrderStatus.CANCELLED]: [],
    };

    orders.forEach((order) => {
      if (cols[order.status]) {
        cols[order.status].push(order);
      }
    });
    return cols;
  }, [orders]);

  return (
    <div className="grid grid-cols-5 gap-4 h-full">
      {(Object.entries(columns) as [OrderStatus, Order[]][]).map(([status, ordersList]) => {
        const config = STATUS_CONFIG[status];
        return (
          <div key={status} className="flex flex-col">
            <div className="mb-3 pb-2 border-b border-border">
              <h3 className="font-semibold text-bone">{config.label}</h3>
              <p className="text-sm text-gray-400">{ordersList.length} orders</p>
            </div>
            <div className="space-y-3 overflow-auto">
              {ordersList.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface InfoItemProps {
  label: string;
  value: string | number;
}

function InfoItem({ label, value }: InfoItemProps): ReactElement {
  return (
    <div>
      <span className="text-gray-400">{label}:</span>{' '}
      <span className="text-bone font-medium">{value}</span>
    </div>
  );
}

export function CafeDashboard(): ReactElement {
  const { getCurrentCafe, setCurrentCafe } = useCafeStore();
  const currentCafe = getCurrentCafe();
  const [orders, setOrders] = useState<Order[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  useEffect(() => {
    // Phase 1: Load mock orders
    setOrders(MOCK_ORDERS_DATA);
  }, [currentCafe]);

  const activeOrdersCount = useMemo(
    () => orders.filter((o) => o.status === OrderStatus.RUNNING).length,
    [orders]
  );

  if (!currentCafe) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">No cafe selected</div>
      </div>
    );
  }

  const handleBackToLobby = (): void => {
    setCurrentCafe(null);
  };

  const handleNewOrder = (): void => {
    console.log('[Cafe Dashboard] New Order clicked (placeholder)');
  };

  return (
    <div className="p-6 h-full overflow-auto flex flex-col">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={handleBackToLobby}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-bone">{currentCafe.name}</h1>
            <p className="text-sm text-gray-400">{currentCafe.path}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex border border-border rounded overflow-hidden">
            {(['list', 'kanban'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 text-sm capitalize transition-colors ${
                  viewMode === mode
                    ? 'bg-coffee text-bone'
                    : 'bg-background text-gray-400 hover:text-bone'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <Button onClick={handleNewOrder} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Order
          </Button>
        </div>
      </div>

      {/* Cafe Info */}
      <div className="mb-4 p-3 bg-card border border-border rounded flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <InfoItem label="Branch" value={currentCafe.currentBranch} />
          <InfoItem label="Active Orders" value={activeOrdersCount} />
          <InfoItem label="Base Branch" value={currentCafe.settings.baseBranch} />
        </div>
      </div>

      {/* Orders */}
      <div className="flex-1 overflow-auto">
        {viewMode === 'list' ? (
          <OrderList orders={orders} onNewOrder={handleNewOrder} />
        ) : (
          <OrderKanban orders={orders} />
        )}
      </div>
    </div>
  );
}
