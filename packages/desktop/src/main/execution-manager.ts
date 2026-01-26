/**
 * Execution Manager
 * Orchestrator의 order:execution-started 이벤트를 받아 BaristaEngineV2를 통해 실제 실행
 */

import * as path from 'path';
import { BrowserWindow } from 'electron';
import { existsSync } from 'fs';
import { Orchestrator, Order, Barista, OrderStatus } from '@codecafe/core';
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
import { terminalLogger } from './file-logger.js';

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

    // Worktree가 있는 완료된 Order들의 Session 복원
    await this.restoreSessionsForWorktreeOrders();

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
      this.baristaEngine.removeAllListeners('order:awaiting-input');
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
      const parsed = parseOutputType(data.data);

      // Map user_prompt to user-input for frontend display
      // Map json to tool_result for collapsible treatment
      const outputType = parsed.type === 'user_prompt' ? 'user-input' :
                        parsed.type === 'json' ? 'tool_result' : parsed.type;

      // 1. UI 전송 (실시간 보기용) - order:output 형식으로 전송 (ANSI를 HTML로 변환)
      // SECURITY: convertAnsiToHtml properly escapes HTML to prevent XSS
      this.sendToRenderer('order:output', {
        orderId: data.orderId,
        timestamp: new Date().toISOString(),
        type: outputType,
        content: convertAnsiToHtml(parsed.content),
        // stage_end 타입일 때 stageInfo 포함 (단일 경로 통합용)
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
      // 3-1. Orchestrator의 Order별 로그 파일 (기존)
      this.orchestrator.appendOrderLog(data.orderId, data.data).catch((err: Error) => {
        console.error(`[ExecutionManager] Failed to append log for order ${data.orderId}:`, err);
      });

      // 3-2. 통합 터미널 로그 파일 (신규)
      terminalLogger.log(data.orderId, data.data).catch((err: Error) => {
        console.error(`[ExecutionManager] Failed to write terminal log for order ${data.orderId}:`, err);
      });
    });

    // Session 관련 이벤트들
    // NOTE: orchestrator.startOrder()는 orchestrator.executeOrder()에서 이미 호출됨
    // 여기서 중복 호출하면 "Order started" 로그가 두 번 저장되는 버그 발생
    this.baristaEngine.on('order:started', (data: OrderStartedEvent) => {
      const now = Date.now();

      console.log(`[ExecutionManager] Order STARTED event received: ${data.orderId}`);

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

      this.sendToRenderer('order:session-started', data);
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
      console.log(`[ExecutionManager] Stage STARTED: ${data.stageId} (${data.stageName || data.stageId}) (Order: ${data.orderId}, Provider: ${data.provider})`);
      console.log(`[ExecutionManager] Stage skills:`, data.skills);
      this.sendToRenderer('order:stage-started', {
        orderId: data.orderId,
        stageId: data.stageId,
        stageName: data.stageName,
        provider: data.provider,
        skills: data.skills,  // 스킬 정보 추가
      });
    });

    this.baristaEngine.on('stage:completed', (data: StageCompletedEvent) => {
      const duration = data.duration || 0;
      console.log(`[ExecutionManager] Stage COMPLETED: ${data.stageId} (Order: ${data.orderId}) | Duration: ${duration}ms`);
      // IPC 전송 제거: stage 완료 정보는 Output 스트림([STAGE_END] 마커)을 통해 단일 경로로 전달
      // 기존: this.sendToRenderer('order:stage-completed', {...})
    });

    this.baristaEngine.on('stage:failed', (data: StageFailedEvent) => {
      console.error(`[ExecutionManager] Stage FAILED: ${data.stageId} (Order: ${data.orderId}) | Error: ${data.error || 'Unknown'}`);
      // IPC 전송 제거: stage 실패 정보는 Output 스트림([STAGE_END] 마커)을 통해 단일 경로로 전달
      // 기존: this.sendToRenderer('order:stage-failed', {...})
    });

    // order:awaiting-input - 사용자 입력 대기 상태
    this.baristaEngine.on('order:awaiting-input', (data: { orderId: string }) => {
      console.log(`[ExecutionManager] Order AWAITING INPUT: ${data.orderId}`);
      this.sendToRenderer('order:awaiting-input', data);
    });

    // Followup 이벤트들
    this.baristaEngine.on('order:followup', (data: { orderId: string }) => {
      console.log(`[ExecutionManager] Order FOLLOWUP MODE: ${data.orderId}`);
      this.sendToRenderer('order:followup', data);
    });

    this.baristaEngine.on('order:followup-started', (data: { orderId: string; prompt: string }) => {
      console.log(`[ExecutionManager] Order FOLLOWUP STARTED: ${data.orderId}`);
      this.sendToRenderer('order:followup-started', data);
    });

    this.baristaEngine.on('order:followup-completed', (data: { orderId: string; stageId?: string; output?: string }) => {
      console.log(`[ExecutionManager] Order FOLLOWUP COMPLETED: ${data.orderId}`);
      this.sendToRenderer('order:followup-completed', data);
    });

    this.baristaEngine.on('order:followup-failed', (data: { orderId: string; stageId?: string; error?: string }) => {
      console.error(`[ExecutionManager] Order FOLLOWUP FAILED: ${data.orderId} | Error: ${data.error || 'Unknown'}`);
      this.sendToRenderer('order:followup-failed', data);
    });

    this.baristaEngine.on('order:followup-finished', (data: { orderId: string }) => {
      console.log(`[ExecutionManager] Order FOLLOWUP FINISHED: ${data.orderId}`);
      this.sendToRenderer('order:followup-finished', data);
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
      this.orchestrator.removeAllListeners('order:event');
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

    // order:event 이벤트 처리 (status 변경 등을 renderer에 전파)
    this.orchestrator.on('order:event', (event: { type: string; orderId: string; data: any }) => {
      console.log('[ExecutionManager] Received order:event:', event);
      // Order 상태 변경 이벤트를 renderer에 전송
      if (event.type === 'ORDER_STATUS_CHANGED') {
        this.sendToRenderer('order:status-changed', {
          orderId: event.orderId,
          status: event.data.status,
        });
      }
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
   * - 실행 중인 order: 터미널에 직접 입력
   * - 완료된 order(worktree 존재): followup 모드로 추가 요청 처리
   */
  private async handleOrderInput(orderId: string, message: string): Promise<void> {
    if (!this.baristaEngine) {
      console.error('[ExecutionManager] Barista engine not initialized');
      return;
    }

    const execution = this.activeExecutions.get(orderId);

    // activeExecutions에 없는 경우 (복원되지 않은 완료된 order 등)
    if (!execution) {
      // Order가 존재하고 worktree가 있는지 확인
      const order = this.orchestrator.getOrder(orderId);
      if (order && order.worktreeInfo?.path && !order.worktreeInfo.removed && existsSync(order.worktreeInfo.path)) {
        // Worktree가 있는 완료된 order - 복원 후 followup 실행
        console.log(`[ExecutionManager] Restoring session for order ${orderId} on-demand (worktree exists)`);

        try {
          // Barista 확인
          let barista = this.orchestrator.getAllBaristas().find(b => b.provider === order.provider);
          if (!barista) {
            barista = this.orchestrator.createBarista(order.provider);
          }

          const cwd = order.worktreeInfo!.path;
          const cafeId = order.cafeId || 'default';

          // Session 복원
          await this.baristaEngine.restoreSessionForFollowup(order, barista, cafeId, cwd);
          this.activeExecutions.set(orderId, { baristaId: barista.id });

          console.log(`[ExecutionManager] Session restored for order ${orderId}, executing followup`);

          // Followup 실행
          await this.baristaEngine.executeFollowup(orderId, message);

          // UI에 알림
          this.sendToRenderer('order:execution-progress', {
            orderId,
            stage: 'followup-started',
            message: `Followup request sent: ${message.substring(0, 50)}...`,
          });

          return;
        } catch (error: any) {
          console.error(`[ExecutionManager] Failed to restore and execute followup for order ${orderId}:`, error);
          return;
        }
      }

      // Worktree도 없는 order - 찾을 수 없음
      console.warn('[ExecutionManager] No active execution for order:', orderId);
      return;
    }

    // activeExecutions에 있는 경우 - 세션 상태에 따라 처리
    const sessionStatus = this.baristaEngine.getOrderSessionStatus(orderId);
    const order = this.orchestrator.getOrder(orderId);

    // 완료된 order (worktree 존재) - followup으로 처리
    // sessionStatus가 null이지만 order가 완료되고 worktree가 있으면 followup 처리
    const isCompletedOrder = order && (
      order.status === OrderStatus.COMPLETED ||
      (order.worktreeInfo?.path && !order.worktreeInfo.removed)
    );

    if (sessionStatus === 'completed' || sessionStatus === 'followup' ||
        (sessionStatus === null && isCompletedOrder && order.worktreeInfo?.path && existsSync(order.worktreeInfo.path))) {
      console.log(`[ExecutionManager] Order ${orderId} is in ${sessionStatus || 'restored'} state, executing followup`);

      try {
        await this.baristaEngine.executeFollowup(orderId, message);

        // UI에 알림
        this.sendToRenderer('order:execution-progress', {
          orderId,
          stage: 'followup-started',
          message: `Followup request sent: ${message.substring(0, 50)}...`,
        });
      } catch (error: any) {
        console.error('[ExecutionManager] Failed to execute followup:', error);
      }
      return;
    }

    // 실행 중인 order - 터미널에 직접 입력
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

  /**
   * Worktree가 있는 완료된 Order들의 Session 복원
   * 앱 재시작 후 worktree가 존재하는 order에 추가 요청을 보낼 수 있도록 함
   */
  private async restoreSessionsForWorktreeOrders(): Promise<void> {
    if (!this.baristaEngine) {
      console.warn('[ExecutionManager] Barista engine not initialized, skipping session restore');
      return;
    }

    console.log('[ExecutionManager] Restoring sessions for worktree orders...');

    try {
      // 모든 Order 조회
      const allOrders = this.orchestrator.getAllOrders();
      console.log(`[ExecutionManager] Found ${allOrders.length} total orders`);

      // 복원 대상 Order 필터링:
      // 1. status가 COMPLETED인 (완료된)
      // 2. worktreeInfo가 있는
      // 3. worktree 경로가 실제로 존재하는
      // 4. worktree가 삭제되지 않은 (removed !== true)
      const restorableOrders = allOrders.filter((order: Order) => {
        // OrderStatus enum 사용
        const isCompleted = order.status === OrderStatus.COMPLETED;

        // worktreeInfo 확인
        const hasWorktree = order.worktreeInfo?.path &&
          order.worktreeInfo.path.length > 0 &&
          !order.worktreeInfo.removed;

        // 경로 실제 존재 확인
        const pathExists = hasWorktree && existsSync(order.worktreeInfo!.path);

        return isCompleted && hasWorktree && pathExists;
      });

      console.log(`[ExecutionManager] Found ${restorableOrders.length} orders with valid worktrees to restore`);

      // 각 Order에 대해 Session 복원
      for (const order of restorableOrders) {
        try {
          // Order의 provider와 일치하는 Barista 획득 (없으면 생성)
          let barista = this.orchestrator.getAllBaristas().find(b => b.provider === order.provider);
          if (!barista) {
            // 일치하는 Barista가 없으면 생성
            barista = this.orchestrator.createBarista(order.provider);
            console.log(`[ExecutionManager] Created barista with provider ${order.provider} for session restore`);
          }

          // worktree 경로를 cwd로 사용
          const cwd = order.worktreeInfo!.path;
          const cafeId = order.cafeId || 'default';

          // Session 복원 (이미 completed 상태로 복원됨)
          await this.baristaEngine.restoreSessionForFollowup(order, barista, cafeId, cwd);

          // activeExecutions에 등록 (worktree가 존재하는 한 계속 유지)
          // 복원된 세션은 completed 상태이지만 followup이 가능하므로 activeExecutions에 유지
          this.activeExecutions.set(order.id, { baristaId: barista.id });

          console.log(`[ExecutionManager] Restored session for order ${order.id} with worktree ${cwd} (followup ready)`);
        } catch (err: any) {
          console.error(`[ExecutionManager] Failed to restore session for order ${order.id}:`, err);
          // 실패해도 다른 order는 계속 시도
        }
      }

      console.log(`[ExecutionManager] Session restore completed. ${restorableOrders.length} orders restored.`);
    } catch (error: any) {
      console.error('[ExecutionManager] Error restoring sessions:', error);
    }
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
