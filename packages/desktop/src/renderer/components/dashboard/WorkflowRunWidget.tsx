import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { cn } from '../../utils/cn';
import { formatRelativeTime, truncate } from '../../utils/formatters';
import type { RunProgress } from '../../types/window';

interface WorkflowRunWidgetProps {
  runs: RunProgress[];
  isLoading: boolean;
}

export function WorkflowRunWidget({ runs, isLoading }: WorkflowRunWidgetProps): JSX.Element {
  const stageStatusClass = (status: RunProgress['stages'][number]['status']): string => {
    const styles: Record<string, string> = {
      pending: 'bg-border/60 text-gray-400',
      running: 'bg-blue-500/10 text-blue-400',
      completed: 'bg-green-500/10 text-green-400',
      failed: 'bg-red-500/10 text-red-400',
    };
    return styles[status] || 'bg-border/60 text-gray-400';
  };

  return (
    <Card className="lg:col-span-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-coffee">Workflow Runs</h3>
        {isLoading && <span className="text-xs text-gray-500">Refreshing...</span>}
      </div>
      {runs.length === 0 ? (
        <EmptyState message="No workflow runs yet" />
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
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
  );
}
