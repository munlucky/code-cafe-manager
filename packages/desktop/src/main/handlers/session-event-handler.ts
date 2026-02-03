/**
 * Session Event Handler
 * Handles session-level events from ExecutionFacade
 */

import { BrowserWindow } from 'electron';
import { ExecutionFacade } from '@codecafe/orchestrator';
import { createLogger } from '@codecafe/core';

const logger = createLogger({ context: 'SessionEventHandler' });

/**
 * Session Event Handler
 * Manages session-level events (execution, input)
 */
export class SessionEventHandler {
  private activeExecutions = new Map<string, { baristaId: string }>();

  constructor(
    private readonly facade: ExecutionFacade,
    private readonly mainWindow: BrowserWindow | null,
  ) {}

  /**
   * Register all session event listeners
   */
  setup(): void {
    this.facade.on('order:execution-started', async (data: { orderId: string; baristaId: string; prompt: string }) => {
      logger.info('Received order:execution-started', {
        orderId: data.orderId,
        baristaId: data.baristaId
      });
      await this.handleOrderExecution(data.orderId, data.baristaId, data.prompt);
    });

    this.facade.on('order:input', async (data: { orderId: string; message: string }) => {
      logger.info('Received order:input', { orderId: data.orderId });
      await this.handleOrderInput(data.orderId, data.message);
    });

    this.facade.on('order:event', (event: { type: string; orderId: string; data: unknown }) => {
      logger.debug('Received order:event', {
        type: event.type,
        orderId: event.orderId
      });

      // Forward order status change events to renderer
      if (event.type === 'ORDER_STATUS_CHANGED') {
        this.sendToRenderer('order:status-changed', {
          orderId: event.orderId,
          status: (event.data as { status: string }).status,
        });
      }
    });
  }

  /**
   * Remove all session event listeners
   */
  cleanup(): void {
    this.facade.removeAllListeners('order:execution-started');
    this.facade.removeAllListeners('order:input');
    this.facade.removeAllListeners('order:event');
  }

  /**
   * Get active executions
   */
  getActiveExecutions(): Map<string, { baristaId: string }> {
    return this.activeExecutions;
  }

  /**
   * Set active execution
   */
  setActiveExecution(orderId: string, baristaId: string): void {
    this.activeExecutions.set(orderId, { baristaId });
  }

  /**
   * Remove active execution
   */
  removeActiveExecution(orderId: string): void {
    this.activeExecutions.delete(orderId);
  }

  /**
   * Clear all active executions
   */
  clearActiveExecutions(): void {
    this.activeExecutions.clear();
  }

  private async handleOrderExecution(orderId: string, baristaId: string, prompt: string): Promise<void> {
    const order = this.facade.getOrder(orderId);
    const barista = this.facade.getBarista(baristaId);

    if (!order || !barista) {
      logger.error('Order or Barista not found', { orderId, baristaId });
      await this.facade.completeOrder(orderId, false, 'Order or Barista not found');
      return;
    }

    this.activeExecutions.set(orderId, { baristaId });

    // Notify UI of execution start
    this.sendToRenderer('order:execution-progress', {
      orderId,
      stage: 'starting',
      message: 'Execution started',
    });

    try {
      // Execute order via ExecutionFacade
      await this.facade.executeOrder({ ...order, prompt } as any, barista);

      // Check session status
      const sessionStatus = this.facade.getSessionStatus();
      logger.debug(`Session status for order ${orderId}`, { sessionStatus });

      const isAwaitingInput = sessionStatus &&
        typeof sessionStatus === 'object' &&
        'sessions' in sessionStatus &&
        Array.isArray(sessionStatus.sessions) &&
        (sessionStatus.sessions as any[]).some((s: any) => s.orderId === orderId && s.status === 'awaiting_input');

      logger.debug(`isAwaitingInput check: ${isAwaitingInput}`);

      if (isAwaitingInput) {
        logger.info(`Order ${orderId} is awaiting user input - not completing`);
        return;
      }

      // Complete successfully
      await this.facade.completeOrder(orderId, true);

      this.sendToRenderer('order:execution-progress', {
        orderId,
        stage: 'completed',
        message: 'Execution completed successfully',
      });

    } catch (error: unknown) {
      const { toCodeCafeError } = require('@codecafe/core');
      const cafeError = toCodeCafeError(error);
      logger.error('Execution failed', { error: cafeError.message });

      // Complete with failure
      await this.facade.completeOrder(orderId, false, cafeError.message);

      this.sendToRenderer('order:execution-progress', {
        orderId,
        stage: 'failed',
        message: cafeError.message,
        error: true,
      });
    } finally {
      // Check if session is still awaiting input before removing from active executions
      const sessionStatus = this.facade?.getSessionStatus();
      const isAwaitingInput = sessionStatus &&
        typeof sessionStatus === 'object' &&
        'sessions' in sessionStatus &&
        Array.isArray(sessionStatus.sessions) &&
        (sessionStatus.sessions as any[]).some((s: any) => s.orderId === orderId && s.status === 'awaiting_input');

      if (!isAwaitingInput) {
        this.activeExecutions.delete(orderId);
      }
    }
  }

