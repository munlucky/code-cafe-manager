/**
 * Execution Manager
 * Orchestrator의 order:execution-started 이벤트를 받아 BaristaEngineV2를 통해 실제 실행
 */

import * as path from 'path';
import { BrowserWindow } from 'electron';
import { Orchestrator, Order, Barista } from '@codecafe/core';
import { BaristaEngineV2, TerminalPool } from '@codecafe/orchestrator';
import type {
  OrderStartedEvent,
  OrderCompletedEvent,
  OrderFailedEvent,
  StageStartedEvent,
  StageCompletedEvent,
  StageFailedEvent,
  SessionStatusSummary,
} from '@codecafe/orchestrator/session';
import { DEFAULT_TERMINAL_POOL_CONFIG } from './config/terminal-pool.config.js';

interface ExecutionManagerConfig {
  orchestrator: Orchestrator;
  mainWindow: BrowserWindow | null;
}

/**
 * Execution Manager - Provider 실행을 관리
 */
export class ExecutionManager {
  private orchestrator: Orchestrator;
  private mainWindow: BrowserWindow | null;
  private terminalPool: TerminalPool | null = null;
  private baristaEngine: BaristaEngineV2 | null = null;
  private activeExecutions = new Map<string, { baristaId: string }>();

  constructor(config: ExecutionManagerConfig) {
    this.orchestrator = config.orchestrator;
    this.mainWindow = config.mainWindow;
  }

  /**
   * 실행 관리자 시작
   */
  async start(): Promise<void> {
    console.log('[ExecutionManager] Starting...');

    // Terminal Pool 초기화
    await this.initTerminalPool();

    // Barista Engine 초기화
    this.baristaEngine = new BaristaEngineV2(this.terminalPool!);

    // Barista Engine 이벤트 리스너 설정
    this.setupBaristaEngineEvents();

    // Orchestrator 이벤트 리스너 설정
    this.setupEventListeners();

    console.log('[ExecutionManager] Started successfully');
  }

  /**
   * 실행 관리자 중지
   */
  async stop(): Promise<void> {
    console.log('[ExecutionManager] Stopping...');

    if (this.baristaEngine) {
      await this.baristaEngine.dispose();
      this.baristaEngine = null;
    }

    if (this.terminalPool) {
      await this.terminalPool.dispose();
      this.terminalPool = null;
    }

    console.log('[ExecutionManager] Stopped');
  }

  /**
   * mainWindow 참조 업데이트
   */
  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  /**
   * Terminal Pool 초기화
   */
  private async initTerminalPool(): Promise<void> {
    const appRoot = process.cwd();
    // Resolve project root (repo root) assuming we are running from packages/desktop during dev
    // If packaged or running from root, handle accordingly
    const projectRoot = appRoot.includes('packages') 
      ? path.resolve(appRoot, '..', '..') 
      : appRoot;

    console.log(`[ExecutionManager] Initializing Terminal Pool with CWD: ${projectRoot}`);

    const poolConfig = {
      ...DEFAULT_TERMINAL_POOL_CONFIG,
      cwd: projectRoot,
    };

    this.terminalPool = new TerminalPool(poolConfig);
    console.log('[ExecutionManager] Terminal pool initialized');
  }

  /**
   * Barista Engine 이벤트 리스너 설정
   */
  private setupBaristaEngineEvents(): void {
    if (!this.baristaEngine) return;

    // order:output - 터미널 출력
    this.baristaEngine.on('order:output', (data: { orderId: string; data: string }) => {
      // 1. UI 전송 (실시간 보기용) - order:output 형식으로 전송
      this.sendToRenderer('order:output', {
        orderId: data.orderId,
        timestamp: new Date().toISOString(),
        type: 'stdout',
        content: data.data,
      });

      // 2. 로그 저장 (지속성용)
      this.orchestrator.appendOrderLog(data.orderId, data.data).catch((err: Error) => {
        console.error(`[ExecutionManager] Failed to append log for order ${data.orderId}:`, err);
      });
    });

    // Session 관련 이벤트들
    this.baristaEngine.on('order:started', (data: OrderStartedEvent) => {
      console.log('[ExecutionManager] Order started (session):', data.orderId);
      this.sendToRenderer('order:session-started', data);
    });

    this.baristaEngine.on('order:completed', (data: OrderCompletedEvent) => {
      console.log('[ExecutionManager] Order completed (session):', data.orderId);
      this.sendToRenderer('order:session-completed', data);
    });

    this.baristaEngine.on('order:failed', (data: OrderFailedEvent) => {
      console.log('[ExecutionManager] Order failed (session):', data.orderId);
      this.sendToRenderer('order:session-failed', data);
    });

    // Stage 이벤트들
    this.baristaEngine.on('stage:started', (data: StageStartedEvent) => {
      console.log('[ExecutionManager] Stage started:', data.stageId);
      this.sendToRenderer('order:stage-started', {
        orderId: data.orderId,
        stageId: data.stageId,
        provider: data.provider,
      });
    });

    this.baristaEngine.on('stage:completed', (data: StageCompletedEvent) => {
      console.log('[ExecutionManager] Stage completed:', data.stageId);
      this.sendToRenderer('order:stage-completed', {
        orderId: data.orderId,
        stageId: data.stageId,
        output: data.output,
        duration: data.duration,
      });
    });

    this.baristaEngine.on('stage:failed', (data: StageFailedEvent) => {
      console.log('[ExecutionManager] Stage failed:', data.stageId);
      this.sendToRenderer('order:stage-failed', {
        orderId: data.orderId,
        stageId: data.stageId,
        error: data.error,
      });
    });
  }

