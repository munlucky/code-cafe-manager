/**
 * Order Detail View Component
 * 개별 Order의 상세 정보, Stage 진행, Interactive Terminal을 표시
 */

import { useEffect, useState, useCallback } from 'react';
import { cn } from '../../utils/cn';
import { ArrowLeft, Terminal, Info, Clock, GitBranch, User, RefreshCw, XCircle, MessageSquarePlus, GitMerge, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/Badge';
import { InteractiveTerminal } from './InteractiveTerminal';
import { OrderStageProgress, OrderStageProgressBar, type StageInfo, type StageStatus } from './OrderStageProgress';
import { formatRelativeTime } from '../../utils/formatters';
import type { Order, ExtendedWorkflowInfo } from '../../types/models';
import { OrderStatus } from '../../types/models';
import type { RetryOption } from '../../types/window';

/** Polling interval for refreshing order status */
const ORDER_REFRESH_INTERVAL_MS = 3000;

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
  const [completedStages, setCompletedStages] = useState<Set<string>>(new Set());
  const [stageSkills, setStageSkills] = useState<Record<string, string[]>>({});  // stage별 스킬 정보
  const [retryOptions, setRetryOptions] = useState<RetryOption[] | null>(null);
  const [selectedRetryStage, setSelectedRetryStage] = useState<string>('');
  const [retryType, setRetryType] = useState<'stage' | 'beginning'>('stage');
  const [isRetrying, setIsRetrying] = useState(false);
  const [isFollowupMode, setIsFollowupMode] = useState(false);
  const [isFollowupExecuting, setIsFollowupExecuting] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState<{ success: boolean; message: string } | null>(null);
  const isRunning = currentOrder.status === OrderStatus.RUNNING;
  const isPending = currentOrder.status === OrderStatus.PENDING;
  const isCompleted = currentOrder.status === OrderStatus.COMPLETED;
  const isFailed = currentOrder.status === OrderStatus.FAILED;
  const canSendInput = isRunning || isFollowupMode;

  // Workflow 정보 가져오기
  useEffect(() => {
    async function fetchWorkflow() {
      try {
        console.log('[OrderDetailView] Fetching workflow:', order.workflowId);
        const response = await window.codecafe.workflow.get(order.workflowId);
        console.log('[OrderDetailView] Workflow response:', response);
        if (response.success && response.data) {
          console.log('[OrderDetailView] Workflow data:', response.data);
          setWorkflow(response.data);
        } else {
          console.warn('[OrderDetailView] Workflow fetch failed:', response);
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
    }, ORDER_REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [order.id]);

  // Stage 이벤트 리스너 - 실시간 stage 진행 상황 추적
  useEffect(() => {
    // order:stage-started 이벤트 리스너
    const cleanupStageStarted = window.codecafe.order.onStageStarted((data: {
      orderId: string;
      stageId: string;
      stageName?: string;
      provider?: string;
      skills?: string[];
    }) => {
      if (data.orderId === order.id && workflow) {
        const stageIndex = workflow.stages.indexOf(data.stageId);
        if (stageIndex >= 0) {
          setCurrentStageIndex(stageIndex);
          // 스킬 정보 저장
          if (data.skills) {
            setStageSkills(prev => ({ ...prev, [data.stageId]: data.skills! }));
          }
        }
      }
    });

    // order:stage-completed 이벤트 리스너
    const cleanupStageCompleted = window.codecafe.order.onStageCompleted((data: { orderId: string; stageId: string; output?: string; duration?: number }) => {
      if (data.orderId === order.id) {
        setCompletedStages(prev => new Set(prev).add(data.stageId));
      }
    });

    return () => {
      cleanupStageStarted();
      cleanupStageCompleted();
    };
  }, [order.id, workflow]);

  // 실패 시 재시도 옵션 가져오기
  useEffect(() => {
    async function fetchRetryOptions() {
      if (isFailed) {
        try {
          const response = await window.codecafe.order.getRetryOptions(order.id);
          if (response.success && response.data) {
            setRetryOptions(response.data);
            // 기본값으로 실패한 stage 선택
            if (response.data.length > 0) {
              setSelectedRetryStage(response.data[response.data.length - 1].stageId);
            }
          }
        } catch (error) {
          console.error('Failed to fetch retry options:', error);
        }
      } else {
        setRetryOptions(null);
        setSelectedRetryStage('');
      }
    }
    fetchRetryOptions();
  }, [order.id, isFailed]);

  // 사용자 입력 전송 (running 또는 followup 모드)
  const handleSendInput = useCallback(async (message: string) => {
    if (isFollowupMode) {
      // Followup 모드에서는 executeFollowup 사용
      setIsFollowupExecuting(true);
      try {
        const response = await window.codecafe.order.executeFollowup(order.id, message);
        if (!response.success) {
          throw new Error(response.error?.message || 'Failed to execute followup');
        }
      } finally {
        setIsFollowupExecuting(false);
      }
    } else {
      // Running 상태에서는 sendInput 사용
      const response = await window.codecafe.order.sendInput(order.id, message);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to send input');
      }
    }
  }, [order.id, isFollowupMode]);

  // Followup 모드 진입
  const handleEnterFollowup = useCallback(async () => {
    try {
      const response = await window.codecafe.order.enterFollowup(order.id);
      if (response.success) {
        setIsFollowupMode(true);
      } else {
        console.error('Failed to enter followup mode:', response.error);
      }
    } catch (error) {
      console.error('Failed to enter followup mode:', error);
    }
  }, [order.id]);

  // Followup 모드 종료
  const handleFinishFollowup = useCallback(async () => {
    try {
      const response = await window.codecafe.order.finishFollowup(order.id);
      if (response.success) {
        setIsFollowupMode(false);
      } else {
        console.error('Failed to finish followup:', response.error);
      }
    } catch (error) {
      console.error('Failed to finish followup:', error);
    }
  }, [order.id]);

  // Worktree 병합 처리
  const handleMergeWorktree = useCallback(async (deleteAfterMerge: boolean = false) => {
    if (!currentOrder.worktreeInfo?.path || !currentOrder.worktreeInfo?.repoPath) {
      console.error('No worktree info available');
      return;
    }

    setIsMerging(true);
    setMergeResult(null);

    try {
      const response = await window.codecafe.worktree.mergeToTarget({
        worktreePath: currentOrder.worktreeInfo.path,
        repoPath: currentOrder.worktreeInfo.repoPath,
        targetBranch: currentOrder.worktreeInfo.baseBranch || 'main',
        deleteAfterMerge,
        squash: false,
      });

      if (response.success) {
        setMergeResult({
          success: true,
          message: `Merged to ${response.data.targetBranch}${deleteAfterMerge ? ' (worktree removed)' : ''}`,
        });
        // Refresh order data
        const orderResponse = await window.codecafe.order.get(order.id);
        if (orderResponse.success && orderResponse.data) {
          setCurrentOrder(orderResponse.data);
        }
      } else {
        setMergeResult({
          success: false,
          message: response.error?.message || 'Merge failed',
        });
      }
    } catch (error) {
      setMergeResult({
        success: false,
        message: error instanceof Error ? error.message : 'Merge failed',
      });
    } finally {
      setIsMerging(false);
    }
  }, [currentOrder.worktreeInfo, order.id]);

  // Worktree만 삭제 (브랜치 유지)
  const handleRemoveWorktreeOnly = useCallback(async () => {
    if (!currentOrder.worktreeInfo?.path || !currentOrder.worktreeInfo?.repoPath) {
      console.error('No worktree info available');
      return;
    }

    setIsMerging(true);
    setMergeResult(null);
    try {
      const response = await window.codecafe.worktree.removeOnly(
        currentOrder.worktreeInfo.path,
        currentOrder.worktreeInfo.repoPath
      );

      if (response.success) {
        setMergeResult({
          success: true,
          message: `Worktree removed, branch '${response.data.branch}' preserved`,
        });
        // Refresh order data
        const orderResponse = await window.codecafe.order.get(order.id);
        if (orderResponse.success && orderResponse.data) {
          setCurrentOrder(orderResponse.data);
        }
      } else {
        setMergeResult({
          success: false,
          message: response.error?.message || 'Failed to remove worktree',
        });
      }
    } catch (error) {
      setMergeResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to remove worktree',
      });
    } finally {
      setIsMerging(false);
    }
  }, [currentOrder.worktreeInfo, order.id]);

  // Followup 이벤트 리스너
  useEffect(() => {
    const cleanupFollowup = window.codecafe.order.onFollowup((data: { orderId: string }) => {
      if (data.orderId === order.id) {
        setIsFollowupMode(true);
      }
    });

    const cleanupFollowupCompleted = window.codecafe.order.onFollowupCompleted((data: { orderId: string }) => {
      if (data.orderId === order.id) {
        setIsFollowupExecuting(false);
      }
    });

    const cleanupFollowupFailed = window.codecafe.order.onFollowupFailed((data: { orderId: string }) => {
      if (data.orderId === order.id) {
        setIsFollowupExecuting(false);
      }
    });

    const cleanupFollowupFinished = window.codecafe.order.onFollowupFinished((data: { orderId: string }) => {
      if (data.orderId === order.id) {
        setIsFollowupMode(false);
      }
    });

    return () => {
      cleanupFollowup();
      cleanupFollowupCompleted();
      cleanupFollowupFailed();
      cleanupFollowupFinished();
    };
  }, [order.id]);

  // 재시도 처리 (선택한 stage부터)
  const handleRetryFromStage = useCallback(async () => {
    if (!selectedRetryStage) return;

    setIsRetrying(true);
    try {
      const response = await window.codecafe.order.retryFromStage(order.id, selectedRetryStage);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to retry order');
      }
      // 성공 시 상태 초기화
      setRetryOptions(null);
      setSelectedRetryStage('');
    } catch (error) {
      console.error('Failed to retry order:', error);
    } finally {
      setIsRetrying(false);
    }
  }, [order.id, selectedRetryStage]);

  // 처음부터 재시도 (이전 시도 컨텍스트 포함)
  const handleRetryFromBeginning = useCallback(async () => {
    setIsRetrying(true);
    try {
      const response = await window.codecafe.order.retryFromBeginning(order.id, true);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to retry order from beginning');
      }
      // 성공 시 상태 초기화
      setRetryOptions(null);
      setSelectedRetryStage('');
      setRetryType('stage');
    } catch (error) {
      console.error('Failed to retry order from beginning:', error);
    } finally {
      setIsRetrying(false);
    }
  }, [order.id]);

  // Stage별 카테고리 매핑
  const getStageCategory = (stageId: string): string => {
    const categoryMap: Record<string, string> = {
      'analyze': 'ANALYSIS',
      'plan': 'PLANNING',
      'code': 'IMPLEMENTATION',
      'review': 'VERIFICATION',
      'test': 'VERIFICATION',
      'check': 'VERIFICATION',
    };
    return categoryMap[stageId] || stageId.toUpperCase();
  };

  // Stage 정보 계산
  const stages: StageInfo[] = (workflow?.stages || ['Plan', 'Code', 'Test']).map(
    (stageId, index): StageInfo => {
      let status: StageStatus = 'pending';

      // 명시적으로 완료된 stage 확인
      if (completedStages.has(stageId)) {
        status = 'completed';
      } else if (isCompleted) {
        // 전체 order가 완료된 경우
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

      // 스킬 정보: 실시간 이벤트에서 받은 stageSkills 우선, 없으면 stageConfigs 사용
      const skills = stageSkills[stageId] || workflow?.stageConfigs?.[stageId]?.skills;

      console.log('[OrderDetailView] Stage computed:', {
        stageId,
        index,
        status,
        skills,
        stageSkillsForStage: stageSkills[stageId],
        workflowStageConfigs: workflow?.stageConfigs?.[stageId],
      });

      // StageID, Category, Skills 모두 포함
      return {
        stageId,
        category: getStageCategory(stageId),
        status,
        skills,
      };
    }
  );

  // 디버깅: workflow 상태 로그
  console.log('[OrderDetailView] Rendering stages:', stages.map(s => ({ stageId: s.stageId, category: s.category, skills: s.skills })));

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
          {/* Followup 버튼 - 완료 상태에서 추가 명령 가능 */}
          {isCompleted && !isFollowupMode && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleEnterFollowup}
              className="flex items-center gap-1"
            >
              <MessageSquarePlus className="w-4 h-4" />
              Continue
            </Button>
          )}
          {/* Followup 종료 버튼 */}
          {isFollowupMode && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleFinishFollowup}
              className="flex items-center gap-1"
            >
              <XCircle className="w-4 h-4" />
              Finish
            </Button>
          )}
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

          {/* Worktree Management Card - 완료 상태에서 worktree가 있을 때 */}
          {isCompleted && currentOrder.worktreeInfo && !currentOrder.worktreeInfo.removed && (
            <Card className="p-4 border-green-500/30 bg-green-500/5">
              <h3 className="text-sm font-medium text-green-400 mb-3 flex items-center gap-2">
                <GitMerge className="w-4 h-4" />
                Worktree Management
              </h3>
              <div className="space-y-3">
                <div className="text-xs text-gray-400 bg-gray-800/50 p-2 rounded">
                  <div className="flex items-center gap-2 mb-1">
                    <GitBranch className="w-3 h-3" />
                    <span className="font-mono text-coffee">{currentOrder.worktreeInfo.branch}</span>
                  </div>
                  <div className="text-gray-500 truncate">
                    {currentOrder.worktreeInfo.path}
                  </div>
                </div>

                {mergeResult && (
                  <div className={cn(
                    'text-xs p-2 rounded',
                    mergeResult.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                  )}>
                    {mergeResult.message}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleMergeWorktree(false)}
                    disabled={isMerging}
                    className="flex items-center justify-center gap-1 w-full"
                  >
                    <GitMerge className={cn('w-3 h-3', isMerging && 'animate-spin')} />
                    {isMerging ? 'Merging...' : 'Merge to Main'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleMergeWorktree(true)}
                    disabled={isMerging}
                    className="flex items-center justify-center gap-1 w-full text-yellow-400 hover:text-yellow-300"
                  >
                    <GitMerge className="w-3 h-3" />
                    Merge & Delete Worktree
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleRemoveWorktreeOnly}
                    disabled={isMerging}
                    className="flex items-center justify-center gap-1 w-full text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-3 h-3" />
                    Remove Worktree Only
                  </Button>
                </div>
                <div className="text-[10px] text-gray-500">
                  * "Remove Worktree Only" preserves the branch for later use
                </div>
              </div>
            </Card>
          )}

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
            <OrderStageProgress stages={stages} showSkills={true} />
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

          {/* Retry Options Card - 실패 시 재시도/종료 선택 */}
          {isFailed && retryOptions && retryOptions.length > 0 && (
            <Card className="p-4 border-yellow-500/50 bg-yellow-500/5">
              <h3 className="text-sm font-medium text-yellow-400 mb-3 flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Retry Options
              </h3>
              <div className="space-y-3">
                {/* 재시도 타입 선택 */}
                <div className="flex gap-2" role="radiogroup" aria-label="Retry type selection">
                  <button
                    role="radio"
                    aria-checked={retryType === 'stage'}
                    onClick={() => setRetryType('stage')}
                    className={`flex-1 px-2 py-1.5 text-xs rounded border transition-colors ${
                      retryType === 'stage'
                        ? 'bg-coffee/20 border-coffee text-coffee'
                        : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    특정 Stage부터
                  </button>
                  <button
                    role="radio"
                    aria-checked={retryType === 'beginning'}
                    onClick={() => setRetryType('beginning')}
                    className={`flex-1 px-2 py-1.5 text-xs rounded border transition-colors ${
                      retryType === 'beginning'
                        ? 'bg-coffee/20 border-coffee text-coffee'
                        : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500'
                    }`}
                  >
                    처음부터 (컨텍스트 유지)
                  </button>
                </div>

                {/* Stage 선택 (stage 타입일 때만) */}
                {retryType === 'stage' && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Retry from stage:
                    </label>
                    <select
                      value={selectedRetryStage}
                      onChange={(e) => setSelectedRetryStage(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm bg-gray-800 border border-gray-600 rounded text-bone focus:outline-none focus:border-coffee"
                    >
                      {retryOptions.map((option) => (
                        <option key={option.stageId} value={option.stageId}>
                          {option.stageName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 처음부터 재시도 설명 */}
                {retryType === 'beginning' && (
                  <div className="text-xs text-gray-400 bg-gray-800/50 p-2 rounded">
                    이전 시도의 실패 정보를 포함하여 처음부터 다시 실행합니다.
                    AI가 이전 실패 원인을 참고하여 개선된 결과를 도출할 수 있습니다.
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={retryType === 'stage' ? handleRetryFromStage : handleRetryFromBeginning}
                    disabled={isRetrying || (retryType === 'stage' && !selectedRetryStage)}
                    className="flex-1 flex items-center justify-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
                    {isRetrying ? 'Retrying...' : (retryType === 'stage' ? 'Retry from Stage' : 'Retry from Beginning')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onBack}
                    className="flex-1 flex items-center justify-center gap-1"
                  >
                    <XCircle className="w-3 h-3" />
                    Close
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right Panel - Terminal */}
        <div className="flex-1 min-h-[400px] lg:min-h-0">
          <InteractiveTerminal
            orderId={currentOrder.id}
            onSendInput={canSendInput ? handleSendInput : undefined}
            isRunning={isRunning || isFollowupExecuting}
            startedAt={currentOrder.startedAt}
            initialPrompt={currentOrder.prompt}
            className="h-full"
            placeholder={isFollowupMode ? 'Enter followup command...' : undefined}
          />
        </div>
      </div>
    </div>
  );
}
