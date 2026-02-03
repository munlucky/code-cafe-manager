/**
 * OrderSession - Order 실행 세션 관리 (Facade)
 *
 * Order의 전체 라이프사이클을 관리:
 * 1. 워크플로우 Stage 분석
 * 2. Provider별 터미널 할당 결정
 * 3. Stage 순차/병렬 실행
 * 4. 결과 동기화 및 전달
 *
 * 내부 구현은 다음 모듈들에 위임:
 * - lifecycle/session-lifecycle.ts: 세션 상태 전이
 * - execution/execution-planner.ts: 실행 계획 수립
 * - execution/stage-coordinator.ts: Stage 실행 조율
 * - resources/context-manager.ts: 컨텍스트 관리
 * - events/event-propagator.ts: 이벤트 전파
 */

import { EventEmitter } from 'events';
import { Order, Barista, ProviderType, createLogger, EventListenerManager } from '@codecafe/core';

import { TerminalPool } from '../terminal/terminal-pool';
import { SharedContext } from './shared-context';
import { TerminalGroup } from './terminal-group';
import { StageOrchestrator, OrchestratorConfig } from './stage-orchestrator';

// Internal modules
import { SessionStateMachine, SessionState } from './state-machine';
import type { SessionStateMachineState } from './state-machine';
import { ExecutionPlanner, StageCoordinator } from './execution';
import { SessionContextManager } from './resources';
import { SessionEventPropagator } from './events';

const logger = createLogger({ context: 'OrderSession' });

// Internal type alias
type SessionStatus = SessionState;

// Re-export types for public API compatibility
export type { SessionState as SessionStatus } from './state-machine';

export interface StageConfig {
  id: string;
  name: string;
  provider: 'claude-code' | 'codex' | 'gemini' | 'grok';
  prompt: string;
  role?: string;
  mode?: 'sequential' | 'parallel';
  dependsOn?: string[];
  skills?: string[];
}

export interface WorkflowConfig {
  stages: StageConfig[];
  vars?: Record<string, unknown>;
}

/**
 * 대기 상태 정보
 */
export interface AwaitingState {
  stageId: string;
  questions?: string[];
  message?: string;
  remainingPlan: StageConfig[][];
  batchIndex: number;
  cwd: string;
}

/**
 * 실패 상태 정보 (재시도용)
 */
export interface FailedState {
  failedStageId: string;
  error: string;
  executionPlan: StageConfig[][];
  failedBatchIndex: number;
  completedStages: string[];
  cwd: string;
  retryOptions: Array<{ stageId: string; stageName: string; batchIndex: number }>;
}

/**
 * OrderSession - Order 실행 세션 (Facade)
 */
export class OrderSession extends EventEmitter {
  readonly orderId: string;
  readonly cafeId: string;
  readonly barista: Barista;

  // Core dependencies
  private readonly terminalPool: TerminalPool;
  private readonly sharedContext: SharedContext;
  private readonly orchestrator: StageOrchestrator;

  // Internal modules
  private readonly stateMachine: SessionStateMachine;
  private readonly planner: ExecutionPlanner;
  private readonly contextManager: SessionContextManager;
  private readonly eventPropagator: SessionEventPropagator;

  // Runtime state
  private terminalGroup: TerminalGroup | null = null;
  private workflowConfig: WorkflowConfig | null = null;
  private currentExecutionPlan: StageConfig[][] | null = null;
  private currentCwd: string | null = null;

  // Event listener management
  private readonly listenerManager = new EventListenerManager();
  private terminalGroupListenerManager: EventListenerManager | null = null;

