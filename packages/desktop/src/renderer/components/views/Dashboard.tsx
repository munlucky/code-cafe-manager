import { useEffect, useState } from 'react';
import { useBaristas } from '../../hooks/useBaristas';
import { useOrders } from '../../hooks/useOrders';
import { TerminalPoolStatus } from '../terminal/TerminalPoolStatus';
import { BaristaWidget } from '../dashboard/BaristaWidget';
import { OrderWidget } from '../dashboard/OrderWidget';
import { WorkflowRunWidget } from '../dashboard/WorkflowRunWidget';
import type { RunProgress } from '../../types/window';

export function Dashboard(): JSX.Element {
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <BaristaWidget baristas={baristas} />

      <TerminalPoolStatus />

      <OrderWidget orders={recentOrders} />

      <WorkflowRunWidget runs={recentRuns} isLoading={runsLoading} />
    </div>
  );
}
