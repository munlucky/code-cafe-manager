/**
 * Order IPC Handlers
 * Thin layer that delegates to OrderService for business logic
 */

import { ipcMain } from 'electron';
import { Orchestrator, createLogger, toCodeCafeError } from '@codecafe/core';
import { getExecutionManager } from '../execution-manager.js';
import {
  OrderService,
  CreateOrderWithWorktreeParams,
  CreateOrderWithWorktreeResult,
} from '../services/order-service.js';

const logger = createLogger({ context: 'IPC:Order' });

/**
 * IPC Response type
 */
interface IpcResponse<T = void> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Standardized IPC handler wrapper
 */
async function handleIpc<T>(
  handler: () => Promise<T>,
  context: string
): Promise<IpcResponse<T>> {
  try {
    const data = await handler();
    return {
      success: true,
      data,
    };
  } catch (error: unknown) {
    const cafeError = toCodeCafeError(error);
    logger.error(`Error in ${context}`, { error: cafeError.message });

    return {
      success: false,
      error: {
        code: cafeError.code,
        message: cafeError.message,
        details: cafeError.details,
      },
    };
  }
}

/**
 * Output subscription interval management
 */
class OutputIntervalManager {
  private static intervals = new Map<string, NodeJS.Timeout>();

  static clear(orderId: string): void {
    const key = `order:output:${orderId}`;
    const interval = this.intervals.get(key);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(key);
    }
  }

  static clearAll(): void {
    for (const [key, interval] of this.intervals) {
      clearInterval(interval);
      logger.info('Cleared interval', { key });
    }
    this.intervals.clear();
  }
}

/**
 * Order Manager
 */
class OrderManager {
  private static orderService: OrderService | null = null;