  constructor(
    order: Order,
    barista: Barista,
    cafeId: string,
    terminalPool: TerminalPool,
    orchestratorConfig?: OrchestratorConfig
  ) {
    super();
    this.orderId = order.id;
    this.cafeId = cafeId;
    this.barista = barista;
    this.terminalPool = terminalPool;

    // Initialize core dependencies
    this.sharedContext = new SharedContext(order.id, order.vars || {});
    this.orchestrator = new StageOrchestrator(orchestratorConfig);

    // Initialize internal modules
    this.stateMachine = new SessionStateMachine('created');
    this.planner = new ExecutionPlanner(this.sharedContext);
    this.contextManager = new SessionContextManager(this.sharedContext);
    this.eventPropagator = new SessionEventPropagator(order.id, cafeId);

    // Propagate events from eventPropagator to this EventEmitter
    this.setupEventPropagation();

    // SharedContext event propagation
    this.listenerManager.attach(this.sharedContext, 'stage:started', (data: unknown) => this.emit('stage:started', data));
    this.listenerManager.attach(this.sharedContext, 'stage:completed', (data: unknown) => this.emit('stage:completed', data));
    this.listenerManager.attach(this.sharedContext, 'stage:failed', (data: unknown) => this.emit('stage:failed', data));
  }

  /**
   * 워크플로우 설정
   */
  setWorkflow(config: WorkflowConfig): void {
    logger.debug('[OrderSession.setWorkflow] Workflow config received:', {
      orderId: this.orderId,
      stagesCount: config.stages.length,
      stages: config.stages.map(s => ({
        id: s.id,
        name: s.name,
        provider: s.provider,
        skills: s.skills,
      })),
    });

    this.workflowConfig = config;

    // 워크플로우 변수를 SharedContext에 추가
    if (config.vars) {
      for (const [key, value] of Object.entries(config.vars)) {
        this.sharedContext.setVar(key, value);
      }
    }
  }

