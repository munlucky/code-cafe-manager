/**
 * Order Detail View Component
 * 개별 Order의 상세 정보, Stage 진행, Interactive Terminal을 표시
 */

import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, Terminal, Info, Clock, GitBranch, User } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/Badge';
import { InteractiveTerminal } from './InteractiveTerminal';
import { OrderStageProgress, OrderStageProgressBar, type StageInfo, type StageStatus } from './OrderStageProgress';
import { formatRelativeTime } from '../../utils/formatters';
import type { Order, ExtendedWorkflowInfo } from '../../types/models';
import { OrderStatus } from '../../types/models';

interface OrderDetailViewProps {
  order: Order;
  onBack: () => void;
  onCancel?: (orderId: string) => void;
}

export function OrderDetailView({
  order,
  onBack,
  onCancel,
}: OrderDetailViewProps): JSX.Element {
  const [currentOrder, setCurrentOrder] = useState<Order>(order);
  const [workflow, setWorkflow] = useState<ExtendedWorkflowInfo | null>(null);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const isRunning = currentOrder.status === OrderStatus.RUNNING;
  const isPending = currentOrder.status === OrderStatus.PENDING;
  const isCompleted = currentOrder.status === OrderStatus.COMPLETED;
  const isFailed = currentOrder.status === OrderStatus.FAILED;

  // Workflow 정보 가져오기
  useEffect(() => {
    async function fetchWorkflow() {
      try {
        const response = await window.codecafe.workflow.get(order.workflowId);
        if (response.success && response.data) {
          setWorkflow(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch workflow:', error);
      }
    }
    fetchWorkflow();
  }, [order.workflowId]);

  // 주기적으로 Order 상태 갱신
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await window.codecafe.order.get(order.id);
        if (response.success && response.data) {
          setCurrentOrder(response.data);
        }
      } catch (error) {
        console.error('Failed to refresh order:', error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [order.id]);

  // 실행 진행 이벤트 리스너
  useEffect(() => {
    const cleanup = window.codecafe.order.onOutput((event: any) => {
      if (event.orderId === order.id && event.type === 'system') {
        // Stage 변경 감지 (예: "[STAGE] code" 형식의 메시지)
        const stageMatch = event.content?.match(/\[STAGE\]\s*(\w+)/i);
        if (stageMatch && workflow) {
          const stageName = stageMatch[1].toLowerCase();
          const stageIdx = workflow.stages.findIndex(
            (s) => s.toLowerCase() === stageName
          );
          if (stageIdx >= 0) {
            setCurrentStageIndex(stageIdx);
          }
        }
      }
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [order.id, workflow]);

  // 사용자 입력 전송
  const handleSendInput = useCallback(async (message: string) => {
    const response = await window.codecafe.order.sendInput(order.id, message);
    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to send input');
    }
  }, [order.id]);

  // Stage 정보 계산
  const stages: StageInfo[] = (workflow?.stages || ['Plan', 'Code', 'Test']).map(
    (stageName, index): StageInfo => {
      let status: StageStatus = 'pending';

      if (isCompleted) {
        status = 'completed';
      } else if (isFailed) {
        if (index < currentStageIndex) {
          status = 'completed';
        } else if (index === currentStageIndex) {
          status = 'failed';
        }
      } else if (isRunning) {
        if (index < currentStageIndex) {
          status = 'completed';
        } else if (index === currentStageIndex) {
          status = 'running';
        }
      }

      return {
        name: stageName.charAt(0).toUpperCase() + stageName.slice(1),
        status,
      };
    }
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={onBack} className="p-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-bone">{currentOrder.workflowName}</h2>
              <StatusBadge status={currentOrder.status} />
            </div>
            <div className="text-xs text-gray-500 font-mono">{currentOrder.id}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(isPending || isRunning) && onCancel && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onCancel(currentOrder.id)}
              className="bg-red-700 hover:bg-red-600"
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-4 p-4">
        {/* Left Panel - Order Info */}
        <div className="lg:w-80 flex-shrink-0 space-y-4 overflow-auto">
          {/* Order Info Card */}
          <Card className="p-4">
            <h3 className="text-sm font-medium text-coffee mb-3 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Order Info
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <User className="w-4 h-4 text-gray-500 mt-0.5" />
                <div>
                  <div className="text-gray-400">Provider</div>
                  <div className="text-bone">{currentOrder.provider}</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-gray-500 mt-0.5" />
                <div>
                  <div className="text-gray-400">Created</div>
                  <div className="text-bone">{formatRelativeTime(currentOrder.createdAt)}</div>
                </div>
              </div>
              {currentOrder.startedAt && (
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-gray-500 mt-0.5" />
                  <div>
                    <div className="text-gray-400">Started</div>
                    <div className="text-bone">{formatRelativeTime(currentOrder.startedAt)}</div>
                  </div>
                </div>
              )}
              {currentOrder.worktreeInfo && (
                <div className="flex items-start gap-2">
                  <GitBranch className="w-4 h-4 text-gray-500 mt-0.5" />
                  <div>
                    <div className="text-gray-400">Branch</div>
                    <div className="text-coffee font-mono text-xs">{currentOrder.worktreeInfo.branch}</div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Prompt Card */}
          {currentOrder.prompt && (
            <Card className="p-4">
              <h3 className="text-sm font-medium text-coffee mb-2">Task Prompt</h3>
              <div className="text-sm text-gray-300 bg-gray-800 p-2 rounded whitespace-pre-wrap">
                {currentOrder.prompt}
              </div>
            </Card>
          )}

          {/* Variables Card */}
          {Object.keys(currentOrder.vars || {}).length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-medium text-coffee mb-2">Variables</h3>
              <div className="space-y-1">
                {Object.entries(currentOrder.vars).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <span className="text-coffee font-mono">{key}:</span>
                    <span className="text-gray-300">{String(value)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Stage Progress Card */}
          <Card className="p-4">
            <h3 className="text-sm font-medium text-coffee mb-3 flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              Stage Progress
            </h3>
            <OrderStageProgressBar stages={stages} className="mb-3" />
            <OrderStageProgress stages={stages} />
          </Card>

          {/* Error Card */}
          {currentOrder.error && (
            <Card className="p-4 border-red-500/50 bg-red-500/5">
              <h3 className="text-sm font-medium text-red-400 mb-2">Error</h3>
              <div className="text-sm text-red-300 whitespace-pre-wrap">
                {currentOrder.error}
              </div>
            </Card>
          )}
        </div>

        {/* Right Panel - Terminal */}
        <div className="flex-1 min-h-[400px] lg:min-h-0">
          <InteractiveTerminal
            orderId={currentOrder.id}
            onSendInput={isRunning ? handleSendInput : undefined}
            isRunning={isRunning}
            className="h-full"
          />
        </div>
      </div>
    </div>
  );
}
