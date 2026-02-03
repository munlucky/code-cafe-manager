/**
 * Order IPC Handlers
 * Phase C: ExecutionFacade(orchestrator) 사용, Orchestrator(core) 제거
 * Thin layer that delegates to OrderService for business logic
 */

import { ExecutionFacade } from '@codecafe/orchestrator';
import { createLogger } from '@codecafe/core';
import { getExecutionManager } from '../../execution-manager.js';
import {
  OrderService,
  CreateOrderWithWorktreeParams,
  CreateOrderWithWorktreeResult,
} from '../../services/order-service.js';
import { OutputIntervalManager } from '../utils/output-interval-manager.js';
import { createIpcHandler, type IpcResponse } from '../utils/handler-wrapper.js';

const logger = createLogger({ context: 'IPC:Order' });

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
  createIpcHandler('order:createWithWorktree', (params: CreateOrderWithWorktreeParams) =>
    orderService.createOrderWithWorktree(params)
  );

  createIpcHandler(
    'order:create',
    (params: {
      workflowId: string;
      workflowName: string;
      counter: string;
      provider?: string;
      vars?: Record<string, string>;
    }) => orderService.createOrder(params)
  );

  createIpcHandler('order:get', (orderId: string) => orderService.getOrder(orderId));

  createIpcHandler('order:getAll', () => orderService.getAllOrders());

  createIpcHandler('order:cancel', (orderId: string) =>
    orderService.cancelOrder(orderId).then(() => ({ cancelled: true }))
  );

  createIpcHandler('order:delete', (orderId: string) =>
    orderService.deleteOrder(orderId).then((deleted) => ({ deleted }))
  );

  createIpcHandler('order:deleteMany', (orderIds: string[]) =>
    orderService.deleteOrders(orderIds)
  );

  // Execution
  createIpcHandler(
    'order:execute',
    (orderId: string, prompt: string, vars?: Record<string, string>) =>
      orderService.executeOrder(orderId, prompt, vars).then(() => ({ started: true }))
  );

  createIpcHandler('order:sendInput', (orderId: string, message: string) =>
    orderService.sendInput(orderId, message).then(() => ({ sent: true }))
  );

  createIpcHandler('order:getLog', (orderId: string) => orderService.getOrderLog(orderId));

  createIpcHandler('receipt:getAll', () => orderService.getReceipts());

  // Output subscription
  createIpcHandler('order:subscribeOutput', (orderId: string) => {
    logger.info('Subscribe to order output', { orderId });
    OutputIntervalManager.clear(orderId);
    return orderService.getOutputHistory(orderId).then((history) => ({
      subscribed: true,
      history,
    }));
  });

  createIpcHandler('order:unsubscribeOutput', (orderId: string) => {
    OutputIntervalManager.clear(orderId);
    logger.info('Unsubscribed from order output', { orderId });
    return Promise.resolve({ unsubscribed: true });
  });

  // Retry operations
  createIpcHandler(
    'order:retryWorktree',
    (params: {
      orderId: string;
      cafeId: string;
      worktreeOptions?: { baseBranch?: string; branchPrefix?: string };
    }) => orderService.retryWorktree(params.orderId, params.cafeId, params.worktreeOptions)
  );

  createIpcHandler(
    'order:retryFromStage',
    (params: { orderId: string; fromStageId?: string }) =>
      orderService.retryFromStage(params.orderId, params.fromStageId).then(() => ({
        started: true,
      }))
  );

  createIpcHandler('order:getRetryOptions', (orderId: string) =>
    orderService.getRetryOptions(orderId)
  );

  createIpcHandler(
    'order:retryFromBeginning',
    (params: { orderId: string; preserveContext?: boolean }) =>
      orderService
        .retryFromBeginning(params.orderId, params.preserveContext ?? true)
        .then(() => ({ started: true }))
  );

  // Followup mode
  createIpcHandler('order:enterFollowup', (orderId: string) =>
    orderService.enterFollowup(orderId).then(() => ({ success: true }))
  );

  createIpcHandler('order:executeFollowup', (orderId: string, prompt: string) => {
    logger.info('executeFollowup called', { orderId, prompt });
    return orderService.executeFollowup(orderId, prompt).then(() => ({ started: true }));
  });

  createIpcHandler('order:finishFollowup', (orderId: string) =>
    orderService.finishFollowup(orderId).then(() => ({ success: true }))
  );

  createIpcHandler('order:canFollowup', (orderId: string) => ({
    canFollowup: orderService.canFollowup(orderId),
  }));

  // Worktree operations
  createIpcHandler('order:cleanupWorktreeOnly', (orderId: string) =>
    orderService.cleanupWorktreeOnly(orderId)
  );

  createIpcHandler(
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
