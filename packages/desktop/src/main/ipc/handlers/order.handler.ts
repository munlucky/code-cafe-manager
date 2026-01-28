/**
 * Order IPC Handlers
 * Phase C: ExecutionFacade(orchestrator) 사용, Orchestrator(core) 제거
 * Thin layer that delegates to OrderService for business logic
 */

import { ipcMain } from 'electron';
import { ExecutionFacade } from '@codecafe/orchestrator';
import { createLogger, toCodeCafeError } from '@codecafe/core';
import { getExecutionManager } from '../../execution-manager.js';
import {
  OrderService,
  CreateOrderWithWorktreeParams,
  CreateOrderWithWorktreeResult,
} from '../../services/order-service.js';
import { OutputIntervalManager } from '../utils/output-interval-manager.js';

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
    details?: unknown;
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
    return { success: true, data };
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
 * Helper to register IPC handler with standard error handling
 */
function registerHandler<T extends unknown[], R>(
  channel: string,
  handler: (...args: T) => R | Promise<R>
): void {
  ipcMain.handle(channel, async (_, ...args) =>
    handleIpc(async () => handler(...args as T), channel)
  );
}

/**
 * Order IPC Handlers Registration
 * Phase C: ExecutionFacade 사용
 */
export function registerOrderHandlers(facade: ExecutionFacade): void {
  const orderService = new OrderService({
    facade,
    getExecutionManager,
  });

  // Order CRUD
  registerHandler('order:createWithWorktree', (params: CreateOrderWithWorktreeParams) =>
    orderService.createOrderWithWorktree(params)
  );

  registerHandler(
    'order:create',
    (params: {
      workflowId: string;
      workflowName: string;
      counter: string;
      provider?: string;
      vars?: Record<string, string>;
    }) => orderService.createOrder(params)
  );

  registerHandler('order:get', (orderId: string) => orderService.getOrder(orderId));

  registerHandler('order:getAll', () => orderService.getAllOrders());

  registerHandler('order:cancel', (orderId: string) =>
    orderService.cancelOrder(orderId).then(() => ({ cancelled: true }))
  );

  registerHandler('order:delete', (orderId: string) =>
    orderService.deleteOrder(orderId).then((deleted) => ({ deleted }))
  );

  registerHandler('order:deleteMany', (orderIds: string[]) =>
    orderService.deleteOrders(orderIds)
  );

  // Execution
  registerHandler(
    'order:execute',
    (orderId: string, prompt: string, vars?: Record<string, string>) =>
      orderService.executeOrder(orderId, prompt, vars).then(() => ({ started: true }))
  );

  registerHandler('order:sendInput', (orderId: string, message: string) =>
    orderService.sendInput(orderId, message).then(() => ({ sent: true }))
  );

  registerHandler('order:getLog', (orderId: string) => orderService.getOrderLog(orderId));

  registerHandler('receipt:getAll', () => orderService.getReceipts());

  // Output subscription
  registerHandler('order:subscribeOutput', (orderId: string) => {
    logger.info('Subscribe to order output', { orderId });
    OutputIntervalManager.clear(orderId);
    return orderService.getOutputHistory(orderId).then((history) => ({
      subscribed: true,
      history,
    }));
  });

  registerHandler('order:unsubscribeOutput', (orderId: string) => {
    OutputIntervalManager.clear(orderId);
    logger.info('Unsubscribed from order output', { orderId });
    return Promise.resolve({ unsubscribed: true });
  });

  // Retry operations
  registerHandler(
    'order:retryWorktree',
    (params: {
      orderId: string;
      cafeId: string;
      worktreeOptions?: { baseBranch?: string; branchPrefix?: string };
    }) => orderService.retryWorktree(params.orderId, params.cafeId, params.worktreeOptions)
  );

  registerHandler(
    'order:retryFromStage',
    (params: { orderId: string; fromStageId?: string }) =>
      orderService.retryFromStage(params.orderId, params.fromStageId).then(() => ({
        started: true,
      }))
  );

  registerHandler('order:getRetryOptions', (orderId: string) =>
    orderService.getRetryOptions(orderId)
  );

  registerHandler(
    'order:retryFromBeginning',
    (params: { orderId: string; preserveContext?: boolean }) =>
      orderService
        .retryFromBeginning(params.orderId, params.preserveContext ?? true)
        .then(() => ({ started: true }))
  );

  // Followup mode
  registerHandler('order:enterFollowup', (orderId: string) =>
    orderService.enterFollowup(orderId).then(() => ({ success: true }))
  );

  registerHandler('order:executeFollowup', (orderId: string, prompt: string) => {
    logger.info('executeFollowup called', { orderId, prompt });
    return orderService.executeFollowup(orderId, prompt).then(() => ({ started: true }));
  });

  registerHandler('order:finishFollowup', (orderId: string) =>
    orderService.finishFollowup(orderId).then(() => ({ success: true }))
  );

  registerHandler('order:canFollowup', (orderId: string) => ({
    canFollowup: orderService.canFollowup(orderId),
  }));

  // Worktree operations
  registerHandler('order:cleanupWorktreeOnly', (orderId: string) =>
    orderService.cleanupWorktreeOnly(orderId)
  );

  registerHandler(
    'order:mergeWorktreeToMain',
    (params: {
      orderId: string;
      targetBranch?: string;
      deleteAfterMerge?: boolean;
      squash?: boolean;
    }) =>
      orderService.mergeWorktreeToMain(
        params.orderId,
        params.targetBranch ?? 'main',
        params.deleteAfterMerge ?? true,
        params.squash ?? false
      )
  );

  logger.info('Order handlers registered');
}

/**
 * Cleanup all intervals
 */
export function cleanupOrderHandlers(): void {
  logger.info('Cleaning up...');
  OutputIntervalManager.clearAll();
  logger.info('All intervals cleared');
}

/**
 * Re-export types for external use
 */
export type { CreateOrderWithWorktreeParams, CreateOrderWithWorktreeResult };