  /**
   * Orchestrator 이벤트 리스너 설정
   */
  private setupEventListeners(): void {
    // order:execution-started 이벤트 처리
    this.orchestrator.on('order:execution-started', async (data: { orderId: string; baristaId: string; prompt: string }) => {
      console.log('[ExecutionManager] Received order:execution-started:', data);
      await this.handleOrderExecution(data.orderId, data.baristaId, data.prompt);
    });

    // order:input 이벤트 처리
    this.orchestrator.on('order:input', async (data: { orderId: string; message: string }) => {
      console.log('[ExecutionManager] Received order:input:', data);
      await this.handleOrderInput(data.orderId, data.message);
    });
  }

  /**
   * Order 실행 처리
   */
  private async handleOrderExecution(orderId: string, baristaId: string, prompt: string): Promise<void> {
    if (!this.baristaEngine) {
      console.error('[ExecutionManager] Barista engine not initialized');
      await this.orchestrator.completeOrder(orderId, false, 'Execution engine not initialized');
      return;
    }

    const order = this.orchestrator.getOrder(orderId);
    const barista = this.orchestrator.getBarista(baristaId);

    if (!order || !barista) {
      console.error('[ExecutionManager] Order or Barista not found:', { orderId, baristaId });
      await this.orchestrator.completeOrder(orderId, false, 'Order or Barista not found');
      return;
    }

    this.activeExecutions.set(orderId, { baristaId });

    // UI에 실행 시작 알림
    this.sendToRenderer('order:execution-progress', {
      orderId,
      stage: 'starting',
      message: 'Execution started',
    });

    try {
      // 프롬프트를 order의 context에 추가
      const executionOrder = {
        ...order,
        prompt,
      };

      // BaristaEngineV2를 통해 실행
      await this.baristaEngine.executeOrder(executionOrder as Order, barista);

      // 성공 처리
      await this.orchestrator.completeOrder(orderId, true);

      this.sendToRenderer('order:execution-progress', {
        orderId,
        stage: 'completed',
        message: 'Execution completed successfully',
      });

    } catch (error: any) {
      console.error('[ExecutionManager] Execution failed:', error);

      // 실패 처리
      await this.orchestrator.completeOrder(orderId, false, error.message || 'Execution failed');

      this.sendToRenderer('order:execution-progress', {
        orderId,
        stage: 'failed',
        message: error.message || 'Execution failed',
        error: true,
      });
    } finally {
      this.activeExecutions.delete(orderId);
    }
  }

  /**
   * Order 입력 처리
   */
  private async handleOrderInput(orderId: string, message: string): Promise<void> {
    if (!this.baristaEngine) {
      console.error('[ExecutionManager] Barista engine not initialized');
      return;
    }

    const execution = this.activeExecutions.get(orderId);
    if (!execution) {
      console.warn('[ExecutionManager] No active execution for order:', orderId);
      return;
    }

    try {
      await this.baristaEngine.sendInput(orderId, message);
      console.log('[ExecutionManager] Input sent to order:', orderId);

      // UI에 입력 전송 알림
      this.sendToRenderer('order:execution-progress', {
        orderId,
        stage: 'input-sent',
        message: `Input sent: ${message.substring(0, 50)}...`,
      });
    } catch (error: any) {
      console.error('[ExecutionManager] Failed to send input:', error);
    }
  }

  /**
   * Renderer에 메시지 전송
   */
  private sendToRenderer(channel: string, data: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  /**
   * Session 상태 조회
   */
  getSessionStatus(): SessionStatusSummary | { error: string } {
    if (!this.baristaEngine) {
      return { error: 'Engine not initialized' };
    }
    return this.baristaEngine.getSessionStatus();
  }

  /**
   * BaristaEngine 조회
   */
  getBaristaEngine(): BaristaEngineV2 | null {
    return this.baristaEngine;
  }
}

let executionManager: ExecutionManager | null = null;

/**
 * ExecutionManager 초기화
 */
export async function initExecutionManager(
  orchestrator: Orchestrator,
  mainWindow: BrowserWindow | null
): Promise<ExecutionManager> {
  if (executionManager) {
    await executionManager.stop();
  }

  executionManager = new ExecutionManager({
    orchestrator,
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
