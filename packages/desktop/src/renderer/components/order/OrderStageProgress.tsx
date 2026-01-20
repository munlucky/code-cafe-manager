import { type ReactElement } from 'react';
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
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
      return <CheckCircle2 className="w-4 h-4" />;
    case 'running':
      return <Loader2 className="w-4 h-4 animate-spin" />;
    case 'failed':
      return <XCircle className="w-4 h-4" />;
    case 'skipped':
      return <Circle className="w-4 h-4" />;
    case 'pending':
    default:
      return <Circle className="w-4 h-4" />;
  }
}

function getStageColors(status: StageStatus): { icon: string; border: string; text: string } {
  switch (status) {
    case 'completed':
      return { icon: 'text-emerald-500', border: 'border-emerald-500', text: 'text-emerald-500/80' };
    case 'running':
      return { icon: 'text-brand', border: 'border-brand', text: 'text-brand' };
    case 'failed':
      return { icon: 'text-red-500', border: 'border-red-500', text: 'text-red-400' };
    case 'skipped':
      return { icon: 'text-cafe-600', border: 'border-cafe-700', text: 'text-cafe-500' };
    case 'pending':
    default:
      return { icon: 'text-cafe-600', border: 'border-cafe-700', text: 'text-cafe-500' };
  }
}

export function OrderStageProgress({
  stages,
  currentStage,
  className,
}: OrderStageProgressProps): ReactElement {
  if (stages.length === 0) {
    return (
      <div className={cn('text-sm text-cafe-500', className)}>
        No stages defined
      </div>
    );
  }

  // Calculate progress
  const totalStages = stages.length;
  const completedCount = stages.filter(s => s.status === 'completed').length;
  const progressPercent = totalStages === 0 ? 0 : (completedCount / totalStages) * 100;
  const isFailed = stages.some(s => s.status === 'failed');
  const barColor = isFailed ? 'bg-red-500' : 'bg-brand';

  return (
    <div className={cn('w-full', className)}>
      {/* Header Info */}
      <div className="flex justify-between items-center mb-3 text-xs">
        <span className="font-bold text-cafe-300 uppercase tracking-wider">
          Pipeline Progress
        </span>
        <span className="font-mono text-cafe-500">
          {completedCount}/{totalStages} Stages
        </span>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-cafe-800 rounded-full overflow-hidden mb-6 shadow-inner border border-cafe-700/50">
        <div
          className={cn('h-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(217,119,6,0.5)]', barColor)}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Stage Badges - circular style */}
      <div className="flex justify-between relative">
        {/* Connecting Line (Behind badges) */}
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-cafe-800 -z-0 transform -translate-y-1/2" />

        {stages.map((stage) => {
          const colors = getStageColors(stage.status);
          const isActive = stage.name === currentStage && stage.status === 'running';

          return (
            <div key={stage.name} className="relative z-10 flex flex-col items-center group">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 bg-cafe-900',
                  colors.border,
                  colors.icon,
                  stage.status === 'running' && 'shadow-[0_0_15px_rgba(217,119,6,0.3)]'
                )}
              >
                {getStageIcon(stage.status)}
              </div>

              <span
                className={cn(
                  'absolute top-10 text-[10px] font-bold whitespace-nowrap transition-colors duration-200',
                  isActive ? 'text-brand' : colors.text
                )}
              >
                {stage.name}
              </span>
            </div>
          );
        })}
      </div>
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

  // 현재 실행 중인 stage 찾기
  const runningStageIndex = stages.findIndex((s) => s.status === 'running');
  const failedStageIndex = stages.findIndex((s) => s.status === 'failed');
  const runningStage = runningStageIndex >= 0 ? stages[runningStageIndex] : null;
  const failedStage = failedStageIndex >= 0 ? stages[failedStageIndex] : null;

  const completedPercent = (completed / total) * 100;
  const runningPercent = (running / total) * 100;
  const failedPercent = (failed / total) * 100;

  // 직관적인 진행 상태 메시지 생성
  const getStatusMessage = (): string => {
    if (failed > 0 && failedStage) {
      return `Stage ${failedStageIndex + 1}/${total} failed: ${failedStage.name}`;
    }
    if (running > 0 && runningStage) {
      return `Stage ${runningStageIndex + 1}/${total}: ${runningStage.name}`;
    }
    if (completed === total) {
      return `All ${total} stages completed`;
    }
    return `${completed}/${total} completed`;
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="flex justify-between text-xs text-cafe-400 mb-1">
        <span>{getStatusMessage()}</span>
        <span>{Math.round(completedPercent)}%</span>
      </div>
      <div className="w-full h-2 bg-cafe-800 rounded-full overflow-hidden flex border border-cafe-700/50">
        <div
          className="h-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${completedPercent}%` }}
        />
        <div
          className="h-full bg-brand transition-all duration-300"
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
