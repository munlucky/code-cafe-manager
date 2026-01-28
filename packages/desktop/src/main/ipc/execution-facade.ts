import { ipcMain } from 'electron';
import { ExecutionFacade } from '@codecafe/orchestrator';
import { createLogger, ProviderType } from '@codecafe/core';

const logger = createLogger({ context: 'IPC:ExecutionFacade' });

/**
 * Standardized IPC handler wrapper
 */
async function handleIpc<T>(
  handler: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await handler();
  } catch (error) {
    logger.error(`Error in ${context}`, { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

/**
 * Register ExecutionFacade IPC Handlers
 * Replaces Orchestrator(core) with ExecutionFacade(orchestrator)
 */
export function registerExecutionFacadeHandlers(facade: ExecutionFacade): void {
  // 바리스타 생성
  ipcMain.handle('createBarista', async (_, provider: string) =>
    handleIpc(async () => facade.createBarista(provider as ProviderType), 'createBarista')
  );

  // 주문 생성
  ipcMain.handle('createOrder', async (_, params) =>
    handleIpc(async () =>
      facade.createOrder(
        params.workflowId,
        params.workflowName,
        params.counter,
        params.provider,
        params.vars,
        params.cafeId
      ), 'createOrder'
    )
  );

  // 상태 조회
  ipcMain.handle('getAllBaristas', async () =>
    handleIpc(async () => facade.getAllBaristas(), 'getAllBaristas')
  );

  ipcMain.handle('getAllOrders', async () =>
    handleIpc(async () => facade.getAllOrders(), 'getAllOrders')
  );

  ipcMain.handle('getOrder', async (_, orderId: string) =>
    handleIpc(async () => facade.getOrder(orderId), 'getOrder')
  );

  ipcMain.handle('getBarista', async (_, baristaId: string) =>
    handleIpc(async () => facade.getBarista(baristaId), 'getBarista')
  );

  ipcMain.handle('getOrderLog', async (_, orderId: string) =>
    handleIpc(async () => facade.getOrderLog(orderId), 'getOrderLog')
  );

  ipcMain.handle('getReceipts', async () =>
    handleIpc(async () => facade.getReceipts(), 'getReceipts')
  );

  // 주문 삭제
  ipcMain.handle('deleteOrder', async (_, orderId: string) =>
    handleIpc(async () => facade.deleteOrder(orderId), 'deleteOrder')
  );

  ipcMain.handle('deleteOrders', async (_, orderIds: string[]) =>
    handleIpc(async () => facade.deleteOrders(orderIds), 'deleteOrders')
  );

  // 주문 실행 (ExecutionFacade 고유 기능)
  ipcMain.handle('executeOrder', async (_, params) =>
    handleIpc(async () => facade.executeOrder(params.order, params.barista), 'executeOrder')
  );

  ipcMain.handle('cancelOrder', async (_, orderId: string) =>
    handleIpc(async () => facade.cancelOrder(orderId), 'cancelOrder')
  );

  ipcMain.handle('sendOrderInput', async (_, orderId: string, message: string) =>
    handleIpc(async () => facade.sendInput(orderId, message), 'sendOrderInput')
  );

  // Followup 모드
  ipcMain.handle('enterFollowup', async (_, orderId: string) =>
    handleIpc(async () => facade.enterFollowup(orderId), 'enterFollowup')
  );

  ipcMain.handle('executeFollowup', async (_, orderId: string, prompt: string) =>
    handleIpc(async () => facade.executeFollowup(orderId, prompt), 'executeFollowup')
  );

  ipcMain.handle('finishFollowup', async (_, orderId: string) =>
    handleIpc(async () => facade.finishFollowup(orderId), 'finishFollowup')
  );

  // Retry
  ipcMain.handle('retryFromStage', async (_, orderId: string, fromStageId?: string) =>
    handleIpc(async () => facade.retryFromStage(orderId, fromStageId), 'retryFromStage')
  );

  ipcMain.handle('retryFromBeginning', async (_, orderId: string, preserveContext?: boolean) =>
    handleIpc(async () => facade.retryFromBeginning(orderId, preserveContext), 'retryFromBeginning')
  );

  ipcMain.handle('getRetryOptions', async (_, orderId: string) =>
    handleIpc(async () => facade.getRetryOptions(orderId), 'getRetryOptions')
  );

  // Session 상태
  ipcMain.handle('getSessionStatus', async () =>
    handleIpc(async () => facade.getSessionStatus(), 'getSessionStatus')
  );

  ipcMain.handle('getOrderSessionStatus', async (_, orderId: string) =>
    handleIpc(async () => facade.getOrderSessionStatus(orderId), 'getOrderSessionStatus')
  );

  logger.info('ExecutionFacade handlers registered');
}
