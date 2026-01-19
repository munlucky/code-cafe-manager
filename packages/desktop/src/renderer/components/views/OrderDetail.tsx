import { useEffect, useMemo, useState, useCallback } from 'react';
import { useOrders } from '../../hooks/useOrders';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { cn } from '../../utils/cn';
import { formatDate, formatRelativeTime, truncate } from '../../utils/formatters';
import type { Order, Receipt } from '../../types/models';

// --- Types & Interfaces ---

interface OrderSidebarProps {
  orders: Order[];
  selectedOrderId: string | null;
  onSelect: (id: string) => void;
  onRefresh: () => void;
}

interface OrderViewProps {
  order: Order | null;
  onStop: () => Promise<void>;
  onRestart: () => Promise<void>;
  isStopping: boolean;
  isRestarting: boolean;
}


// --- Custom Hooks ---

function useOrderLog(orderId: string | null, status?: string) {
  const [logText, setLogText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { getOrderLog } = useOrders();

  const loadLog = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const log = await getOrderLog(id);
      setLogText(log || '');
    } catch (error) {
      setLogText(`Failed to load log: ${error}`);
    } finally {
      setIsLoading(false);
    }
  }, [getOrderLog]);

  useEffect(() => {
    if (!orderId) {
      setLogText('');
      return;
    }

    loadLog(orderId);

    const shouldPoll = status === 'RUNNING' || status === 'PENDING';
    if (!shouldPoll) return;

    const timer = setInterval(() => loadLog(orderId), 2000);
    return () => clearInterval(timer);
  }, [orderId, status, loadLog]);

  return { logText, isLoading, refresh: () => orderId && loadLog(orderId) };
}

function useOrderReceipt(orderId: string | null, status?: string) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  useEffect(() => {
    if (!orderId) {
      setReceipt(null);
      return;
    }

    let isMounted = true;
    const loadReceipt = async () => {
      try {
        const response = await window.codecafe.getReceipts();
        if (!isMounted) return;
        const matches = (response.data || [])
          .filter((r) => r.orderId === orderId)
          .sort((a, b) => {
            const aTime = new Date(a.endedAt || a.startedAt).getTime();
            const bTime = new Date(b.endedAt || b.startedAt).getTime();
            return bTime - aTime;
          });
        setReceipt(matches[0] || null);
      } catch (error) {
        if (isMounted) {
          console.error('Failed to load receipts:', error);
          setReceipt(null);
        }
      }
    };

    loadReceipt();
    return () => {
      isMounted = false;
    };
  }, [orderId, status]);

  return receipt;
}

// --- Helper UI Components ---

function InfoRow({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <span className="text-gray-500">{label}</span>
      <span className="text-bone">{value}</span>
    </div>
  );
}

function SidebarItem({
  id,
  title,
  status,
  subtitle,
  active,
  onClick
}: {
  id: string;
  title: string;
  status: string;
  subtitle: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-3 rounded border transition-colors',
        'bg-background hover:border-coffee/70',
        active ? 'border-coffee bg-coffee/10' : 'border-border'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-bone">{title}</div>
        <StatusBadge status={status} />
      </div>
      <div className="text-xs text-gray-500 mt-2 space-y-1">
        <div>ID: {truncate(id, 16)}</div>
        {subtitle}
      </div>
    </button>
  );
}

// --- Main Sub-components ---

