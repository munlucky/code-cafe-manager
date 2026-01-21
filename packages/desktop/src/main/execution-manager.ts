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
import { convertAnsiToHtml } from '../common/output-utils.js';
import { parseOutputType } from '../common/output-markers.js';

interface ExecutionManagerConfig {
  orchestrator: Orchestrator;
  mainWindow: BrowserWindow | null;
}

/**
 * 출력 메트릭 (Order별 IPC 전송 성능)
 */
interface OutputMetrics {
  orderId: string;
  totalChunks: number;
  startTime: number;
  lastSampleTime: number;
  chunksAtLastSample: number;
  orderStartTime?: number; // Order 시작 시각
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
  // 이벤트 리스너 중복 등록 방지용 플래그
  private eventListenersRegistered = false;
  // 출력 메트릭 (IPC 성능 모니터링용)
  private outputMetrics = new Map<string, OutputMetrics>();
  // 메트릭 샘플링 타이머
  private metricsSamplingTimer: NodeJS.Timeout | null = null;

  constructor(config: ExecutionManagerConfig) {
    this.orchestrator = config.orchestrator;
    this.mainWindow = config.mainWindow;
  }

  /**
   * 실행 관리자 시작
   */
  async start(): Promise<void> {
    console.log('[ExecutionManager] Starting...');

    // 기존 Barista Engine 정리 (이벤트 리스너 중복 등록 방지)
    if (this.baristaEngine) {
      this.baristaEngine.removeAllListeners();
      await this.baristaEngine.dispose();
      this.baristaEngine = null;
    }

    // Terminal Pool 초기화
    await this.initTerminalPool();

    // Barista Engine 초기화
    this.baristaEngine = new BaristaEngineV2(this.terminalPool!);

    // Barista Engine 이벤트 리스너 설정
    this.setupBaristaEngineEvents();

    // Orchestrator 이벤트 리스너 설정
    this.setupEventListeners();

    // 메트릭 샘플링 타이머 시작 (10초마다 IPC 성능 로깅)
    this.startMetricsSampling();

    console.log('[ExecutionManager] Started successfully');
  }

