/**
 * Order Event Handler
 * Handles order-level events from ExecutionFacade
 */

import { BrowserWindow } from 'electron';
import { ExecutionFacade } from '@codecafe/orchestrator';
import { createLogger } from '@codecafe/core';
import type { SessionStatusSummary } from '@codecafe/orchestrator/session';

const logger = createLogger({ context: 'OrderEventHandler' });

interface OrderOutputData {
  orderId: string;
  data: unknown;
}

interface OrderStartedData {
  orderId: string;
  status: SessionStatusSummary;
}

interface OrderCompletedData {
  orderId: string;
  status: SessionStatusSummary;
}

interface OrderFailedData {
  orderId: string;
  error: string;
  status?: SessionStatusSummary;
}

/**
 * Output metrics for IPC performance monitoring
 */
interface OutputMetrics {
  orderId: string;
  totalChunks: number;
  startTime: number;
  lastSampleTime: number;
  chunksAtLastSample: number;
  orderStartTime?: number;
}

/**
 * Order Event Handler
 * Manages order lifecycle events and forwards them to renderer
 */
export class OrderEventHandler {
  private outputMetrics = new Map<string, OutputMetrics>();

  constructor(
    private readonly facade: ExecutionFacade,
    private readonly mainWindow: BrowserWindow | null,
  ) {}

  /**
   * Register all order event listeners
   */
  setup(): void {
    // order:output - 터미널 출력
    this.facade.on('order:output', (data: OrderOutputData) => {
      this.handleOrderOutput(data);
    });

    // order:started
    this.facade.on('order:started', (data: OrderStartedData) => {
      this.handleOrderStarted(data);
    });

    // order:completed
    this.facade.on('order:completed', (data: OrderCompletedData) => {
      this.handleOrderCompleted(data);
    });

    // order:failed
    this.facade.on('order:failed', (data: OrderFailedData) => {
      this.handleOrderFailed(data);
    });

    // order:awaiting-input
    this.facade.on('order:awaiting-input', (data: { orderId: string }) => {
      this.handleAwaitingInput(data);
    });

    // Followup events
    this.facade.on('order:followup', (data: { orderId: string }) => {
      this.handleFollowup(data);
    });

    this.facade.on('order:followup-started', (data: { orderId: string; prompt: string }) => {
      this.handleFollowupStarted(data);
    });

    this.facade.on('order:followup-completed', (data: { orderId: string; stageId?: string; output?: string }) => {
      this.handleFollowupCompleted(data);
    });

    this.facade.on('order:followup-failed', (data: { orderId: string; stageId?: string; error?: string }) => {
      this.handleFollowupFailed(data);
    });

    this.facade.on('order:followup-finished', (data: { orderId: string }) => {
      this.handleFollowupFinished(data);
    });
  }

  /**
   * Remove all order event listeners
   */
  cleanup(): void {
    this.facade.removeAllListeners('order:output');
    this.facade.removeAllListeners('order:started');
    this.facade.removeAllListeners('order:completed');
    this.facade.removeAllListeners('order:failed');
    this.facade.removeAllListeners('order:awaiting-input');
    this.facade.removeAllListeners('order:followup');
    this.facade.removeAllListeners('order:followup-started');
    this.facade.removeAllListeners('order:followup-completed');
    this.facade.removeAllListeners('order:followup-failed');
    this.facade.removeAllListeners('order:followup-finished');
  }