function OrderSidebar({ orders, selectedOrderId, onSelect, onRefresh }: OrderSidebarProps): JSX.Element {
  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-coffee">Orders</h3>
        <Button variant="secondary" onClick={onRefresh} className="text-xs px-2 py-1">
          Refresh
        </Button>
      </div>

      {orders.length === 0 ? (
        <EmptyState message="No orders yet. Create one from New Order tab." />
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-custom">
          {orders.map((order) => (
            <SidebarItem
              key={order.id}
              id={order.id}
              title={order.workflowName}
              status={order.status}
              subtitle={
                <>
                  <div>Provider: {order.provider}</div>
                  <div>Created: {formatRelativeTime(order.createdAt)}</div>
                </>
              }
              active={selectedOrderId === order.id}
              onClick={() => onSelect(order.id)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function OrderDetailView({ order, onStop, onRestart, isStopping, isRestarting }: OrderViewProps): JSX.Element {
  const { logText, isLoading: logLoading, refresh: refreshLog } = useOrderLog(order?.id || null, order?.status);
  const receipt = useOrderReceipt(order?.id || null, order?.status);

  if (!order) {
    return (
      <Card className="flex flex-col min-h-[300px] lg:min-h-[520px]">
        <EmptyState message="Select an order to view details" />
      </Card>
    );
  }

  const canStop = order.status === 'PENDING' || order.status === 'RUNNING';

  return (
    <Card className="flex flex-col min-h-[300px] lg:min-h-[520px] p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-gray-500">Order Detail</div>
          <h3 className="text-lg sm:text-2xl font-bold text-bone truncate">{order.workflowName}</h3>
          <div className="text-xs text-gray-500 mt-1 truncate">ID: {order.id}</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={order.status} />
          {canStop && (
            <Button
              variant="secondary"
              onClick={onStop}
              disabled={isStopping}
              className="bg-red-700 hover:bg-red-600 text-sm"
            >
              {isStopping ? 'Stopping...' : 'Stop'}
            </Button>
          )}
          <Button variant="secondary" onClick={onRestart} disabled={isRestarting} className="text-sm">
            {isRestarting ? 'Restarting...' : 'Restart'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="space-y-2 text-sm text-gray-500">
          <div><span className="text-bone">Provider:</span> {order.provider}</div>
          <div><span className="text-bone">Counter:</span> {order.counter}</div>
          <div><span className="text-bone">Barista:</span> {order.baristaId || 'Not assigned'}</div>
          {order.worktreeInfo && (
            <div className="mt-3 space-y-1 text-xs text-gray-500">
              <div>Worktree Path: {order.worktreeInfo.path}</div>
              <div>Branch: {order.worktreeInfo.branch}</div>
              <div>Base Branch: {order.worktreeInfo.baseBranch}</div>
            </div>
          )}
        </div>
        <div className="space-y-2 text-sm text-gray-500">
          <div><span className="text-bone">Created:</span> {formatDate(order.createdAt)}</div>
          {order.startedAt && <div><span className="text-bone">Started:</span> {formatDate(order.startedAt)}</div>}
          {order.endedAt && <div><span className="text-bone">Ended:</span> {formatDate(order.endedAt)}</div>}
          {order.error && <div className="text-red-500">Error: {order.error}</div>}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-1">
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-lg font-semibold text-coffee">Live Log</h4>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={refreshLog} className="text-xs px-2 py-1">
                Refresh
              </Button>
              {logLoading && <span className="text-xs text-gray-500">Loading...</span>}
            </div>
          </div>
          <div className="flex-1 bg-background border border-border rounded p-3 overflow-y-auto scrollbar-custom text-xs font-mono whitespace-pre-wrap">
            {logText || 'No logs yet.'}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {order.status === 'RUNNING' || order.status === 'PENDING'
              ? 'Auto-refreshing every 2s while running.'
              : 'Log auto-refresh paused.'}
          </div>
        </div>

        <div className="flex flex-col">
          <h4 className="text-lg font-semibold text-coffee mb-2">Receipt</h4>
          {receipt ? (
            <div className="bg-background border border-border rounded p-3 space-y-3 text-sm">
              <InfoRow
                label="Status"
                value={<span className={receipt.status === 'COMPLETED' ? 'text-green-500' : 'text-red-500'}>{receipt.status}</span>}
              />
              <InfoRow label="Provider" value={receipt.provider} />
              <InfoRow label="Counter" value={receipt.counter} />
              <InfoRow label="Started" value={formatDate(receipt.startedAt)} />
              <InfoRow label="Ended" value={formatDate(receipt.endedAt)} />

              {receipt.errorSummary && (
                <div>
                  <div className="text-gray-500 mb-1">Error Summary</div>
                  <div className="text-red-500">{receipt.errorSummary}</div>
                </div>
              )}
              {receipt.changedFiles && receipt.changedFiles.length > 0 && (
                <div>
                  <div className="text-gray-500 mb-1">Changed Files</div>
                  <ul className="text-xs text-bone space-y-1">
                    {receipt.changedFiles.map((file) => <li key={file}>{file}</li>)}
                  </ul>
                </div>
              )}
              {receipt.logs && (
                <div>
                  <div className="text-gray-500 mb-1">Log Tail</div>
                  <pre className="text-xs font-mono whitespace-pre-wrap text-bone">{receipt.logs}</pre>
                </div>
              )}
            </div>
          ) : (
            <EmptyState message="No receipt available yet" />
          )}
        </div>
      </div>
    </Card>
  );
}

// --- Main Component ---

export function OrderDetail(): JSX.Element {
  const { orders, fetchOrders, cancelOrder, createOrder } = useOrders();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isStopping, setIsStopping] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });
  }, [orders]);

  useEffect(() => {
    if (sortedOrders.length === 0) {
      setSelectedOrderId(null);
      return;
    }
    const exists = sortedOrders.some((order) => order.id === selectedOrderId);
    if (!selectedOrderId || !exists) {
      setSelectedOrderId(sortedOrders[0].id);
    }
  }, [sortedOrders, selectedOrderId]);

  const selectedOrder = useMemo(() => {
    return sortedOrders.find((order) => order.id === selectedOrderId) || null;
  }, [sortedOrders, selectedOrderId]);

  const handleStop = async () => {
    if (!selectedOrder) return;
    if (!confirm(`Stop order ${selectedOrder.id}?`)) return;

    setIsStopping(true);
    try {
      await cancelOrder(selectedOrder.id);
      await fetchOrders();
    } catch (error) {
      alert(`Failed to stop order: ${error}`);
    } finally {
      setIsStopping(false);
    }
  };

  const handleRestart = async () => {
    if (!selectedOrder) return;
    if (!confirm('Restart this order? A new order will be created.')) return;

    setIsRestarting(true);
    try {
      await createOrder({
        workflowId: selectedOrder.workflowId,
        workflowName: selectedOrder.workflowName,
        counter: selectedOrder.counter,
        provider: selectedOrder.provider,
        vars: selectedOrder.vars || {},
      });
      await fetchOrders();
    } catch (error) {
      alert(`Failed to restart order: ${error}`);
    } finally {
      setIsRestarting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] xl:grid-cols-[320px_1fr] gap-4 lg:gap-6 h-full">
      <OrderSidebar
        orders={sortedOrders}
        selectedOrderId={selectedOrderId}
        onSelect={setSelectedOrderId}
        onRefresh={fetchOrders}
      />
      <OrderDetailView
        order={selectedOrder}
        onStop={handleStop}
        onRestart={handleRestart}
        isStopping={isStopping}
        isRestarting={isRestarting}
      />
    </div>
  );
}
