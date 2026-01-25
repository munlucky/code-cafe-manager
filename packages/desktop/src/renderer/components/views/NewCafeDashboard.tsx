import React, { useState, useEffect, useCallback, memo } from 'react';
import { Cpu } from 'lucide-react';
import type { Cafe, DesignOrder, Recipe } from '../../types/design';
import { type StageInfo } from '../order/OrderStageProgress';
import { type TimelineEvent, OrderTimelineView } from '../orders/OrderTimelineView';
import { InteractiveTerminal } from '../order/InteractiveTerminal';
import { OrderList } from '../order/OrderList';
import { OrderDetailHeader } from '../order/OrderDetailHeader';
import { WorktreeManagementPanel } from '../order/WorktreeManagementPanel';
import { CreateOrderModal } from '../order/CreateOrderModal';
import { useOrderStore } from '../../store/useOrderStore';

interface NewCafeDashboardProps {
  cafe: Cafe;
  orders: DesignOrder[];
  workflows: Recipe[];
  onCreateOrder: (
    cafeId: string,
    workflowId: string,
    description: string,
    useWorktree: boolean
  ) => void;
  onDeleteOrder: (orderId: string) => void;
  onCancelOrder: (orderId: string) => void;
  onSendInput: (orderId: string, input: string) => void;
  getStagesForOrder: (order: DesignOrder) => StageInfo[];
  timelineEvents: Record<string, TimelineEvent[]>;
}