  /**
   * Get metrics for an order
   */
  getMetrics(orderId: string): OutputMetrics | undefined {
    return this.outputMetrics.get(orderId);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, OutputMetrics> {
    return this.outputMetrics;
  }

  /**
   * Clear metrics for an order
   */
  clearMetrics(orderId: string): void {
    this.outputMetrics.delete(orderId);
  }

  /**
   * Clear all metrics
   */
  clearAllMetrics(): void {
    this.outputMetrics.clear();
  }

  private handleOrderOutput(data: OrderOutputData): void {
    const now = Date.now();

    // Collect metrics
    let metrics = this.outputMetrics.get(data.orderId);
    if (!metrics) {
      metrics = {
        orderId: data.orderId,
        totalChunks: 0,
        startTime: now,
        lastSampleTime: now,
        chunksAtLastSample: 0,
      };
      this.outputMetrics.set(data.orderId, metrics);
    }
    metrics.totalChunks++;

    // Parse output type and send to renderer
    // Note: Actual parsing is done by execution-manager via parseOutputType
    // This handler focuses on forwarding the event
    this.sendToRenderer('order:output', {
      orderId: data.orderId,
      timestamp: new Date().toISOString(),
      data: data.data,
    });
  }

  private handleOrderStarted(data: OrderStartedData): void {
    const now = Date.now();

    logger.info(`Order STARTED event received: ${data.orderId}`);

    // Initialize metrics
    let metrics = this.outputMetrics.get(data.orderId);
    if (!metrics) {
      metrics = {
        orderId: data.orderId,
        totalChunks: 0,
        startTime: now,
        lastSampleTime: now,
        chunksAtLastSample: 0,
        orderStartTime: now,
      };
    } else {
      metrics.orderStartTime = now;
    }
    this.outputMetrics.set(data.orderId, metrics);

    this.sendToRenderer('order:session-started', data);
  }

  private handleOrderCompleted(data: OrderCompletedData): void {
    const now = Date.now();
    const metrics = this.outputMetrics.get(data.orderId);
    const duration = metrics?.orderStartTime
      ? now - metrics.orderStartTime
      : 0;

    logger.info(`Order COMPLETED: ${data.orderId}`, {
      duration: `${duration}ms`,
      totalChunks: metrics?.totalChunks || 0
    });

    this.sendToRenderer('order:session-completed', data);
    this.sendToRenderer('order:completed', data);

    // Clean up metrics after 1 minute
    setTimeout(() => {
      this.outputMetrics.delete(data.orderId);
    }, 60000);
  }

  private handleOrderFailed(data: OrderFailedData): void {
    const now = Date.now();
    const metrics = this.outputMetrics.get(data.orderId);
    const duration = metrics?.orderStartTime
      ? now - metrics.orderStartTime
      : 0;

    logger.error(`Order FAILED: ${data.orderId}`, {
      duration: `${duration}ms`,
      totalChunks: metrics?.totalChunks || 0,
      error: data.error || 'Unknown'
    });

    this.sendToRenderer('order:session-failed', data);
    this.sendToRenderer('order:failed', data);

    // Clean up metrics
    this.outputMetrics.delete(data.orderId);
  }

  private handleAwaitingInput(data: { orderId: string }): void {
    logger.info(`Order AWAITING INPUT: ${data.orderId}`);
    this.sendToRenderer('order:awaiting-input', data);
  }

  private handleFollowup(data: { orderId: string }): void {
    logger.info(`Order FOLLOWUP MODE: ${data.orderId}`);
    this.sendToRenderer('order:followup', data);
  }

  private handleFollowupStarted(data: { orderId: string; prompt: string }): void {
    logger.info(`Order FOLLOWUP STARTED: ${data.orderId}`);
    this.sendToRenderer('order:followup-started', data);
  }

  private handleFollowupCompleted(data: { orderId: string; stageId?: string; output?: string }): void {
    logger.info(`Order FOLLOWUP COMPLETED: ${data.orderId}`);
    this.sendToRenderer('order:followup-completed', data);
  }

  private handleFollowupFailed(data: { orderId: string; stageId?: string; error?: string }): void {
    logger.error(`Order FOLLOWUP FAILED: ${data.orderId}`, {
      error: data.error || 'Unknown'
    });
    this.sendToRenderer('order:followup-failed', data);
  }

  private handleFollowupFinished(data: { orderId: string }): void {
    logger.info(`Order FOLLOWUP FINISHED: ${data.orderId}`);
    this.sendToRenderer('order:followup-finished', data);
  }

  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
}
