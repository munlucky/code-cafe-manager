import { useEffect, useMemo, useState } from 'react';
import { useOrders } from '../../hooks/useOrders';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { cn } from '../../utils/cn';
import { formatDate, formatRelativeTime, truncate } from '../../utils/formatters';
import type { Receipt } from '../../types/models';
import type { RunLogEntry, RunProgress } from '../../types/window';

export function OrderDetail() {
  const { orders, fetchOrders, getOrderLog, cancelOrder, createOrder } = useOrders();
  const [detailMode, setDetailMode] = useState<'orders' | 'runs'>('orders');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [logText, setLogText] = useState('');
  const [logLoading, setLogLoading] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [isStopping, setIsStopping] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [workflowRuns, setWorkflowRuns] = useState<RunProgress[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runLogs, setRunLogs] = useState<RunLogEntry[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runLogsLoading, setRunLogsLoading] = useState(false);
  const [isResuming, setIsResuming] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    if (detailMode !== 'runs') {
      return;
    }

    fetchRuns();
    const timer = setInterval(fetchRuns, 4000);
    return () => {
      clearInterval(timer);
    };
  }, [detailMode]);

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

  useEffect(() => {
    if (detailMode !== 'runs') {
      return;
    }

    if (sortedRuns.length === 0) {
      setSelectedRunId(null);
      return;
    }

    const exists = sortedRuns.some((run) => run.runId === selectedRunId);
    if (!selectedRunId || !exists) {
      setSelectedRunId(sortedRuns[0].runId);
    }
  }, [detailMode, sortedRuns, selectedRunId]);

  const selectedOrder = useMemo(() => {
    return sortedOrders.find((order) => order.id === selectedOrderId) || null;
  }, [sortedOrders, selectedOrderId]);

  const fetchRuns = async () => {
    setRunsLoading(true);
    try {
      const runs = await window.codecafe.listRuns();
      setWorkflowRuns(runs);
    } catch (error) {
      console.error('Failed to fetch workflow runs:', error);
      setWorkflowRuns([]);
    } finally {
      setRunsLoading(false);
    }
  };

  const sortedRuns = useMemo(() => {
    return [...workflowRuns].sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [workflowRuns]);

  const selectedRun = useMemo(() => {
    return sortedRuns.find((run) => run.runId === selectedRunId) || null;
  }, [sortedRuns, selectedRunId]);

  const interruptedRuns = useMemo(() => {
    return sortedRuns.filter(
      (run) => run.status === 'failed' || run.status === 'paused'
    );
  }, [sortedRuns]);

  const activeRuns = useMemo(() => {
    return sortedRuns.filter(
      (run) => run.status !== 'failed' && run.status !== 'paused'
    );
  }, [sortedRuns]);

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

  const loadRunLogs = async (runId: string) => {
    setRunLogsLoading(true);
    try {
      const logs = await window.codecafe.getRunLogs(runId);
      setRunLogs(logs);
    } catch (error) {
      console.error('Failed to load run logs:', error);
      setRunLogs([]);
    } finally {
      setRunLogsLoading(false);
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
    if (detailMode !== 'runs') {
      return;
    }

    if (!selectedRunId) {
      setRunLogs([]);
      return;
    }

    let active = true;
    const refresh = async () => {
      if (!active) return;
      await loadRunLogs(selectedRunId);
    };

    refresh();

    if (selectedRun?.status !== 'running') {
      return () => {
        active = false;
      };
    }

    const timer = setInterval(refresh, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [detailMode, selectedRunId, selectedRun?.status]);

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

  const nodeStatusByStage = useMemo(() => {
    const byStage: Record<string, Record<string, string>> = {};

    runLogs.forEach((log) => {
      if (!log.stage || !log.nodeId) {
        return;
      }

      if (!byStage[log.stage]) {
        byStage[log.stage] = {};
      }

      let status = byStage[log.stage][log.nodeId] || 'pending';
      if (log.type === 'node_start') {
        status = 'running';
      } else if (log.type === 'node_end') {
        status = 'completed';
      } else if (log.type === 'error') {
        status = 'failed';
      }

      byStage[log.stage][log.nodeId] = status;
    });

    return byStage;
  }, [runLogs]);

  const currentStageNodes = useMemo(() => {
    if (!selectedRun?.currentStage) {
      return [];
    }
    const nodes = nodeStatusByStage[selectedRun.currentStage] || {};
    return Object.entries(nodes).map(([nodeId, status]) => ({
      nodeId,
      status,
    }));
  }, [nodeStatusByStage, selectedRun?.currentStage]);

  const stageStatusClass = (status: RunProgress['stages'][number]['status']) => {
    const styles: Record<string, string> = {
      pending: 'bg-border/60 text-gray-400',
      running: 'bg-blue-500/10 text-blue-400',
      completed: 'bg-green-500/10 text-green-400',
      failed: 'bg-red-500/10 text-red-400',
    };
    return styles[status] || 'bg-border/60 text-gray-400';
  };

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

  const handleResume = async () => {
    if (!selectedRun) return;
    if (!confirm(`Resume run ${selectedRun.runId}?`)) return;

    setIsResuming(true);
    try {
      await window.codecafe.resumeRun(selectedRun.runId);
      await fetchRuns();
    } catch (error) {
      alert(`Failed to resume run: ${error}`);
    } finally {
      setIsResuming(false);
    }
  };

  const canStop =
    selectedOrder?.status === 'PENDING' || selectedOrder?.status === 'RUNNING';
  const canResume =
    selectedRun?.status === 'paused' || selectedRun?.status === 'failed';

  const renderRunItem = (run: RunProgress) => (
    <button
      key={run.runId}
      onClick={() => setSelectedRunId(run.runId)}
      className={cn(
        'w-full text-left px-3 py-3 rounded border transition-colors',
        'bg-background hover:border-coffee/70',
        selectedRunId === run.runId ? 'border-coffee bg-coffee/10' : 'border-border'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-bone">{run.workflowId}</div>
        <StatusBadge status={run.status} />
      </div>
      <div className="text-xs text-gray-500 mt-2 space-y-1">
        <div>ID: {truncate(run.runId, 16)}</div>
        <div>Stage: {run.currentStage}</div>
        <div>
          Updated:{' '}
          {run.updatedAt || run.createdAt
            ? formatRelativeTime(run.updatedAt || run.createdAt)
            : 'Unknown'}
        </div>
      </div>
    </button>
  );

  return (
    <div className="space-y-4 h-full">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={detailMode === 'orders' ? 'primary' : 'secondary'}
          onClick={() => setDetailMode('orders')}
        >
          Orders
        </Button>
        <Button
          type="button"
          variant={detailMode === 'runs' ? 'primary' : 'secondary'}
          onClick={() => setDetailMode('runs')}
        >
          Workflow Runs
        </Button>
      </div>

      {detailMode === 'orders' ? (
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
                      <span className="text-bone">Provider:</span>{' '}
                      {selectedOrder.provider}
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
                    <h4 className="text-lg font-semibold text-coffee mb-2">
                      Receipt
                    </h4>
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
                          <span className="text-bone">
                            {formatDate(receipt.startedAt)}
                          </span>
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
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6 h-full">
          <Card className="flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-coffee">Workflow Runs</h3>
              <Button
                variant="secondary"
                onClick={fetchRuns}
                className="text-xs px-2 py-1"
              >
                Refresh
              </Button>
            </div>

            {runsLoading && <div className="text-xs text-gray-500 mb-2">Loading...</div>}

            {sortedRuns.length === 0 ? (
              <EmptyState message="No workflow runs yet. Start one from New Order." />
            ) : (
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-custom">
                {interruptedRuns.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-wide text-gray-500">
                      Interrupted
                    </div>
                    {interruptedRuns.map(renderRunItem)}
                  </div>
                )}
                {activeRuns.length > 0 && (
                  <div className="space-y-2">
                    {interruptedRuns.length > 0 && (
                      <div className="text-xs uppercase tracking-wide text-gray-500">
                        All Runs
                      </div>
                    )}
                    {activeRuns.map(renderRunItem)}
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card className="flex flex-col min-h-[520px]">
            {!selectedRun ? (
              <EmptyState message="Select a run to view details" />
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-gray-500">
                      Workflow Run
                    </div>
                    <h3 className="text-2xl font-bold text-bone">
                      {selectedRun.workflowId}
                    </h3>
                    <div className="text-xs text-gray-500 mt-1">
                      ID: {selectedRun.runId}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <StatusBadge status={selectedRun.status} />
                    {canResume && (
                      <Button
                        variant="secondary"
                        onClick={handleResume}
                        disabled={isResuming}
                      >
                        {isResuming ? 'Resuming...' : 'Resume'}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                  <div className="space-y-2 text-sm text-gray-500">
                    <div>
                      <span className="text-bone">Stage:</span>{' '}
                      {selectedRun.currentStage}
                    </div>
                    <div>
                      <span className="text-bone">Iteration:</span>{' '}
                      {selectedRun.currentIter}
                    </div>
                    {selectedRun.createdAt && (
                      <div>
                        <span className="text-bone">Created:</span>{' '}
                        {formatDate(selectedRun.createdAt)}
                      </div>
                    )}
                    {selectedRun.updatedAt && (
                      <div>
                        <span className="text-bone">Updated:</span>{' '}
                        {formatDate(selectedRun.updatedAt)}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 text-sm text-gray-500">
                    <div>
                      <span className="text-bone">Run Status:</span>{' '}
                      {selectedRun.status}
                    </div>
                    {selectedRun.lastError && (
                      <div className="text-red-500">Error: {selectedRun.lastError}</div>
                    )}
                  </div>
                </div>

                <div className="space-y-4 flex-1">
                  <div>
                    <h4 className="text-lg font-semibold text-coffee mb-2">
                      Stage Progress
                    </h4>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {selectedRun.stages.map((stage) => (
                        <span
                          key={`${selectedRun.runId}-${stage.name}`}
                          className={cn(
                            'px-2 py-1 rounded uppercase tracking-wide',
                            stageStatusClass(stage.status)
                          )}
                        >
                          {stage.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-lg font-semibold text-coffee">
                        Node Status
                      </h4>
                      {runLogsLoading && (
                        <span className="text-xs text-gray-500">Loading...</span>
                      )}
                    </div>
                    {currentStageNodes.length === 0 ? (
                      <EmptyState message="No node activity yet" />
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {currentStageNodes.map((node) => (
                          <div
                            key={node.nodeId}
                            className="flex items-center justify-between px-3 py-2 bg-background border border-border rounded text-sm"
                          >
                            <span className="text-bone">{node.nodeId}</span>
                            <span
                              className={cn(
                                'text-xs uppercase tracking-wide',
                                node.status === 'completed' && 'text-green-400',
                                node.status === 'running' && 'text-blue-400',
                                node.status === 'failed' && 'text-red-400',
                                node.status === 'pending' && 'text-gray-400'
                              )}
                            >
                              {node.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold text-coffee mb-2">Run Logs</h4>
                    <div className="bg-background border border-border rounded p-3 text-xs font-mono whitespace-pre-wrap max-h-[200px] overflow-y-auto scrollbar-custom">
                      {runLogs.length === 0
                        ? 'No logs yet.'
                        : runLogs
                            .slice(-8)
                            .map((log) => `${log.timestamp} ${log.message}`)
                            .join('\n')}
                    </div>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
