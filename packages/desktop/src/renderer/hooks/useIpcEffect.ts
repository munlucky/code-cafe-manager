import { useEffect } from 'react';
import { useBaristaStore } from '../store/useBaristaStore';
import { useOrderStore } from '../store/useOrderStore';
import { OrderStatus } from '@codecafe/core';

/**
 * IPC Event Listener Hook
 * Listens to various IPC events from the main process and updates the store accordingly.
 */
export function useIpcEffect() {
  const { updateBarista } = useBaristaStore();
  const {
    updateOrder,
    updateSessionStatus,
    updateStageResult,
    setAwaitingInput,
    clearSessionStatus,
    clearStageResults,
    updateTodoProgress,
  } = useOrderStore();

  useEffect(() => {
    // 바리스타 이벤트 리스너
    window.codecafe.onBaristaEvent((event) => {
      console.log('[IpcEffect] Barista Event:', event);
      if (event.baristaId) {
        updateBarista(event.baristaId, { status: event.status });
      }
    });

    // 주문 이벤트 리스너
    window.codecafe.onOrderEvent((event) => {
      console.log('[IpcEffect] Order Event:', event);
      if (event.orderId) {
        updateOrder(event.orderId, { status: event.status });
      }
    });

    // 주문 할당 이벤트
    window.codecafe.onOrderAssigned((data) => {
      console.log('[IpcEffect] Order Assigned:', data);
      if (data.orderId) {
        updateOrder(data.orderId, {
          status: OrderStatus.RUNNING,
          baristaId: data.baristaId,
        });
      }
    });

    // 주문 완료 이벤트
    window.codecafe.onOrderCompleted((data) => {
      console.log('[IpcEffect] Order Completed:', data);
      if (data.orderId) {
        updateOrder(data.orderId, { status: OrderStatus.COMPLETED });
        updateSessionStatus(data.orderId, { status: 'completed', awaitingInput: false });
      }
    });

    // === New Stage & Session Event Listeners ===

    // Session Started
    const cleanupSessionStarted = window.codecafe.order.onSessionStarted?.((data: { orderId: string }) => {
      console.log('[IpcEffect] Session Started:', data);
      // Order 상태를 RUNNING으로 업데이트
      updateOrder(data.orderId, { status: OrderStatus.RUNNING });
      updateSessionStatus(data.orderId, { 
        status: 'running', 
        awaitingInput: false 
      });
    });

    // Session Completed
    const cleanupSessionCompleted = window.codecafe.order.onSessionCompleted?.((data: { orderId: string }) => {
      console.log('[IpcEffect] Session Completed:', data);
      updateSessionStatus(data.orderId, { 
        status: 'completed', 
        awaitingInput: false 
      });
    });

    // Session Failed
    const cleanupSessionFailed = window.codecafe.order.onSessionFailed?.((data: { orderId: string; error?: string }) => {
      console.log('[IpcEffect] Session Failed:', data);
      updateSessionStatus(data.orderId, { 
        status: 'failed', 
        awaitingInput: false 
      });
      updateOrder(data.orderId, { 
        status: OrderStatus.FAILED, 
        error: data.error 
      });
    });

    // Stage Started
    const cleanupStageStarted = window.codecafe.order.onStageStarted?.((data: { 
      orderId: string; 
      stageId: string; 
      provider?: string 
    }) => {
      console.log('[IpcEffect] Stage Started:', data);
      updateStageResult(data.orderId, data.stageId, { 
        status: 'running',
        startedAt: new Date().toISOString(),
      });
    });

    // Stage Completed/Failed: IPC 리스너 제거
    // stage 완료/실패 정보는 Output 스트림([STAGE_END] 마커)을 통해 App.tsx의 onOutput에서 처리
    // (IPC → Output 단일 경로 전환)

    // Awaiting Input (New Event - requires orchestrator implementation)
    const cleanupAwaitingInput = window.codecafe.order.onAwaitingInput?.((data: { 
      orderId: string; 
      prompt?: string 
    }) => {
      console.log('[IpcEffect] Awaiting Input:', data);
      setAwaitingInput(data.orderId, true, data.prompt);
    });

    // Order Completed (via window.codecafe.order API)
    const cleanupOrderCompleted = window.codecafe.order.onCompleted?.((data: { orderId: string }) => {
      console.log('[IpcEffect] Order Completed (order API):', data);
      updateOrder(data.orderId, { status: OrderStatus.COMPLETED });
      updateSessionStatus(data.orderId, { status: 'completed', awaitingInput: false });
    });

    // Order Failed (via window.codecafe.order API)
    const cleanupOrderFailed = window.codecafe.order.onFailed?.((data: { orderId: string; error?: string }) => {
      console.log('[IpcEffect] Order Failed (order API):', data);
      updateOrder(data.orderId, { status: OrderStatus.FAILED, error: data.error });
      updateSessionStatus(data.orderId, { status: 'failed', awaitingInput: false });
    });

    // Todo Progress (from Claude's TodoWrite tool)
    const cleanupTodoProgress = window.codecafe.order.onTodoProgress?.((data: {
      orderId: string;
      timestamp: string;
      completed: number;
      inProgress: number;
      total: number;
      todos?: Array<{ content: string; status: 'pending' | 'in_progress' | 'completed'; activeForm?: string }>;
    }) => {
      console.log('[IpcEffect] Todo Progress:', data);
      updateTodoProgress(data);
    });

    // Order Status Changed (for retry status updates)
    const cleanupStatusChanged = window.codecafe.order.onStatusChanged?.((data: { orderId: string; status: string }) => {
      console.log('[IpcEffect] Order Status Changed:', data);
      // status string을 OrderStatus enum으로 변환
      updateOrder(data.orderId, { status: data.status as OrderStatus });
    });

    // Cleanup
    return () => {
      cleanupSessionStarted?.();
      cleanupSessionCompleted?.();
      cleanupSessionFailed?.();
      cleanupStageStarted?.();
      // cleanupStageCompleted/cleanupStageFailed 제거: stage 완료/실패는 Output 스트림에서 처리
      cleanupAwaitingInput?.();
      cleanupOrderCompleted?.();
      cleanupOrderFailed?.();
      cleanupTodoProgress?.();
      cleanupStatusChanged?.();
    };
  }, [
    updateBarista,
    updateOrder,
    updateSessionStatus,
    updateStageResult,
    setAwaitingInput,
    clearSessionStatus,
    clearStageResults,
    updateTodoProgress,
  ]);
}
