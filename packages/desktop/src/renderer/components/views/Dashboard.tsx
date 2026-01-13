import { useEffect, useState } from 'react';
import { useBaristas } from '../../hooks/useBaristas';
import { useOrders } from '../../hooks/useOrders';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { TerminalPoolStatus } from '../terminal/TerminalPoolStatus';
import { cn } from '../../utils/cn';
import { formatRelativeTime, truncate } from '../../utils/formatters';
import type { RunProgress } from '../../types/window';

export function Dashboard() {
  const { baristas, fetchBaristas } = useBaristas();
  const { orders, fetchOrders } = useOrders();
  const [workflowRuns, setWorkflowRuns] = useState<RunProgress[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);

  useEffect(() => {
    fetchBaristas();
    fetchOrders();
  }, []);

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

  useEffect(() => {
    fetchRuns();
    const timer = setInterval(fetchRuns, 4000);
    return () => clearInterval(timer);
  }, []);

  const recentOrders = [...orders].reverse().slice(0, 5);
  const recentRuns = [...workflowRuns]
    .sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    })
    .slice(0, 5);

  const stageStatusClass = (status: RunProgress['stages'][number]['status']) => {
    const styles: Record<string, string> = {
      pending: 'bg-border/60 text-gray-400',
      running: 'bg-blue-500/10 text-blue-400',
      completed: 'bg-green-500/10 text-green-400',
      failed: 'bg-red-500/10 text-red-400',
    };
    return styles[status] || 'bg-border/60 text-gray-400';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card>
        <h3 className="text-xl font-bold mb-4 text-coffee">Baristas</h3>
        {baristas.length === 0 ? (
          <EmptyState message="No baristas yet" />
        ) : (
          <div className="space-y-3">
            {baristas.slice(0, 5).map((barista) => (
              <div
                key={barista.id}
                className="flex items-center justify-between p-3 bg-background rounded border border-border"
              >
                <div>
                  <strong className="text-bone">{barista.provider}</strong>
                  <div className="text-xs text-gray-500 mt-1">ID: {barista.id}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Current Order: {barista.currentOrderId || 'None'}
                  </div>
                </div>
                <StatusBadge status={barista.status} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <TerminalPoolStatus />

      <Card>
        <h3 className="text-xl font-bold mb-4 text-coffee">Recent Orders</h3>
        {recentOrders.length === 0 ? (
          <EmptyState message="No orders yet" />
        ) : (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-3 bg-background rounded border border-border"
              >
                <div>
                  <strong className="text-bone">{order.workflowName}</strong>
                  <div className="text-xs text-gray-500 mt-1">
                    Provider: {order.provider}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Started: {order.startedAt ? formatRelativeTime(order.startedAt) : 'Not started'}
                  </div>
                  {order.endedAt && (
                    <div className="text-xs text-gray-500 mt-1">
                      Ended: {formatRelativeTime(order.endedAt)}
                    </div>
                  )}
                  {order.error && (
                    <div className="text-xs text-red-500 mt-1">
                      Error: {order.error}
                    </div>
                  )}
                </div>
                <StatusBadge status={order.status} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="lg:col-span-3">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-coffee">Workflow Runs</h3>
          {runsLoading && <span className="text-xs text-gray-500">Refreshing...</span>}
        </div>
        {recentRuns.length === 0 ? (
          <EmptyState message="No workflow runs yet" />
        ) : (
          <div className="space-y-3">
            {recentRuns.map((run) => (
              <div
                key={run.runId}
                className="flex flex-col gap-2 p-3 bg-background rounded border border-border"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <strong className="text-bone">
                      {run.workflowId} · {truncate(run.runId, 12)}
                    </strong>
                    <div className="text-xs text-gray-500 mt-1">
                      Stage: {run.currentStage} · Iter {run.currentIter}
                    </div>
                  </div>
                  <StatusBadge status={run.status} />
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {run.stages.map((stage) => (
                    <span
                      key={`${run.runId}-${stage.name}`}
                      className={cn('px-2 py-1 rounded uppercase tracking-wide', stageStatusClass(stage.status))}
                    >
                      {stage.name}
                    </span>
                  ))}
                </div>
                {run.lastError && (
                  <div className="text-xs text-red-500">Error: {run.lastError}</div>
                )}
                {(run.updatedAt || run.createdAt) && (
                  <div className="text-xs text-gray-500">
                    Updated: {formatRelativeTime(run.updatedAt || run.createdAt || '')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
