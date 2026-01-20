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

    // Stage Completed
    const cleanupStageCompleted = window.codecafe.order.onStageCompleted?.((data: { 
      orderId: string; 
      stageId: string; 
      output?: string;
      duration?: number;
    }) => {
      console.log('[IpcEffect] Stage Completed:', data);
      updateStageResult(data.orderId, data.stageId, { 
        status: 'completed',
        completedAt: new Date().toISOString(),
        duration: data.duration,
      });
    });

    // Stage Failed
    const cleanupStageFailed = window.codecafe.order.onStageFailed?.((data: { 
      orderId: string; 
      stageId: string; 
      error?: string 
    }) => {
      console.log('[IpcEffect] Stage Failed:', data);
      updateStageResult(data.orderId, data.stageId, { 
        status: 'failed',
        error: data.error,
      });
    });

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

    // Cleanup
    return () => {
      cleanupSessionStarted?.();
      cleanupSessionCompleted?.();
      cleanupSessionFailed?.();
      cleanupStageStarted?.();
      cleanupStageCompleted?.();
      cleanupStageFailed?.();
      cleanupAwaitingInput?.();
      cleanupOrderCompleted?.();
      cleanupOrderFailed?.();
    };
  }, [
    updateBarista, 
    updateOrder, 
    updateSessionStatus, 
    updateStageResult, 
    setAwaitingInput,
    clearSessionStatus,
    clearStageResults,
  ]);
}
