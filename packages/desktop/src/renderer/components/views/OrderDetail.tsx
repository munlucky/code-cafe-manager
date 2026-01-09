import { useEffect, useMemo, useState } from 'react';
import { useOrders } from '../../hooks/useOrders';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { cn } from '../../utils/cn';
import { formatDate, formatRelativeTime, truncate } from '../../utils/formatters';
import type { Receipt } from '../../types/models';

export function OrderDetail() {
  const { orders, fetchOrders, getOrderLog, cancelOrder, createOrder } = useOrders();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [logText, setLogText] = useState('');
  const [logLoading, setLogLoading] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [isStopping, setIsStopping] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

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

  const loadLog = async (orderId: string) => {
    setLogLoading(true);
    try {
      const log = await getOrderLog(orderId);
      setLogText(log || '');
    } catch (error) {
      setLogText(`Failed to load log: ${error}`);
    } finally {
      setLogLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedOrderId) {
      setLogText('');
      return;
    }

    let active = true;
    const refresh = async () => {
      if (!active) return;
      await loadLog(selectedOrderId);
    };

    refresh();

    const shouldPoll =
      selectedOrder?.status === 'RUNNING' || selectedOrder?.status === 'PENDING';
    if (!shouldPoll) {
      return () => {
        active = false;
      };
    }

    const timer = setInterval(refresh, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selectedOrderId, selectedOrder?.status]);

  useEffect(() => {
    if (!selectedOrderId) {
      setReceipt(null);
      return;
    }

    let active = true;
    const loadReceipt = async () => {
      try {
        const receipts = await window.codecafe.getReceipts();
        if (!active) return;
        const matches = receipts
          .filter((r) => r.orderId === selectedOrderId)
          .sort((a, b) => {
            const aTime = new Date(a.endedAt || a.startedAt).getTime();
            const bTime = new Date(b.endedAt || b.startedAt).getTime();
            return bTime - aTime;
          });
        setReceipt(matches[0] || null);
      } catch (error) {
        if (active) {
          console.error('Failed to load receipts:', error);
          setReceipt(null);
        }
      }
    };

    loadReceipt();
    return () => {
      active = false;
    };
  }, [selectedOrderId, selectedOrder?.status]);

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
        recipeId: selectedOrder.recipeId,
        recipeName: selectedOrder.recipeName,
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

  const canStop =
    selectedOrder?.status === 'PENDING' || selectedOrder?.status === 'RUNNING';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6 h-full">
      <Card className="flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-coffee">Orders</h3>
          <Button
            variant="secondary"
            onClick={fetchOrders}
            className="text-xs px-2 py-1"
          >
            Refresh
          </Button>
        </div>

        {sortedOrders.length === 0 ? (
          <EmptyState message="No orders yet. Create one from New Order tab." />
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-custom">
            {sortedOrders.map((order) => (
              <button
                key={order.id}
                onClick={() => setSelectedOrderId(order.id)}
                className={cn(
                  'w-full text-left px-3 py-3 rounded border transition-colors',
                  'bg-background hover:border-coffee/70',
                  selectedOrderId === order.id
                    ? 'border-coffee bg-coffee/10'
                    : 'border-border'
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-bone">
                    {order.recipeName}
                  </div>
                  <StatusBadge status={order.status} />
                </div>
                <div className="text-xs text-gray-500 mt-2 space-y-1">
                  <div>ID: {truncate(order.id, 16)}</div>
                  <div>Provider: {order.provider}</div>
                  <div>Created: {formatRelativeTime(order.createdAt)}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card className="flex flex-col min-h-[520px]">
        {!selectedOrder ? (
          <EmptyState message="Select an order to view details" />
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  Order Detail
                </div>
                <h3 className="text-2xl font-bold text-bone">
                  {selectedOrder.recipeName}
                </h3>
                <div className="text-xs text-gray-500 mt-1">
                  ID: {selectedOrder.id}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <StatusBadge status={selectedOrder.status} />
                {canStop && (
                  <Button
                    variant="secondary"
                    onClick={handleStop}
                    disabled={isStopping}
                    className="bg-red-700 hover:bg-red-600"
                  >
                    {isStopping ? 'Stopping...' : 'Stop'}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={handleRestart}
                  disabled={isRestarting}
                >
                  {isRestarting ? 'Restarting...' : 'Restart'}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <div className="space-y-2 text-sm text-gray-500">
                <div>
                  <span className="text-bone">Provider:</span> {selectedOrder.provider}
                </div>
                <div>
                  <span className="text-bone">Counter:</span> {selectedOrder.counter}
                </div>
                <div>
                  <span className="text-bone">Barista:</span>{' '}
                  {selectedOrder.baristaId || 'Not assigned'}
                </div>
                {selectedOrder.worktreeInfo && (
                  <div className="mt-3 space-y-1 text-xs text-gray-500">
                    <div>Worktree Path: {selectedOrder.worktreeInfo.path}</div>
                    <div>Branch: {selectedOrder.worktreeInfo.branch}</div>
                    <div>Base Branch: {selectedOrder.worktreeInfo.baseBranch}</div>
                  </div>
                )}
              </div>
              <div className="space-y-2 text-sm text-gray-500">
                <div>
                  <span className="text-bone">Created:</span>{' '}
                  {formatDate(selectedOrder.createdAt)}
                </div>
                {selectedOrder.startedAt && (
                  <div>
                    <span className="text-bone">Started:</span>{' '}
                    {formatDate(selectedOrder.startedAt)}
                  </div>
                )}
                {selectedOrder.endedAt && (
                  <div>
                    <span className="text-bone">Ended:</span>{' '}
                    {formatDate(selectedOrder.endedAt)}
                  </div>
                )}
                {selectedOrder.error && (
                  <div className="text-red-500">Error: {selectedOrder.error}</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-1">
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-lg font-semibold text-coffee">Live Log</h4>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => selectedOrderId && loadLog(selectedOrderId)}
                      className="text-xs px-2 py-1"
                    >
                      Refresh
                    </Button>
                    {logLoading && (
                      <span className="text-xs text-gray-500">Loading...</span>
                    )}
                  </div>
                </div>
                <div className="flex-1 bg-background border border-border rounded p-3 overflow-y-auto scrollbar-custom text-xs font-mono whitespace-pre-wrap">
                  {logText || 'No logs yet.'}
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  {selectedOrder.status === 'RUNNING' ||
                  selectedOrder.status === 'PENDING'
                    ? 'Auto-refreshing every 2s while running.'
                    : 'Log auto-refresh paused.'}
                </div>
              </div>

              <div className="flex flex-col">
                <h4 className="text-lg font-semibold text-coffee mb-2">Receipt</h4>
                {receipt ? (
                  <div className="bg-background border border-border rounded p-3 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Status</span>
                      <span
                        className={cn(
                          'font-semibold',
                          receipt.status === 'COMPLETED'
                            ? 'text-green-500'
                            : 'text-red-500'
                        )}
                      >
                        {receipt.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Provider</span>
                      <span className="text-bone">{receipt.provider}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Counter</span>
                      <span className="text-bone">{receipt.counter}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Started</span>
                      <span className="text-bone">{formatDate(receipt.startedAt)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Ended</span>
                      <span className="text-bone">{formatDate(receipt.endedAt)}</span>
                    </div>
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
                          {receipt.changedFiles.map((file) => (
                            <li key={file}>{file}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {receipt.logs && (
                      <div>
                        <div className="text-gray-500 mb-1">Log Tail</div>
                        <pre className="text-xs font-mono whitespace-pre-wrap text-bone">
                          {receipt.logs}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <EmptyState message="No receipt available yet" />
                )}
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
