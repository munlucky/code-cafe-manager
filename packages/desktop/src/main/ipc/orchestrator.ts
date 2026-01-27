import { ipcMain } from 'electron';
import { Orchestrator, createLogger } from '@codecafe/core';

const logger = createLogger({ context: 'IPC:Orchestrator' });

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
 * Register Orchestrator IPC Handlers
 */
export function registerOrchestratorHandlers(orchestrator: Orchestrator): void {
  // 바리스타 생성
  ipcMain.handle('createBarista', async (_, provider: string) =>
    handleIpc(async () => orchestrator.createBarista(provider as any), 'createBarista')
  );

  // 주문 생성
  ipcMain.handle('createOrder', async (_, params) =>
    handleIpc(async () =>
      orchestrator.createOrder(
        params.workflowId,
        params.workflowName,
        params.counter,
        params.provider,
        params.vars
      ), 'createOrder'
    )
  );

  // 상태 조회
  ipcMain.handle('getAllBaristas', async () =>
    handleIpc(async () => orchestrator.getAllBaristas(), 'getAllBaristas')
  );

  ipcMain.handle('getAllOrders', async () =>
    handleIpc(async () => orchestrator.getAllOrders(), 'getAllOrders')
  );

  ipcMain.handle('getOrder', async (_, orderId: string) =>
    handleIpc(async () => orchestrator.getOrder(orderId), 'getOrder')
  );

  ipcMain.handle('getOrderLog', async (_, orderId: string) =>
    handleIpc(async () => orchestrator.getOrderLog(orderId), 'getOrderLog')
  );

  ipcMain.handle('getReceipts', async () =>
    handleIpc(async () => orchestrator.getReceipts(), 'getReceipts')
  );

  // 주문 취소
  ipcMain.handle('cancelOrder', async (_, orderId: string) =>
    handleIpc(async () => orchestrator.cancelOrder(orderId), 'cancelOrder')
  );

  logger.info('Orchestrator handlers registered');
}
