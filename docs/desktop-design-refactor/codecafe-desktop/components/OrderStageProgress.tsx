import React from 'react';
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import { StageStatus } from '../types';

interface OrderStageProgressProps {
  stages: string[];
  currentStage: string;
  stageStatuses: Record<string, StageStatus>;
}

export const OrderStageProgress: React.FC<OrderStageProgressProps> = ({ stages, currentStage, stageStatuses }) => {
  // Calculate progress percentage
  const totalStages = stages.length;
  const completedCount = stages.filter(s => stageStatuses[s] === 'completed').length;
  const progressPercent = totalStages === 0 ? 0 : (completedCount / totalStages) * 100;
  
  // Determine bar color based on overall state
  const isFailed = Object.values(stageStatuses).includes('failed');
  const barColor = isFailed ? 'bg-red-500' : 'bg-brand';

  return (
    <div className="w-full">
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
          className={`h-full transition-all duration-500 ease-out ${barColor} shadow-[0_0_10px_rgba(217,119,6,0.5)]`}
          style={{ width: `${progressPercent}%` }}
        ></div>
      </div>

      {/* Stage Badges */}
      <div className="flex justify-between relative">
        {/* Connecting Line (Behind badges) */}
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-cafe-800 -z-0 transform -translate-y-1/2"></div>
        
        {stages.map((stage, index) => {
          const status = stageStatuses[stage] || 'pending';
          const isActive = stage === currentStage && status === 'running';
          
          return (
            <div key={stage} className="relative z-10 flex flex-col items-center group">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300
                ${status === 'completed' ? 'bg-cafe-900 border-emerald-500 text-emerald-500' : 
                  status === 'running' ? 'bg-cafe-900 border-brand text-brand shadow-[0_0_15px_rgba(217,119,6,0.3)]' : 
                  status === 'failed' ? 'bg-cafe-900 border-red-500 text-red-500' :
                  'bg-cafe-900 border-cafe-700 text-cafe-600'}
              `}>
                {status === 'completed' && <CheckCircle2 className="w-4 h-4" />}
                {status === 'running' && <Loader2 className="w-4 h-4 animate-spin" />}
                {status === 'failed' && <XCircle className="w-4 h-4" />}
                {status === 'pending' && <Circle className="w-4 h-4" />}
              </div>
              
              <span className={`
                absolute top-10 text-[10px] font-bold whitespace-nowrap transition-colors duration-200
                ${isActive ? 'text-brand' : status === 'completed' ? 'text-emerald-500/80' : 'text-cafe-500'}
              `}>
                {stage}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};