  /**
   * 단순 프롬프트 실행 (Legacy Order 호환)
   */
  async executePrompt(prompt: string, cwd: string): Promise<void> {
    if (this.stateMachine.getStatus() !== 'created') {
      throw new Error(`Session ${this.orderId} is not in created state`);
    }

    this.stateMachine.start();
    this.emit('session:started', { orderId: this.orderId, cafeId: this.cafeId });

    try {
      this.terminalGroup = new TerminalGroup(
        {
          orderId: this.orderId,
          cwd,
          providers: [this.barista.provider as ProviderType],
        },
        this.terminalPool,
        this.sharedContext
      );

      this.setupTerminalGroupListeners();

      const result = await this.terminalGroup.executeStage(
        'main',
        this.barista.provider as ProviderType,
        prompt,
        { includeContext: false }
      );

      if (result.success) {
        this.stateMachine.complete();
        this.emit('session:completed', {
          orderId: this.orderId,
          output: result.output,
        });
      } else {
        this.stateMachine.fail(result.error || 'Unknown error');
        this.emit('session:failed', {
          orderId: this.orderId,
          error: this.stateMachine.getError(),
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.stateMachine.fail(errorMsg);
      this.emit('session:failed', {
        orderId: this.orderId,
        error: errorMsg,
      });
      throw error;
    } finally {
      if (this.stateMachine.getStatus() !== 'awaiting_input') {
        this.stateMachine.setCompletedAt(new Date());
      }
    }
  }

  /**
   * 워크플로우 실행
   */
  async execute(cwd: string): Promise<void> {
    if (!this.workflowConfig) {
      throw new Error(`No workflow configured for session ${this.orderId}`);
    }

    if (this.stateMachine.getStatus() !== 'created') {
      throw new Error(`Session ${this.orderId} is not in created state`);
    }

    this.stateMachine.start();
    this.currentCwd = cwd;
    this.emit('session:started', { orderId: this.orderId, cafeId: this.cafeId });

    try {
      const providers = this.planner.extractProviders(this.workflowConfig.stages) as ProviderType[];

      this.terminalGroup = new TerminalGroup(
        {
          orderId: this.orderId,
          cwd,
          providers,
        },
        this.terminalPool,
        this.sharedContext
      );

      this.setupTerminalGroupListeners();

      const executionPlan = this.planner.buildPlan(this.workflowConfig.stages);
      this.currentExecutionPlan = executionPlan;

      await this.executeWithOrchestrator(executionPlan, cwd);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.stateMachine.fail(errorMsg);

      if (!this.contextManager.getFailedState() && this.currentExecutionPlan) {
        this.contextManager.buildFailedState({
          error: errorMsg,
          executionPlan: this.currentExecutionPlan,
          failedBatchIndex: 0, // 실패 지점 불명 시 처음부터
          cwd,
        });
      }

      this.emit('session:failed', {
        orderId: this.orderId,
        error: errorMsg,
        failedState: this.contextManager.getFailedState(),
        canRetry: this.contextManager.getFailedState() !== null,
      });
      throw error;
    } finally {
      const status = this.stateMachine.getStatus();
      if (status !== 'awaiting_input' && status !== 'failed') {
        this.stateMachine.setCompletedAt(new Date());
      }
    }
  }

  /**
   * 오케스트레이터와 함께 Stage 실행
   */
  private async executeWithOrchestrator(
    executionPlan: StageConfig[][],
    cwd: string,
    startFromBatch: number = 0
  ): Promise<void> {
    const coordinator = new StageCoordinator(
      this.orchestrator,
      this.terminalGroup!,
      this.sharedContext,
      {
        onSkipStages: (stageIds) => {
          for (const id of stageIds) {
            this.contextManager.addSkipStage(id);
          }
        },
        onAwaitingState: (state) => {
          this.stateMachine.setAwaiting();
          this.contextManager.setAwaitingState(state);
          this.emit('session:awaiting', {
            orderId: this.orderId,
            stageId: state.stageId,
            questions: state.questions,
            message: state.message,
          });
        },
        onStageCompleted: (stageId) => {
          this.contextManager.markStageCompleted(stageId);
        },
        onBuildFailedState: (error, batchIndex, failedStageId) => {
          this.contextManager.buildFailedState({
            error,
            executionPlan,
            failedBatchIndex: batchIndex,
            cwd,
            failedStageId,
          });
        },
      }
    );

    for (let batchIndex = startFromBatch; batchIndex < executionPlan.length; batchIndex++) {
      const batch = executionPlan[batchIndex];
      const { action, shouldBreak } = await coordinator.executeBatch(
        batch,
        executionPlan,
        batchIndex,
        cwd,
        (prompt) => this.planner.interpolatePrompt(prompt),
        (stageId) => this.contextManager.shouldSkipStage(stageId)
      );

      if (shouldBreak) {
        return;
      }
    }

    // 모든 Stage 완료
    if (this.stateMachine.getStatus() !== 'awaiting_input') {
      this.stateMachine.complete();
      this.emit('session:completed', {
        orderId: this.orderId,
        context: this.sharedContext.snapshot(),
      });
    }
  }

  /**
   * 대기 상태에서 사용자 입력 후 재개
   */
  async resume(userInput: string): Promise<void> {
    const awaitingState = this.contextManager.getAwaitingState();
    if (this.stateMachine.getStatus() !== 'awaiting_input' || !awaitingState) {
      throw new Error(`Session ${this.orderId} is not awaiting input`);
    }

    logger.debug(`Resuming session with user input`);

    this.contextManager.setUserInput(awaitingState.stageId, userInput);
    const { remainingPlan, cwd } = awaitingState;

    this.contextManager.clearAwaitingState();
    this.stateMachine.resume();

    this.emit('session:resumed', { orderId: this.orderId, userInput });

    try {
      await this.executeWithOrchestrator(remainingPlan, cwd, 0);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.stateMachine.fail(errorMsg);
      this.emit('session:failed', {
        orderId: this.orderId,
        error: errorMsg,
      });
      throw error;
    } finally {
      if (this.stateMachine.getStatus() !== 'awaiting_input') {
        this.stateMachine.setCompletedAt(new Date());
      }
    }
  }

  /**
   * 대기 상태 정보 조회
   */
  getAwaitingState(): AwaitingState | null {
    return this.contextManager.getAwaitingState();
  }

  /**
   * 세션 취소
   */
  async cancel(): Promise<void> {
    if (this.stateMachine.getStatus() !== 'running') {
      return;
    }

    this.stateMachine.cancel();

    if (this.terminalGroup) {
      await this.terminalGroup.dispose();
    }

    this.emit('session:cancelled', { orderId: this.orderId });
  }

  /**
   * 터미널에 입력 전송
   */
  async sendInput(message: string): Promise<void> {
    if (!this.terminalGroup) {
      throw new Error(`No terminal group for session ${this.orderId}`);
    }

    await this.terminalGroup.sendInput(this.barista.provider as ProviderType, message);
  }

  /**
   * 세션 상태 조회
   */
  getStatus(): {
    orderId: string;
    cafeId: string;
    status: SessionStatus;
    terminals: ReturnType<TerminalGroup['getStatus']> | null;
    context: ReturnType<SharedContext['snapshot']>;
    startedAt: string | null;
    completedAt: string | null;
    duration: number | null;
    error: string | null;
  } {
    const fullState = this.stateMachine.getFullState();
    const duration = this.stateMachine.getDuration();

    return {
      orderId: this.orderId,
      cafeId: this.cafeId,
      status: fullState.status,
      terminals: this.terminalGroup?.getStatus() || null,
      context: this.sharedContext.snapshot(),
      startedAt: fullState.startedAt?.toISOString() || null,
      completedAt: fullState.completedAt?.toISOString() || null,
      duration,
      error: fullState.error,
    };
  }

  /**
   * SharedContext 접근
   */
  getContext(): SharedContext {
    return this.sharedContext;
  }

  /**
   * 실패 상태 조회
   */
  getFailedState(): FailedState | null {
    return this.contextManager.getFailedState();
  }

  /**
   * 특정 stage부터 재시도
   */
  async retryFromStage(fromStageId?: string): Promise<void> {
    const failedState = this.contextManager.getFailedState();
    if (this.stateMachine.getStatus() !== 'failed' || !failedState) {
      throw new Error(`Session ${this.orderId} is not in failed state or has no retry info`);
    }

    const { executionPlan, cwd, retryOptions } = failedState;

    let startBatchIndex = 0;
    if (fromStageId) {
      const option = retryOptions.find(o => o.stageId === fromStageId);
      if (!option) {
        throw new Error(`Stage ${fromStageId} not found in retry options`);
      }
      startBatchIndex = option.batchIndex;

      const stageIndex = retryOptions.findIndex(o => o.stageId === fromStageId);
      for (let i = stageIndex; i < retryOptions.length; i++) {
        this.contextManager.removeCompletedStage(retryOptions[i].stageId);
      }
    } else {
      startBatchIndex = failedState.failedBatchIndex < 0 ? 0 : failedState.failedBatchIndex;
      this.contextManager.removeCompletedStage(failedState.failedStageId);
    }

    logger.debug(`Retrying from stage ${fromStageId || failedState.failedStageId} (batch ${startBatchIndex})`);

    const originalFailedStageId = failedState.failedStageId;

    this.stateMachine.resume();
    this.contextManager.clearFailedState();

    this.emit('session:resumed', {
      orderId: this.orderId,
      fromStageId: fromStageId || originalFailedStageId,
      retryType: 'stage',
    });

    try {
      if (!this.terminalGroup) {
        const providers = this.planner.extractProviders(executionPlan.flat()) as ProviderType[];
        this.terminalGroup = new TerminalGroup(
          {
            orderId: this.orderId,
            cwd,
            providers,
          },
          this.terminalPool,
          this.sharedContext
        );

        this.setupTerminalGroupListeners();
      }

      await this.executeWithOrchestrator(executionPlan, cwd, startBatchIndex);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.stateMachine.fail(errorMsg);
      this.emit('session:failed', {
        orderId: this.orderId,
        error: errorMsg,
        failedState: this.contextManager.getFailedState(),
        canRetry: this.contextManager.getFailedState() !== null,
      });
      throw error;
    } finally {
      const status = this.stateMachine.getStatus();
      if (status !== 'awaiting_input' && status !== 'failed') {
        this.stateMachine.setCompletedAt(new Date());
      }
    }
  }

  /**
   * 처음부터 재시도 (이전 시도 컨텍스트 포함)
   */
  async retryFromBeginning(preserveContext: boolean = true): Promise<void> {
    const failedState = this.contextManager.getFailedState();
    if (this.stateMachine.getStatus() !== 'failed' || !failedState) {
      throw new Error(`Session ${this.orderId} is not in failed state or has no retry info`);
    }

    const { executionPlan, cwd } = failedState;

    logger.debug(`Retrying from beginning (preserveContext: ${preserveContext})`);

    if (preserveContext) {
      this.sharedContext.addPreviousAttempt({
        stageResults: this.sharedContext.getAllStageResults(),
        failedStageId: failedState.failedStageId,
        error: failedState.error,
        timestamp: Date.now(),
      });
    }

    this.sharedContext.resetStages();
    this.contextManager.clearCompletedStages();

    this.stateMachine.resume();
    this.stateMachine.setStartedAt(new Date());
    this.contextManager.clearFailedState();

    this.emit('session:resumed', {
      orderId: this.orderId,
      retryType: 'beginning',
      attemptNumber: this.sharedContext.getCurrentAttemptNumber(),
      preserveContext,
    });

    try {
      if (this.terminalGroup) {
        await this.terminalGroup.dispose();
      }

      const providers = this.planner.extractProviders(executionPlan.flat()) as ProviderType[];
      this.terminalGroup = new TerminalGroup(
        {
          orderId: this.orderId,
          cwd,
          providers,
        },
        this.terminalPool,
        this.sharedContext
      );

      this.setupTerminalGroupListeners();

      await this.executeWithOrchestrator(executionPlan, cwd, 0);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.stateMachine.fail(errorMsg);
      this.emit('session:failed', {
        orderId: this.orderId,
        error: errorMsg,
        failedState: this.contextManager.getFailedState(),
        canRetry: this.contextManager.getFailedState() !== null,
      });
      throw error;
    } finally {
      const status = this.stateMachine.getStatus();
      if (status !== 'awaiting_input' && status !== 'failed') {
        this.stateMachine.setCompletedAt(new Date());
      }
    }
  }

  /**
   * Followup 모드 진입
   */
  async enterFollowup(): Promise<void> {
    if (this.stateMachine.getStatus() !== 'completed') {
      throw new Error(`Session ${this.orderId} is not in completed state. Current: ${this.stateMachine.getStatus()}`);
    }

    logger.debug(`Entering followup mode for order ${this.orderId}`);
    this.stateMachine.enterFollowup();
    this.emit('session:followup', { orderId: this.orderId });
  }

  /**
   * Followup 프롬프트 실행
   */
  async executeFollowup(prompt: string): Promise<void> {
    const status = this.stateMachine.getStatus();
    if (status !== 'completed' && status !== 'followup') {
      throw new Error(`Session ${this.orderId} must be in completed or followup state. Current: ${status}`);
    }

    const cwd = this.currentCwd;
    if (!cwd) {
      throw new Error(`No working directory set for session ${this.orderId}`);
    }

    logger.debug(`Executing followup prompt for order ${this.orderId}`);

    this.stateMachine.setStatus('followup');
    this.emit('session:followup-started', { orderId: this.orderId, prompt });

    try {
      if (!this.terminalGroup) {
        const providers: ProviderType[] = [this.barista.provider as ProviderType];
        this.terminalGroup = new TerminalGroup(
          {
            orderId: this.orderId,
            cwd,
            providers,
          },
          this.terminalPool,
          this.sharedContext
        );

        this.setupTerminalGroupListeners();
      }

      const followupStageId = `followup-${Date.now()}`;
      const stageDisplayName = `추가 요청 ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;

      const result = await this.terminalGroup.executeStage(
        followupStageId,
        this.barista.provider as ProviderType,
        prompt,
        { includeContext: true, stageName: stageDisplayName }
      );

      if (result.success) {
        this.stateMachine.complete();
        this.emit('session:followup-completed', {
          orderId: this.orderId,
          stageId: followupStageId,
          output: result.output,
        });
      } else {
        this.emit('session:followup-failed', {
          orderId: this.orderId,
          stageId: followupStageId,
          error: result.error,
        });
        throw new Error(`Followup failed: ${result.error}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.emit('session:followup-failed', {
        orderId: this.orderId,
        error: errorMsg,
      });
      throw error;
    }
  }

  /**
   * Followup 모드 종료 및 세션 완전 종료
   */
  async finishFollowup(): Promise<void> {
    const status = this.stateMachine.getStatus();
    if (status !== 'followup' && status !== 'completed') {
      throw new Error(`Session ${this.orderId} is not in followup or completed state`);
    }

    logger.debug(`Finishing followup mode for order ${this.orderId}`);
    this.stateMachine.setStatus('completed');
    this.stateMachine.setCompletedAt(new Date());
    this.emit('session:followup-finished', { orderId: this.orderId });
  }

  /**
   * 세션을 followup/completed 상태로 복원 (앱 재시작 후 세션 복원용)
   */
  restoreForFollowup(cwd: string): void {
    logger.debug(`Restoring session ${this.orderId} for followup with cwd: ${cwd}`);

    this.stateMachine.setStatus('completed');
    this.currentCwd = cwd;

    if (!this.terminalGroup) {
      const providers: ProviderType[] = [this.barista.provider as ProviderType];
      this.terminalGroup = new TerminalGroup(
        {
          orderId: this.orderId,
          cwd,
          providers,
        },
        this.terminalPool,
        this.sharedContext
      );

      this.setupTerminalGroupListeners();

      logger.debug(`Created terminalGroup for restored session ${this.orderId}`);
    }

    logger.debug(`Session ${this.orderId} restored to completed state, ready for followup`);
  }

  /**
   * 현재 작업 디렉터리 조회
   */
  getCwd(): string | null {
    return this.currentCwd;
  }

  /**
   * terminalGroup 리스너 설정 (중앙화된 헬퍼)
   */
  private setupTerminalGroupListeners(): void {
    if (!this.terminalGroup) {
      return;
    }

    // 이전 terminalGroup 리스너 정리
    if (this.terminalGroupListenerManager) {
      this.terminalGroupListenerManager.detachAll();
    }

    // 새 리스너 관리자 생성
    this.terminalGroupListenerManager = new EventListenerManager();

    this.terminalGroupListenerManager.attach(this.terminalGroup, 'stage:output', (eventData: { stageId?: string; data: unknown }) => {
      this.emit('output', { orderId: this.orderId, stageId: eventData.stageId, data: eventData.data });
    });
  }

  /**
   * 세션 정리
   */
  async dispose(): Promise<void> {
    // terminalGroup 리스너 정리
    if (this.terminalGroupListenerManager) {
      this.terminalGroupListenerManager.detachAll();
      this.terminalGroupListenerManager = null;
    }

    if (this.terminalGroup) {
      await this.terminalGroup.dispose();
      this.terminalGroup = null;
    }

    // 기타 리스너 정리
    this.listenerManager.detachAll();

    this.sharedContext.dispose();
    this.removeAllListeners();

    logger.debug(`Disposed session for order ${this.orderId}`);
  }

  /**
   * EventPropagator에서 발생한 이벤트를 이 EventEmitter로 전파 설정
   */
  private setupEventPropagation(): void {
    const events = [
      'session:started',
      'session:completed',
      'session:failed',
      'session:cancelled',
      'session:awaiting',
      'session:resumed',
      'session:followup',
      'session:followup-started',
      'session:followup-completed',
      'session:followup-failed',
      'session:followup-finished',
      'output',
    ];

    for (const event of events) {
      this.listenerManager.attach(this.eventPropagator, event, (data: unknown) => this.emit(event, data));
    }
  }
}