  /**
   * Register Order IPC Handlers
   */
  static registerHandlers(orchestrator: Orchestrator): void {
    // Initialize OrderService
    this.orderService = new OrderService({
      orchestrator,
      getExecutionManager,
    });

    const service = this.orderService;

    /**
     * Create order with worktree
     */
    ipcMain.handle(
      'order:createWithWorktree',
      async (_, params: CreateOrderWithWorktreeParams) =>
        handleIpc(async () => {
          return await service.createOrderWithWorktree(params);
        }, 'order:createWithWorktree')
    );

    /**
     * Create simple order
     */
    ipcMain.handle(
      'order:create',
      async (_, params: { workflowId: string; workflowName: string; counter: string; provider?: string; vars?: Record<string, string> }) =>
        handleIpc(async () => {
          return service.createOrder(params);
        }, 'order:create')
    );

    /**
     * Get single order
     */
    ipcMain.handle('order:get', async (_, orderId: string) =>
      handleIpc(async () => {
        return service.getOrder(orderId);
      }, 'order:get')
    );

    /**
     * Get all orders
     */
    ipcMain.handle('order:getAll', async () =>
      handleIpc(async () => {
        return service.getAllOrders();
      }, 'order:getAll')
    );

    /**
     * Cancel order
     */
    ipcMain.handle('order:cancel', async (_, orderId: string) =>
      handleIpc(async () => {
        await service.cancelOrder(orderId);
        return { cancelled: true };
      }, 'order:cancel')
    );

    /**
     * Delete single order
     */
    ipcMain.handle('order:delete', async (_, orderId: string) =>
      handleIpc(async () => {
        const deleted = await service.deleteOrder(orderId);
        return { deleted };
      }, 'order:delete')
    );

    /**
     * Delete multiple orders
     */
    ipcMain.handle('order:deleteMany', async (_, orderIds: string[]) =>
      handleIpc(async () => {
        return await service.deleteOrders(orderIds);
      }, 'order:deleteMany')
    );

    /**
     * Execute order
     */
    ipcMain.handle(
      'order:execute',
      async (_, orderId: string, prompt: string, vars?: Record<string, string>) =>
        handleIpc(async () => {
          await service.executeOrder(orderId, prompt, vars);
          return { started: true };
        }, 'order:execute')
    );

    /**
     * Send input to order
     */
    ipcMain.handle(
      'order:sendInput',
      async (_, orderId: string, message: string) =>
        handleIpc(async () => {
          await service.sendInput(orderId, message);
          return { sent: true };
        }, 'order:sendInput')
    );

    /**
     * Get order log
     */
    ipcMain.handle('order:getLog', async (_, orderId: string) =>
      handleIpc(async () => {
        return await service.getOrderLog(orderId);
      }, 'order:getLog')
    );

    /**
     * Get all receipts
     */
    ipcMain.handle('receipt:getAll', async () =>
      handleIpc(async () => {
        return await service.getReceipts();
      }, 'receipt:getAll')
    );

    /**
     * Subscribe to order output
     */
    ipcMain.handle('order:subscribeOutput', async (_event, orderId: string) =>
      handleIpc(async () => {
        logger.info('Subscribe to order output', { orderId });

        // Clear existing interval
        OutputIntervalManager.clear(orderId);

        // Get history from service
        const history = await service.getOutputHistory(orderId);

        return { subscribed: true, history };
      }, 'order:subscribeOutput')
    );

    /**
     * Unsubscribe from order output
     */
    ipcMain.handle('order:unsubscribeOutput', async (_, orderId: string) =>
      handleIpc(async () => {
        OutputIntervalManager.clear(orderId);
        logger.info('Unsubscribed from order output', { orderId });
        return { unsubscribed: true };
      }, 'order:unsubscribeOutput')
    );

    /**
     * Retry worktree creation
     */
    ipcMain.handle(
      'order:retryWorktree',
      async (_, params: { orderId: string; cafeId: string; worktreeOptions?: { baseBranch?: string; branchPrefix?: string } }) =>
        handleIpc(async () => {
          return await service.retryWorktree(
            params.orderId,
            params.cafeId,
            params.worktreeOptions
          );
        }, 'order:retryWorktree')
    );

    /**
     * Retry from specific stage
     */
    ipcMain.handle(
      'order:retryFromStage',
      async (_, params: { orderId: string; fromStageId?: string }) =>
        handleIpc(async () => {
          await service.retryFromStage(params.orderId, params.fromStageId);
          return { started: true };
        }, 'order:retryFromStage')
    );

    /**
     * Get retry options
     */
    ipcMain.handle(
      'order:getRetryOptions',
      async (_, orderId: string) =>
        handleIpc(async () => {
          return service.getRetryOptions(orderId);
        }, 'order:getRetryOptions')
    );

    /**
     * Retry from beginning
     */
    ipcMain.handle(
      'order:retryFromBeginning',
      async (_, params: { orderId: string; preserveContext?: boolean }) =>
        handleIpc(async () => {
          await service.retryFromBeginning(params.orderId, params.preserveContext ?? true);
          return { started: true };
        }, 'order:retryFromBeginning')
    );

    /**
     * Enter followup mode
     */
    ipcMain.handle(
      'order:enterFollowup',
      async (_, orderId: string) =>
        handleIpc(async () => {
          await service.enterFollowup(orderId);
          return { success: true };
        }, 'order:enterFollowup')
    );

    /**
     * Execute followup prompt
     */
    ipcMain.handle(
      'order:executeFollowup',
      async (_, orderId: string, prompt: string) => {
        logger.info('executeFollowup called', { orderId, prompt });

        return handleIpc(async () => {
          await service.executeFollowup(orderId, prompt);
          return { started: true };
        }, 'order:executeFollowup');
      }
    );

    /**
     * Finish followup mode
     */
    ipcMain.handle(
      'order:finishFollowup',
      async (_, orderId: string) =>
        handleIpc(async () => {
          await service.finishFollowup(orderId);
          return { success: true };
        }, 'order:finishFollowup')
    );

    /**
     * Check if followup is possible
     */
    ipcMain.handle(
      'order:canFollowup',
      async (_, orderId: string) =>
        handleIpc(async () => {
          return { canFollowup: service.canFollowup(orderId) };
        }, 'order:canFollowup')
    );

    /**
     * Cleanup worktree only (preserve order)
     */
    ipcMain.handle(
      'order:cleanupWorktreeOnly',
      async (_, orderId: string) =>
        handleIpc(async () => {
          return await service.cleanupWorktreeOnly(orderId);
        }, 'order:cleanupWorktreeOnly')
    );

    /**
     * Merge worktree to main branch
     */
    ipcMain.handle(
      'order:mergeWorktreeToMain',
      async (_, params: { orderId: string; targetBranch?: string; deleteAfterMerge?: boolean; squash?: boolean }) =>
        handleIpc(async () => {
          return await service.mergeWorktreeToMain(
            params.orderId,
            params.targetBranch ?? 'main',
            params.deleteAfterMerge ?? true,
            params.squash ?? false
          );
        }, 'order:mergeWorktreeToMain')
    );

    logger.info('Order handlers registered');
  }

  /**
   * Cleanup all intervals
   */
  static cleanup(): void {
    logger.info('Cleaning up...');
    OutputIntervalManager.clearAll();
    logger.info('All intervals cleared');
  }
}

/**
 * Export handlers
 */
export const registerOrderHandlers = OrderManager.registerHandlers.bind(OrderManager);
export const cleanupOrderHandlers = OrderManager.cleanup.bind(OrderManager);

/**
 * Re-export types for external use
 */
export type { CreateOrderWithWorktreeParams, CreateOrderWithWorktreeResult };