  /**
   * 실행 관리자 중지
   */
  async stop(): Promise<void> {
    console.log('[ExecutionManager] Stopping...');

    // 메트릭 샘플링 타이머 정리
    if (this.metricsSamplingTimer) {
      clearInterval(this.metricsSamplingTimer);
      this.metricsSamplingTimer = null;
    }

    // Barista Engine 이벤트 리스너 제거
    if (this.baristaEngine) {
      this.baristaEngine.removeAllListeners();
      await this.baristaEngine.dispose();
      this.baristaEngine = null;
    }

    // Orchestrator 이벤트 리스너 제거 (중복 등록 방지)
    this.orchestrator.removeAllListeners('order:execution-started');
    this.orchestrator.removeAllListeners('order:input');

    // Terminal Pool 정리
    if (this.terminalPool) {
      await this.terminalPool.dispose();
      this.terminalPool = null;
    }

    // 메트릭 정리
    this.outputMetrics.clear();

    // 플래그 초기화
    this.eventListenersRegistered = false;

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
   * 중복 등록 방지: 이미 등록된 경우 리스너를 제거 후 다시 등록
   */
  private setupBaristaEngineEvents(): void {
    if (!this.baristaEngine) return;

    // 기존 리스너 제거 (중복 등록 방지)
    if (this.eventListenersRegistered) {
      this.baristaEngine.removeAllListeners('order:output');
      this.baristaEngine.removeAllListeners('order:started');
      this.baristaEngine.removeAllListeners('order:completed');
      this.baristaEngine.removeAllListeners('order:failed');
      this.baristaEngine.removeAllListeners('stage:started');
      this.baristaEngine.removeAllListeners('stage:completed');
      this.baristaEngine.removeAllListeners('stage:failed');
    }

    // order:output - 터미널 출력
    this.baristaEngine.on('order:output', (data: { orderId: string; data: string }) => {
      const now = Date.now();

      // 메트릭 수집
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

      // Parse output type from markers (uses parseOutputType helper)
      const { type, content } = parseOutputType(data.data);

      // 1. UI 전송 (실시간 보기용) - order:output 형식으로 전송 (ANSI를 HTML로 변환)
      // SECURITY: convertAnsiToHtml properly escapes HTML to prevent XSS
      this.sendToRenderer('order:output', {
        orderId: data.orderId,
        timestamp: new Date().toISOString(),
        type,
        content: convertAnsiToHtml(content),
      });

      // 2. 로그 저장 (지속성용) - 원본 그대로 저장 (마커 포함)
      this.orchestrator.appendOrderLog(data.orderId, data.data).catch((err: Error) => {
        console.error(`[ExecutionManager] Failed to append log for order ${data.orderId}:`, err);
      });
    });

    // Session 관련 이벤트들
    this.baristaEngine.on('order:started', async (data: OrderStartedEvent) => {
      console.log(`[ExecutionManager] order:started EVENT RECEIVED for order: ${data.orderId}`);
      const now = Date.now();

      // **중요**: Orchestrator의 Order 상태를 PENDING → RUNNING으로 변경
      console.log(`[ExecutionManager] Calling orchestrator.startOrder for order: ${data.orderId}`);
      await this.orchestrator.startOrder(data.orderId);
      console.log(`[ExecutionManager] orchestrator.startOrder completed for order: ${data.orderId}`);

      // 메트릭 초기화 및 시작 시각 기록
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

      console.log(`[ExecutionManager] Order STARTED: ${data.orderId} at ${new Date(now).toISOString()}`);
      console.log(`[ExecutionManager] Sending order:session-started to renderer`);
      this.sendToRenderer('order:session-started', data);
      console.log(`[ExecutionManager] order:session-started sent successfully`);
    });

    this.baristaEngine.on('order:completed', (data: OrderCompletedEvent) => {
      const now = Date.now();
      const metrics = this.outputMetrics.get(data.orderId);
      const duration = metrics?.orderStartTime
        ? now - metrics.orderStartTime
        : 0;

      console.log(`[ExecutionManager] Order COMPLETED: ${data.orderId} | Duration: ${duration}ms | Total chunks: ${metrics?.totalChunks || 0}`);
      this.sendToRenderer('order:session-completed', data);
      // Renderer에서 completed 상태 감지용
      this.sendToRenderer('order:completed', data);

      // 완료된 Order의 메트릭는 일정 시간 후 정리
      setTimeout(() => {
        this.outputMetrics.delete(data.orderId);
      }, 60000); // 1분 후 정리
    });

    this.baristaEngine.on('order:failed', (data: OrderFailedEvent) => {
      const now = Date.now();
      const metrics = this.outputMetrics.get(data.orderId);
      const duration = metrics?.orderStartTime
        ? now - metrics.orderStartTime
        : 0;

      console.error(`[ExecutionManager] Order FAILED: ${data.orderId} | Duration: ${duration}ms | Total chunks: ${metrics?.totalChunks || 0} | Error: ${data.error || 'Unknown'}`);
      this.sendToRenderer('order:session-failed', data);
      // Renderer에서 failed 상태 감지용
      this.sendToRenderer('order:failed', data);

      // 실패한 Order의 메트릭 정리
      this.outputMetrics.delete(data.orderId);
    });

    // Stage 이벤트들 (로깅 강화)
    this.baristaEngine.on('stage:started', (data: StageStartedEvent) => {
      console.log(`[ExecutionManager] Stage STARTED: ${data.stageId} (Order: ${data.orderId}, Provider: ${data.provider})`);
      this.sendToRenderer('order:stage-started', {
        orderId: data.orderId,
        stageId: data.stageId,
        provider: data.provider,
      });
    });

    this.baristaEngine.on('stage:completed', (data: StageCompletedEvent) => {
      const duration = data.duration || 0;
      console.log(`[ExecutionManager] Stage COMPLETED: ${data.stageId} (Order: ${data.orderId}) | Duration: ${duration}ms`);
      this.sendToRenderer('order:stage-completed', {
        orderId: data.orderId,
        stageId: data.stageId,
        output: data.output,
        duration: data.duration,
      });
    });

    this.baristaEngine.on('stage:failed', (data: StageFailedEvent) => {
      console.error(`[ExecutionManager] Stage FAILED: ${data.stageId} (Order: ${data.orderId}) | Error: ${data.error || 'Unknown'}`);
      this.sendToRenderer('order:stage-failed', {
        orderId: data.orderId,
        stageId: data.stageId,
        error: data.error,
      });
    });

    // order:awaiting-input - 사용자 입력 대기 상태
    this.baristaEngine.on('order:awaiting-input', (data: { orderId: string }) => {
      console.log(`[ExecutionManager] Order AWAITING INPUT: ${data.orderId}`);
      this.sendToRenderer('order:awaiting-input', data);
    });

    // 이벤트 리스너 등록 완료 표시
    this.eventListenersRegistered = true;
  }

  /**
   * Orchestrator 이벤트 리스너 설정
   * 중복 등록 방지: 이미 등록된 경우 리스너를 제거 후 다시 등록
   */
  private setupEventListeners(): void {
    // 기존 리스너 제거 (중복 등록 방지)
    if (this.eventListenersRegistered) {
      this.orchestrator.removeAllListeners('order:execution-started');
      this.orchestrator.removeAllListeners('order:input');
    }

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
   * 메트릭 샘플링 타이머 시작
   * 10초마다 활성 Order들의 IPC 성능 메트릭을 로깅
   */
  private startMetricsSampling(): void {
    // 기존 타이머 정리
    if (this.metricsSamplingTimer) {
      clearInterval(this.metricsSamplingTimer);
    }

    // 10초마다 샘플링
    this.metricsSamplingTimer = setInterval(() => {
      const now = Date.now();
      const activeOrders = Array.from(this.outputMetrics.entries());

      if (activeOrders.length === 0) {
        return; // 활성 Order가 없으면 로그 생략
      }

      console.log('[ExecutionManager] === IPC Performance Metrics ===');

      for (const [orderId, metrics] of activeOrders) {
        const elapsedSinceLastSample = now - metrics.lastSampleTime;
        const chunksSinceLastSample = metrics.totalChunks - metrics.chunksAtLastSample;
        const chunksPerSec = elapsedSinceLastSample > 0
          ? (chunksSinceLastSample / (elapsedSinceLastSample / 1000)).toFixed(2)
          : '0';

        console.log(`[ExecutionManager] Order ${orderId}: total=${metrics.totalChunks} chunks, ${chunksPerSec} chunks/sec (last ${elapsedSinceLastSample}ms)`);

        // 샘플링 시점 업데이트
        metrics.lastSampleTime = now;
        metrics.chunksAtLastSample = metrics.totalChunks;
      }

      console.log('[ExecutionManager] === End of Metrics ===');
    }, 10000); // 10초
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

      // Session 상태 확인 - awaiting_input이면 완료하지 않음
      const sessionStatus = this.baristaEngine.getSessionStatus();
      console.log(`[ExecutionManager] Session status for order ${orderId}:`, JSON.stringify(sessionStatus, null, 2));
      
      const isAwaitingInput = sessionStatus && 
        typeof sessionStatus === 'object' &&
        'sessions' in sessionStatus &&
        Array.isArray(sessionStatus.sessions) &&
        sessionStatus.sessions.some((s: any) => s.orderId === orderId && s.status === 'awaiting_input');

      console.log(`[ExecutionManager] isAwaitingInput check: ${isAwaitingInput}`);

      if (isAwaitingInput) {
        console.log(`[ExecutionManager] Order ${orderId} is awaiting user input - not completing`);
        // activeExecutions에 유지
        return;
      }

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
      // Session이 awaiting_input 상태인 경우 activeExecutions에서 삭제하지 않음
      const sessionStatus = this.baristaEngine?.getSessionStatus();
      const isAwaitingInput = sessionStatus && 
        typeof sessionStatus === 'object' &&
        'sessions' in sessionStatus &&
        Array.isArray(sessionStatus.sessions) &&
        sessionStatus.sessions.some((s: any) => s.orderId === orderId && s.status === 'awaiting_input');

      if (!isAwaitingInput) {
        this.activeExecutions.delete(orderId);
      }
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
