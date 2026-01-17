import { type ReactElement } from 'react';
import { CheckCircle, Circle, Loader2, XCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

export type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface StageInfo {
  name: string;
  status: StageStatus;
}

interface OrderStageProgressProps {
  stages: StageInfo[];
  currentStage?: string;
  className?: string;
}

function getStageIcon(status: StageStatus): ReactElement {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'running':
      return <Loader2 className="w-4 h-4 text-coffee animate-spin" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'skipped':
      return <Circle className="w-4 h-4 text-gray-500" />;
    case 'pending':
    default:
      return <Circle className="w-4 h-4 text-gray-600" />;
  }
}

function getStageColor(status: StageStatus): string {
  switch (status) {
    case 'completed':
      return 'bg-green-500/20 border-green-500/50 text-green-400';
    case 'running':
      return 'bg-coffee/20 border-coffee/50 text-coffee';
    case 'failed':
      return 'bg-red-500/20 border-red-500/50 text-red-400';
    case 'skipped':
      return 'bg-gray-500/20 border-gray-500/50 text-gray-400';
    case 'pending':
    default:
      return 'bg-gray-700/50 border-gray-600 text-gray-400';
  }
}

export function OrderStageProgress({
  stages,
  currentStage,
  className,
}: OrderStageProgressProps): ReactElement {
  if (stages.length === 0) {
    return (
      <div className={cn('text-sm text-gray-500', className)}>
        No stages defined
      </div>
    );
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {stages.map((stage, index) => {
        const isCurrentStage = stage.name === currentStage;

        return (
          <div key={stage.name} className="flex items-center gap-1">
            <div
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium transition-all',
                getStageColor(stage.status),
                isCurrentStage && 'ring-2 ring-coffee/30'
              )}
            >
              {getStageIcon(stage.status)}
              <span>{stage.name}</span>
            </div>
            {index < stages.length - 1 && (
              <div className="w-4 h-px bg-gray-600" />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface OrderStageProgressBarProps {
  stages: StageInfo[];
  className?: string;
}

export function OrderStageProgressBar({
  stages,
  className,
}: OrderStageProgressBarProps): ReactElement {
  const completed = stages.filter((s) => s.status === 'completed').length;
  const failed = stages.filter((s) => s.status === 'failed').length;
  const running = stages.filter((s) => s.status === 'running').length;
  const total = stages.length;

  const completedPercent = (completed / total) * 100;
  const runningPercent = (running / total) * 100;
  const failedPercent = (failed / total) * 100;

  return (
    <div className={cn('w-full', className)}>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>
          {completed}/{total} completed
          {running > 0 && `, ${running} running`}
          {failed > 0 && `, ${failed} failed`}
        </span>
        <span>{Math.round(completedPercent)}%</span>
      </div>
      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden flex">
        <div
          className="h-full bg-green-500 transition-all duration-300"
          style={{ width: `${completedPercent}%` }}
        />
        <div
          className="h-full bg-coffee transition-all duration-300"
          style={{ width: `${runningPercent}%` }}
        />
        <div
          className="h-full bg-red-500 transition-all duration-300"
          style={{ width: `${failedPercent}%` }}
        />
      </div>
    </div>
  );
}