export const NewCafeDashboard: React.FC<NewCafeDashboardProps> = memo(
  function NewCafeDashboard({
    cafe,
    orders,
    workflows,
    onCreateOrder,
    onDeleteOrder,
    onCancelOrder,
    onSendInput,
    getStagesForOrder,
    timelineEvents,
  }) {
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [viewMode, setViewMode] = useState<'logs' | 'timeline'>('logs');
    const [isFollowupMode, setIsFollowupMode] = useState(false);
    const [isFollowupExecuting, setIsFollowupExecuting] = useState(false);
    const [isWorktreeRemoved, setIsWorktreeRemoved] = useState(false);

    const updateOrder = useOrderStore((state) => state.updateOrder);
    const activeOrder = orders.find((o) => o.id === activeOrderId);

    const isCompleted = activeOrder?.status === 'COMPLETED';
    const isRunning = activeOrder?.status === 'RUNNING';
    const isWaitingInput = activeOrder?.status === 'WAITING_INPUT';
    const canSendInput =
      (isRunning || isWaitingInput || isFollowupMode) &&
      !isWorktreeRemoved;

    // Sync worktree removed state when order changes or worktreeInfo.removed updates
    useEffect(() => {
      if (activeOrder?.worktreeInfo?.removed) {
        setIsWorktreeRemoved(true);
      } else {
        setIsWorktreeRemoved(false);
      }
    }, [activeOrderId, activeOrder?.worktreeInfo?.removed]);

    // Auto-select first order
    useEffect(() => {
      if (!activeOrderId && orders.length > 0) {
        setActiveOrderId(orders[0].id);
      }
    }, [orders, activeOrderId]);

    // Listen for followup stage completion to reset isFollowupExecuting
    useEffect(() => {
      if (!isFollowupExecuting || !activeOrderId) return;

      const cleanup = window.codecafe.order.onOutput(
        (event: {
          orderId: string;
          type: string;
          stageInfo?: { stageId: string; status?: string };
        }) => {
          if (event.orderId !== activeOrderId) return;
          if (event.type !== 'stage_end') return;
          if (!event.stageInfo?.stageId) return;

          console.log('[NewCafeDashboard] stage_end event:', event);

          // Check if it's a followup stage (pattern: followup-{timestamp})
          const isFollowupStage = /^followup-\d+$/.test(event.stageInfo.stageId);
          if (isFollowupStage) {
            console.log('[NewCafeDashboard] Resetting isFollowupExecuting for followup stage:', event.stageInfo.stageId);
            setIsFollowupExecuting(false);
          }
        }
      );

      return cleanup;
    }, [isFollowupExecuting, activeOrderId]);

    // Followup handlers
    const handleEnterFollowup = useCallback(async () => {
      if (!activeOrder) return;
      try {
        const response = await window.codecafe.order.enterFollowup(
          activeOrder.id
        );
        if (response.success) {
          setIsFollowupMode(true);
        }
      } catch (error) {
        console.error('Failed to enter followup mode:', error);
      }
    }, [activeOrder]);

    const handleFinishFollowup = useCallback(async () => {
      if (!activeOrder) return;
      try {
        const response = await window.codecafe.order.finishFollowup(
          activeOrder.id
        );
        if (response.success) {
          setIsFollowupMode(false);
        }
      } catch (error) {
        console.error('Failed to finish followup:', error);
      }
    }, [activeOrder]);

    // Send input handler
    const handleSendInput = useCallback(
      async (message: string) => {
        if (!activeOrder?.id) return;

        if (isFollowupMode || isCompleted) {
          setIsFollowupExecuting(true);
          try {
            const response = await window.codecafe.order.executeFollowup(
              activeOrder.id,
              message
            );
            if (!response.success) {
              setIsFollowupExecuting(false);
              throw new Error(
                response.error?.message || 'Failed to execute followup'
              );
            }
            if (!isFollowupMode) {
              setIsFollowupMode(true);
            }
            // Note: isFollowupExecuting will be reset by useEffect when stage_end event is received
          } catch (error) {
            setIsFollowupExecuting(false);
            throw error;
          }
        } else {
          onSendInput(activeOrder.id, message);
        }
      },
      [activeOrder, isFollowupMode, isCompleted, onSendInput]
    );

    return (
      <div className="flex h-screen bg-cafe-950 overflow-hidden">
        {/* Left Panel: Order List */}
        <OrderList
          cafe={cafe}
          orders={orders}
          activeOrderId={activeOrderId}
          onSelectOrder={setActiveOrderId}
          onCreateClick={() => setShowCreateModal(true)}
          getStagesForOrder={getStagesForOrder}
        />

        {/* Main Panel */}
        <div className="flex-1 flex flex-col min-w-0 bg-terminal-bg">
          {!activeOrder ? (
            <div className="flex-1 flex flex-col items-center justify-center text-cafe-600 bg-cafe-950">
              <div className="w-24 h-24 bg-cafe-900 rounded-full flex items-center justify-center mb-6 shadow-2xl border border-cafe-800">
                <Cpu className="w-10 h-10 opacity-30 text-brand" />
              </div>
              <p className="text-xl font-medium text-cafe-400">
                Select an order
              </p>
              <p className="text-sm opacity-50 mt-2">
                View execution logs and worktree details
              </p>
            </div>
          ) : (
            <>
              <OrderDetailHeader
                order={activeOrder}
                viewMode={viewMode}
                isFollowupMode={isFollowupMode}
                isWorktreeRemoved={isWorktreeRemoved}
                onViewModeChange={setViewMode}
                onEnterFollowup={handleEnterFollowup}
                onFinishFollowup={handleFinishFollowup}
                onCancel={() => onCancelOrder(activeOrder.id)}
                onDelete={() => onDeleteOrder(activeOrder.id)}
              />

              {viewMode === 'logs' ? (
                <div className="flex-1 overflow-hidden flex flex-col">
                  {isCompleted &&
                    activeOrder.worktreeInfo &&
                    !isFollowupMode &&
                    !isFollowupExecuting &&
                    !isWorktreeRemoved &&
                    !activeOrder.worktreeInfo.removed && (
                      <WorktreeManagementPanel
                        order={activeOrder}
                        isFollowupMode={isFollowupMode}
                        onClose={() => setViewMode('timeline')}
                        onMergeComplete={(result) => {
                          setIsFollowupExecuting(true);
                          // Set worktree as removed if it was a delete operation
                          if (result.worktreeRemoved) {
                            setIsWorktreeRemoved(true);
                            // Update store to persist the removed state
                            updateOrder(activeOrder.id, {
                              worktreeInfo: {
                                ...activeOrder.worktreeInfo,
                                removed: true,
                              },
                            });
                          }
                        }}
                      />
                    )}
                  <InteractiveTerminal
                    orderId={activeOrder.id}
                    onSendInput={canSendInput ? handleSendInput : undefined}
                    isRunning={isRunning || isFollowupExecuting}
                    isAwaitingInput={isWaitingInput}
                    worktreePath={activeOrder.worktreeInfo?.path}
                    startedAt={activeOrder.startedAt}
                    className={
                      isCompleted && activeOrder.worktreeInfo
                        ? 'flex-1'
                        : 'h-full'
                    }
                    placeholder={
                      isFollowupMode || isCompleted
                        ? 'Enter followup command...'
                        : undefined
                    }
                  />
                </div>
              ) : (
                <div className="flex-1 overflow-hidden">
                  <OrderTimelineView
                    events={timelineEvents[activeOrder.id] || []}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Create Order Modal */}
        {showCreateModal && (
          <CreateOrderModal
            cafe={cafe}
            workflows={workflows}
            onClose={() => setShowCreateModal(false)}
            onCreate={onCreateOrder}
          />
        )}
      </div>
    );
  }
);
