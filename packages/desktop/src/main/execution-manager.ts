/**
 * Execution Manager
 * Phase C: Refactored to use ExecutionFacade for both execution and state management
 * Event handlers extracted to separate classes for better maintainability
 */

import * as path from 'path';
import { BrowserWindow } from 'electron';
import { existsSync } from 'fs';
import { Order, OrderStatus, createLogger, toCodeCafeError, TIMEOUTS } from '@codecafe/core';
import { ExecutionFacade } from '@codecafe/orchestrator';
import type { SessionStatusSummary } from '@codecafe/orchestrator/session';
import { DEFAULT_TERMINAL_POOL_CONFIG } from './config/terminal-pool.config.js';
import { convertAnsiToHtml } from '../common/output-utils.js';
import { parseOutputType } from '../common/output-markers.js';
import { terminalLogger } from './file-logger.js';
import { OrderEventHandler } from './handlers/order-event-handler.js';
import { StageEventHandler } from './handlers/stage-event-handler.js';
import { SessionEventHandler } from './handlers/session-event-handler.js';

const logger = createLogger({ context: 'ExecutionManager' });

interface ExecutionManagerConfig {
  executionFacade: ExecutionFacade;
  mainWindow: BrowserWindow | null;
}

/**
 * Execution Manager - Provider 실행을 관리
 * Event handlers delegated to separate handler classes
 */
export class ExecutionManager {
  private facade: ExecutionFacade;
  private mainWindow: BrowserWindow | null;
  private orderEventHandler: OrderEventHandler;
  private stageEventHandler: StageEventHandler;
  private sessionEventHandler: SessionEventHandler;
  // 메트릭 샘플링 타이머
  private metricsSamplingTimer: NodeJS.Timeout | null = null;

  constructor(config: ExecutionManagerConfig) {
    this.facade = config.executionFacade;
    this.mainWindow = config.mainWindow;

    // Initialize event handlers
    this.orderEventHandler = new OrderEventHandler(this.facade, this.mainWindow);
    this.stageEventHandler = new StageEventHandler(this.facade, this.mainWindow);
    this.sessionEventHandler = new SessionEventHandler(this.facade, this.mainWindow);

    // Setup custom order:output handler for parsing
    this.setupCustomOutputHandler();
  }

  /**
   * 실행 관리자 시작
   */
  async start(): Promise<void> {
    logger.info('Starting...');

    // Setup event handlers
    this.orderEventHandler.setup();
    this.stageEventHandler.setup();
    this.sessionEventHandler.setup();

    // 메트릭 샘플링 타이머 시작 (10초마다 IPC 성능 로깅)
    this.startMetricsSampling();

    // Worktree가 있는 완료된 Order들의 Session 복원
    await this.restoreSessionsForWorktreeOrders();

    logger.info('Started successfully');
  }

  /**
   * 실행 관리자 중지
   */
  async stop(): Promise<void> {
    logger.info('Stopping...');

    // 메트릭 샘플링 타이머 정리
    if (this.metricsSamplingTimer) {
      clearInterval(this.metricsSamplingTimer);
      this.metricsSamplingTimer = null;
    }

    // Cleanup event handlers
    this.orderEventHandler.cleanup();
    this.stageEventHandler.cleanup();
    this.sessionEventHandler.cleanup();

    // Clear metrics
    this.orderEventHandler.clearAllMetrics();
    this.sessionEventHandler.clearActiveExecutions();

    logger.info('Stopped');
  }

  /**
   * mainWindow 참조 업데이트
   */
  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  /**
   * Custom order:output handler for parsing output types
   */
  private setupCustomOutputHandler(): void {
    const originalHandler = this.orderEventHandler;
    const self = this;

    // Override handleOrderOutput behavior
    this.facade.on('order:output', (data: { orderId: string; data: unknown }) => {
      const now = Date.now();

      // Parse output type from markers
      const parsed = parseOutputType(String(data.data));

      // Map user_prompt to user-input for frontend display
      // Map json to tool_result for collapsible treatment
      const outputType = parsed.type === 'user_prompt' ? 'user-input' :
                        parsed.type === 'json' ? 'tool_result' : parsed.type;

      // 1. UI 전송 (실시간 보기용) - order:output 형식으로 전송 (ANSI를 HTML로 변환)
      this.sendToRenderer('order:output', {
        orderId: data.orderId,
        timestamp: new Date().toISOString(),
        type: outputType,
        content: convertAnsiToHtml(parsed.content),
        ...(parsed.stageInfo && { stageInfo: parsed.stageInfo }),
      });

      // 2. Todo 진행률이 있으면 별도 이벤트로 전송
      if (parsed.todoProgress) {
        this.sendToRenderer('order:todo-progress', {
          orderId: data.orderId,
          timestamp: new Date().toISOString(),
          ...parsed.todoProgress,
        });
      }

      // 3. 로그 저장 (지속성용) - 원본 그대로 저장 (마커 포함)
      this.facade.appendOrderLog(data.orderId, String(data.data)).catch((err: Error) => {
        logger.error(`Failed to append log for order ${data.orderId}`, { error: err.message });
      });

      terminalLogger.log(data.orderId, String(data.data)).catch((err: Error) => {
        logger.error(`Failed to write terminal log for order ${data.orderId}`, { error: err.message });
      });
    });
  }