  private async handleOrderInput(orderId: string, message: string): Promise<void> {
    if (!this.facade) {
      logger.error('Barista engine not initialized');
      return;
    }

    const execution = this.activeExecutions.get(orderId);

    // If not in active executions, check for restorable completed order
    if (!execution) {
      const order = this.facade.getOrder(orderId);
      const { existsSync } = require('fs');
      if (order && order.worktreeInfo?.path && !order.worktreeInfo.removed && existsSync(order.worktreeInfo.path)) {
        logger.info(`Restoring session for order ${orderId} on-demand (worktree exists)`);

        try {
          let barista = this.facade.getAllBaristas().find((b: { provider: string }) => b.provider === order.provider);
          if (!barista) {
            barista = await this.facade.createBarista(order.provider);
          }

          const cwd = order.worktreeInfo!.path;
          const cafeId = order.cafeId || 'default';

          await this.facade.restoreSessionForFollowup(order, barista!, cafeId, cwd);
          this.activeExecutions.set(orderId, { baristaId: barista!.id });

          logger.info(`Session restored for order ${orderId}, executing followup`);

          await this.facade.executeFollowup(orderId, message);

          this.sendToRenderer('order:execution-progress', {
            orderId,
            stage: 'followup-started',
            message: `Followup request sent: ${message.substring(0, 50)}...`,
          });

          return;
        } catch (error: unknown) {
          const { toCodeCafeError } = require('@codecafe/core');
          const cafeError = toCodeCafeError(error);
          logger.error(`Failed to restore and execute followup for order ${orderId}`, {
            error: cafeError.message
          });
          return;
        }
      }

      logger.warn('No active execution for order', { orderId });
      return;
    }

    // Handle input for active executions or completed orders
    const sessionStatus = this.facade.getOrderSessionStatus(orderId);
    const order = this.facade.getOrder(orderId);
    const { existsSync } = require('fs');

    const isCompletedOrder = order && (
      order.status === 'COMPLETED' ||
      (order.worktreeInfo?.path && !order.worktreeInfo.removed)
    );

    if (sessionStatus === 'completed' || sessionStatus === 'followup' ||
        (sessionStatus === null && isCompletedOrder && order.worktreeInfo?.path && existsSync(order.worktreeInfo.path))) {
      logger.info(`Order ${orderId} is in ${sessionStatus || 'restored'} state, executing followup`);

      try {
        await this.facade.executeFollowup(orderId, message);

        this.sendToRenderer('order:execution-progress', {
          orderId,
          stage: 'followup-started',
          message: `Followup request sent: ${message.substring(0, 50)}...`,
        });
      } catch (error: unknown) {
        const { toCodeCafeError } = require('@codecafe/core');
        const cafeError = toCodeCafeError(error);
        logger.error('Failed to execute followup', { error: cafeError.message });
      }
      return;
    }

    // Send input to running order
    try {
      await this.facade.sendInput(orderId, message);
      logger.info('Input sent to order', { orderId });

      this.sendToRenderer('order:execution-progress', {
        orderId,
        stage: 'input-sent',
        message: `Input sent: ${message.substring(0, 50)}...`,
      });
    } catch (error: unknown) {
      const { toCodeCafeError } = require('@codecafe/core');
      const cafeError = toCodeCafeError(error);
      logger.error('Failed to send input', { error: cafeError.message });
    }
  }

  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
}