  /**
   * 메트릭 샘플링 타이머 시작
   * 10초마다 활성 Order들의 IPC 성능 메트릭을 로깅
   */
  private startMetricsSampling(): void {
    if (this.metricsSamplingTimer) {
      clearInterval(this.metricsSamplingTimer);
    }

    this.metricsSamplingTimer = setInterval(() => {
      const allMetrics = this.orderEventHandler.getAllMetrics();
      const activeOrders = Array.from(allMetrics.entries());

      if (activeOrders.length === 0) {
        return;
      }

      logger.debug('=== IPC Performance Metrics ===');
      for (const [orderId, metrics] of activeOrders) {
        const now = Date.now();
        const elapsedSinceLastSample = now - metrics.lastSampleTime;
        const chunksSinceLastSample = metrics.totalChunks - metrics.chunksAtLastSample;
        const chunksPerSec = elapsedSinceLastSample > 0
          ? (chunksSinceLastSample / (elapsedSinceLastSample / 1000)).toFixed(2)
          : '0';

        logger.debug(`Order ${orderId}:`, {
          totalChunks: metrics.totalChunks,
          chunksPerSec,
          elapsedMs: elapsedSinceLastSample
        });
      }
      logger.debug('=== End of Metrics ===');
    }, TIMEOUTS.IDLE);
  }

  /**
   * Session 상태 조회
   */
  getSessionStatus(): SessionStatusSummary | { error: string } {
    if (!this.facade) {
      return { error: 'Engine not initialized' };
    }
    return this.facade.getSessionStatus();
  }

  /**
   * ExecutionFacade 조회
   */
  getBaristaEngine(): ExecutionFacade | null {
    return this.facade;
  }

  /**
   * Worktree가 있는 완료된 Order들의 Session 복원
   */
  private async restoreSessionsForWorktreeOrders(): Promise<void> {
    if (!this.facade) {
      logger.warn('Barista engine not initialized, skipping session restore');
      return;
    }

    logger.info('Restoring sessions for worktree orders...');

    try {
      const allOrders = this.facade.getAllOrders();
      logger.info(`Found ${allOrders.length} total orders`);

      const restorableOrders = allOrders.filter((order: Order) => {
        const isCompleted = order.status === OrderStatus.COMPLETED;
        const hasWorktree = order.worktreeInfo?.path &&
          order.worktreeInfo.path.length > 0 &&
          !order.worktreeInfo.removed;
        const pathExists = hasWorktree && existsSync(order.worktreeInfo!.path);
        return isCompleted && hasWorktree && pathExists;
      });

      logger.info(`Found ${restorableOrders.length} orders with valid worktrees to restore`);

      for (const order of restorableOrders) {
        try {
          let barista = this.facade.getAllBaristas().find((b: { provider: string }) => b.provider === order.provider);
          if (!barista) {
            barista = await this.facade.createBarista(order.provider);
            logger.info(`Created barista with provider ${order.provider} for session restore`);
          }

          const cwd = order.worktreeInfo!.path;
          const cafeId = order.cafeId || 'default';

          await this.facade.restoreSessionForFollowup(order, barista!, cafeId, cwd);

          // Register in sessionEventHandler
          this.sessionEventHandler.setActiveExecution(order.id, barista!.id);

          logger.info(`Restored session for order ${order.id} with worktree ${cwd} (followup ready)`);
        } catch (err: unknown) {
          const cafeError = toCodeCafeError(err);
          logger.error(`Failed to restore session for order ${order.id}`, { error: cafeError.message });
        }
      }

      logger.info(`Session restore completed. ${restorableOrders.length} orders restored.`);
    } catch (error: unknown) {
      const cafeError = toCodeCafeError(error);
      logger.error('Error restoring sessions', { error: cafeError.message });
    }
  }

  /**
   * Renderer에 메시지 전송
   */
  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
}

let executionManager: ExecutionManager | null = null;

/**
 * ExecutionManager 초기화
 */
export async function initExecutionManager(
  executionFacade: ExecutionFacade,
  mainWindow: BrowserWindow | null
): Promise<ExecutionManager> {
  if (executionManager) {
    await executionManager.stop();
  }

  executionManager = new ExecutionManager({
    executionFacade,
    mainWindow,
  });

  await executionManager.start();
  return executionManager;
}

/**
 * ExecutionManager 인스턴스 반환
 */
export function getExecutionManager(): ExecutionManager | null {
  return executionManager;
}

/**
 * ExecutionManager 정리
 */
export async function cleanupExecutionManager(): Promise<void> {
  if (executionManager) {
    await executionManager.stop();
    executionManager = null;
  }
}
