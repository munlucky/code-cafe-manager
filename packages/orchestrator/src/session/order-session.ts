/**
 * OrderSession - Order 실행 세션 관리
 *
 * Order의 전체 라이프사이클을 관리:
 * 1. 워크플로우 Stage 분석
 * 2. Provider별 터미널 할당 결정
 * 3. Stage 순차/병렬 실행
 * 4. 결과 동기화 및 전달
 */

import { EventEmitter } from 'events';
import { Order, Barista, ProviderType } from '@codecafe/core';
import { TerminalPool } from '../terminal/terminal-pool';
import { SharedContext } from './shared-context';
import { TerminalGroup } from './terminal-group';
import { StageOrchestrator, OrchestratorConfig } from './stage-orchestrator';
import { OrchestratorDecision } from './stage-signals';

export interface StageConfig {
  id: string;
  name: string;
  provider: 'claude-code' | 'codex' | 'gemini' | 'grok';
  prompt: string;
  role?: string;
  mode?: 'sequential' | 'parallel';
  dependsOn?: string[];  // 의존하는 Stage ID 목록
}

export interface WorkflowConfig {
  stages: StageConfig[];
  vars?: Record<string, unknown>;
}

export type SessionStatus = 'created' | 'running' | 'awaiting_input' | 'completed' | 'failed' | 'cancelled';

/**
 * 대기 상태 정보
 */
export interface AwaitingState {
  /** 대기 중인 stage ID */
  stageId: string;
  /** 사용자에게 할 질문들 */
  questions?: string[];
  /** 사용자에게 표시할 메시지 */
  message?: string;
  /** 남은 실행 계획 */
  remainingPlan: StageConfig[][];
  /** 현재 batch 인덱스 */
  batchIndex: number;
  /** cwd */
  cwd: string;
}

/**
 * 실패 상태 정보 (재시도용)
 */
export interface FailedState {
  /** 실패한 stage ID */
  failedStageId: string;
  /** 에러 메시지 */
  error: string;
  /** 전체 실행 계획 */
  executionPlan: StageConfig[][];
  /** 실패한 batch 인덱스 */
  failedBatchIndex: number;
  /** 완료된 stage IDs */
  completedStages: string[];
  /** cwd */
  cwd: string;
  /** 재시도 가능한 stage 옵션 (stage ID와 이름) */
  retryOptions: Array<{ stageId: string; stageName: string; batchIndex: number }>;
}

/**
 * OrderSession - Order 실행 세션
 */
export class OrderSession extends EventEmitter {
  readonly orderId: string;
  readonly cafeId: string;
  readonly barista: Barista;

  private readonly terminalPool: TerminalPool;
  private readonly sharedContext: SharedContext;
  private readonly orchestrator: StageOrchestrator;
  private terminalGroup: TerminalGroup | null = null;

  private status: SessionStatus = 'created';
  private workflowConfig: WorkflowConfig | null = null;
  private startedAt: Date | null = null;
  private completedAt: Date | null = null;
  private error: string | null = null;
  private awaitingState: AwaitingState | null = null;
  private failedState: FailedState | null = null;
  private skipStages: Set<string> = new Set();
  private completedStages: Set<string> = new Set();
  private currentExecutionPlan: StageConfig[][] | null = null;
  private currentCwd: string | null = null;

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

    // SharedContext 초기화 (Order 변수로)
    this.sharedContext = new SharedContext(order.id, order.vars || {});

    // Orchestrator 초기화
    this.orchestrator = new StageOrchestrator(orchestratorConfig);

    // SharedContext 이벤트 전파
    this.sharedContext.on('stage:started', (data) => this.emit('stage:started', data));
    this.sharedContext.on('stage:completed', (data) => this.emit('stage:completed', data));
    this.sharedContext.on('stage:failed', (data) => this.emit('stage:failed', data));
  }

  /**
   * 워크플로우 설정
   */
  setWorkflow(config: WorkflowConfig): void {
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
    if (this.status !== 'created') {
      throw new Error(`Session ${this.orderId} is not in created state`);
    }

    this.status = 'running';
    this.startedAt = new Date();
    this.emit('session:started', { orderId: this.orderId, cafeId: this.cafeId });

    try {
      // TerminalGroup 생성 (단일 Provider)
      this.terminalGroup = new TerminalGroup(
        {
          orderId: this.orderId,
          cwd,
          providers: [this.barista.provider as ProviderType],
        },
        this.terminalPool,
        this.sharedContext
      );

      // 터미널 출력 이벤트 전파
      this.terminalGroup.on('stage:output', (data) => {
        this.emit('output', { orderId: this.orderId, data: data.data });
      });

      // 단일 Stage로 실행
      const result = await this.terminalGroup.executeStage(
        'main',
        this.barista.provider as ProviderType,
        prompt,
        { includeContext: false }
      );

      if (result.success) {
        this.status = 'completed';
        this.emit('session:completed', {
          orderId: this.orderId,
          output: result.output,
        });
      } else {
        this.status = 'failed';
        this.error = result.error || 'Unknown error';
        this.emit('session:failed', {
          orderId: this.orderId,
          error: this.error,
        });
      }
    } catch (error) {
      this.status = 'failed';
      this.error = error instanceof Error ? error.message : String(error);
      this.emit('session:failed', {
        orderId: this.orderId,
        error: this.error,
      });
      throw error;
    } finally {
      this.completedAt = new Date();
    }
  }

  /**
   * 워크플로우 실행
   */
  async execute(cwd: string): Promise<void> {
    if (!this.workflowConfig) {
      throw new Error(`No workflow configured for session ${this.orderId}`);
    }

    if (this.status !== 'created') {
      throw new Error(`Session ${this.orderId} is not in created state`);
    }

    this.status = 'running';
    this.startedAt = new Date();
    this.currentCwd = cwd;
    this.emit('session:started', { orderId: this.orderId, cafeId: this.cafeId });

    try {
      // 필요한 Provider 목록 추출
      const providers = this.extractProviders(this.workflowConfig.stages);

      // TerminalGroup 생성
      this.terminalGroup = new TerminalGroup(
        {
          orderId: this.orderId,
          cwd,
          providers,
        },
        this.terminalPool,
        this.sharedContext
      );

      // 터미널 출력 이벤트 전파
      this.terminalGroup.on('stage:output', (eventData) => {
        this.emit('output', { orderId: this.orderId, stageId: eventData.stageId, data: eventData.data });
      });

      // Stage 실행 계획 생성 및 저장
      const executionPlan = this.buildExecutionPlan(this.workflowConfig.stages);
      this.currentExecutionPlan = executionPlan;

      // 계획에 따라 Stage 실행 (오케스트레이터 판단 포함)
      await this.executeWithOrchestrator(executionPlan, cwd);

    } catch (error) {
      // 실패 상태로 전환하되 failedState 저장 (재시도 지원)
      this.status = 'failed';
      this.error = error instanceof Error ? error.message : String(error);

      // failedState가 이미 설정되어 있지 않으면 (executeWithOrchestrator에서 설정되지 않은 경우)
      if (!this.failedState && this.currentExecutionPlan) {
        this.buildFailedState(this.error, this.currentExecutionPlan, -1, cwd);
      }

      this.emit('session:failed', {
        orderId: this.orderId,
        error: this.error,
        failedState: this.failedState,
        canRetry: this.failedState !== null,
      });
      throw error;
    } finally {
      if ((this.status as SessionStatus) !== 'awaiting_input' && (this.status as SessionStatus) !== 'failed') {
        this.completedAt = new Date();
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
    const MAX_RETRIES = 2;

    for (let batchIndex = startFromBatch; batchIndex < executionPlan.length; batchIndex++) {
      const batch = executionPlan[batchIndex];

      // 스킵할 stage 필터링 (이미 완료된 stage도 스킵)
      const filteredBatch = batch.filter(stage =>
        !this.skipStages.has(stage.id) && !this.completedStages.has(stage.id)
      );
      if (filteredBatch.length === 0) {
        console.log(`[OrderSession] Skipping batch ${batchIndex} - all stages skipped or completed`);
        continue;
      }

      if (filteredBatch.length === 1) {
        // 순차 실행 + 오케스트레이터 판단 (with retry support)
        const stage = filteredBatch[0];
        let retries = 0;
        let result: 'proceed' | 'awaiting' | 'retry' | 'failed';

        do {
          try {
            result = await this.executeStageWithOrchestrator(stage, executionPlan, batchIndex, cwd);
          } catch (stageError) {
            // Stage 실행 중 에러 발생 - failedState 설정
            const errorMsg = stageError instanceof Error ? stageError.message : String(stageError);
            this.buildFailedState(errorMsg, executionPlan, batchIndex, cwd, stage.id);
            throw stageError;
          }

          if (result === 'retry') {
            retries++;
            console.log(`[OrderSession] Retrying stage ${stage.id} (${retries}/${MAX_RETRIES})...`);
          }
        } while (result === 'retry' && retries < MAX_RETRIES);

        if (result === 'awaiting') {
          // 대기 상태로 전환 - 실행 중단
          return;
        }

        if (result === 'retry') {
          // 재시도 한도 초과 - failedState 설정
          const errorMsg = `Stage ${stage.id} failed after ${MAX_RETRIES} retries`;
          this.buildFailedState(errorMsg, executionPlan, batchIndex, cwd, stage.id);
          throw new Error(errorMsg);
        }

        // Stage 완료 기록
        this.completedStages.add(stage.id);
      } else {
        // 병렬 실행
        const stagesWithPrompts = filteredBatch.map((stage) => ({
          stageId: stage.id,
          provider: stage.provider,
          prompt: this.interpolatePrompt(stage.prompt),
          role: stage.role,
        }));

        const results = await this.terminalGroup!.executeStagesParallel(stagesWithPrompts);

        // 실패한 Stage 확인
        const failed = results.filter((r) => !r.success);
        if (failed.length > 0) {
          throw new Error(
            `Parallel stages failed: ${failed.map((f) => `${f.stageId}: ${f.error}`).join(', ')}`
          );
        }

        // 병렬 실행 후 모든 결과의 시그널 확인
        for (const result of results) {
          const decision = await this.orchestrator.evaluate(
            result.stageId,
            result.output || '',
            this.sharedContext
          );

          const handled = await this.handleOrchestratorDecision(
            decision,
            result.stageId,
            executionPlan,
            batchIndex,
            cwd
          );

          if (handled === 'awaiting') {
            // 어떤 병렬 stage라도 사용자 입력 필요 시 중단
            return;
          }

          // 병렬 실행 후에도 completedStages에 추가
          this.completedStages.add(result.stageId);
        }
      }
    }

    // 모든 Stage 완료 (awaiting_input 상태가 아닐 때만)
    if (this.status !== 'awaiting_input') {
      this.status = 'completed';
      this.emit('session:completed', {
        orderId: this.orderId,
        context: this.sharedContext.snapshot(),
      });
    }
  }

  /**
   * 실패 상태 정보 구성
   */
  private buildFailedState(
    error: string,
    executionPlan: StageConfig[][],
    failedBatchIndex: number,
    cwd: string,
    failedStageId?: string
  ): void {
    // 재시도 가능한 stage 옵션 생성
    const retryOptions: Array<{ stageId: string; stageName: string; batchIndex: number }> = [];

    // 실패한 stage부터 재시도 가능
    if (failedStageId) {
      const stageConfig = executionPlan.flat().find(s => s.id === failedStageId);
      if (stageConfig) {
        retryOptions.push({
          stageId: failedStageId,
          stageName: stageConfig.name,
          batchIndex: failedBatchIndex,
        });
      }
    }

    // 완료된 stage들도 재시도 옵션에 추가 (사용자가 선택 가능)
    // 실행되지 않은 stage는 제외
    for (let i = 0; i < executionPlan.length; i++) {
      for (const stage of executionPlan[i]) {
        // 완료된 stage만 포함 (실패한 stage는 위에서 이미 추가됨)
        if (this.completedStages.has(stage.id) && stage.id !== failedStageId) {
          retryOptions.push({
            stageId: stage.id,
            stageName: stage.name,
            batchIndex: i,
          });
        }
      }
    }

    // batchIndex 순서로 정렬
    retryOptions.sort((a, b) => a.batchIndex - b.batchIndex);

    this.failedState = {
      failedStageId: failedStageId || 'unknown',
      error,
      executionPlan,
      failedBatchIndex,
      completedStages: Array.from(this.completedStages),
      cwd,
      retryOptions,
    };

    console.log(`[OrderSession] Built failedState for stage ${failedStageId}:`, {
      failedStageId,
      error,
      completedStages: Array.from(this.completedStages),
      retryOptions: retryOptions.map(o => o.stageId),
    });
  }

  /**
   * 단일 Stage 실행 및 오케스트레이터 판단
   * @returns 'proceed' | 'awaiting' | 'retry'
   */
  private async executeStageWithOrchestrator(
    stage: StageConfig,
    executionPlan: StageConfig[][],
    batchIndex: number,
    cwd: string
  ): Promise<'proceed' | 'awaiting' | 'retry'> {
    const interpolatedPrompt = this.interpolatePrompt(stage.prompt);
    const result = await this.terminalGroup!.executeStage(
      stage.id,
      stage.provider,
      interpolatedPrompt,
      { role: stage.role, includeContext: true }
    );

    if (!result.success) {
      throw new Error(`Stage ${stage.id} failed: ${result.error}`);
    }

    // 오케스트레이터 판단
    const decision = await this.orchestrator.evaluate(
      stage.id,
      result.output || '',
      this.sharedContext
    );

    console.log(`[OrderSession] Orchestrator decision for ${stage.id}:`, decision);

    return this.handleOrchestratorDecision(
      decision,
      stage.id,
      executionPlan,
      batchIndex,
      cwd
    );
  }

  /**
   * 오케스트레이터 결정 처리
   */
  private async handleOrchestratorDecision(
    decision: OrchestratorDecision,
    stageId: string,
    executionPlan: StageConfig[][],
    batchIndex: number,
    cwd: string
  ): Promise<'proceed' | 'awaiting' | 'retry'> {
    switch (decision.action) {
      case 'await_user':
        this.status = 'awaiting_input';
        this.awaitingState = {
          stageId,
          questions: decision.questions,
          message: decision.userMessage,
          remainingPlan: executionPlan.slice(batchIndex + 1),
          batchIndex: batchIndex + 1,
          cwd,
        };
        this.emit('session:awaiting', {
          orderId: this.orderId,
          stageId,
          questions: decision.questions,
          message: decision.userMessage,
        });
        return 'awaiting';

      case 'skip_next':
        if (decision.skipStages) {
          for (const skipId of decision.skipStages) {
            this.skipStages.add(skipId);
          }
          console.log(`[OrderSession] Skipping stages: ${decision.skipStages.join(', ')}`);
        }
        return 'proceed';

      case 'retry':
        console.log(`[OrderSession] Retry requested for stage ${stageId}: ${decision.reason}`);
        // 재시도는 orchestrator 내부에서 카운트 관리
        return 'retry';

      case 'proceed':
      default:
        return 'proceed';
    }
  }

  /**
   * 대기 상태에서 사용자 입력 후 재개
   */
  async resume(userInput: string): Promise<void> {
    if (this.status !== 'awaiting_input' || !this.awaitingState) {
      throw new Error(`Session ${this.orderId} is not awaiting input`);
    }

    console.log(`[OrderSession] Resuming session with user input`);

    // 사용자 입력을 SharedContext에 저장
    this.sharedContext.setVar('userInput', userInput);
    this.sharedContext.setVar(`userInput_${this.awaitingState.stageId}`, userInput);

    const { remainingPlan, batchIndex, cwd } = this.awaitingState;

    // 상태 초기화
    this.awaitingState = null;
    this.status = 'running';

    this.emit('session:resumed', { orderId: this.orderId, userInput });

    try {
      // 남은 계획 실행
      await this.executeWithOrchestrator(remainingPlan, cwd, 0);
    } catch (error) {
      this.status = 'failed';
      this.error = error instanceof Error ? error.message : String(error);
      this.emit('session:failed', {
        orderId: this.orderId,
        error: this.error,
      });
      throw error;
    } finally {
      if ((this.status as SessionStatus) !== 'awaiting_input') {
        this.completedAt = new Date();
      }
    }
  }

  /**
   * 대기 상태 정보 조회
   */
  getAwaitingState(): AwaitingState | null {
    return this.awaitingState;
  }

  /**
   * Stage에서 사용하는 Provider 목록 추출
   */
  private extractProviders(stages: StageConfig[]): ProviderType[] {
    const providers = new Set<ProviderType>();
    for (const stage of stages) {
      providers.add(stage.provider);
    }
    return Array.from(providers);
  }

  /**
   * Stage 실행 계획 생성 (의존성 기반)
   *
   * 같은 배치에 있는 Stage들은 병렬 실행 가능
   * 순차 모드에서는 원본 배열 순서를 유지
   */
  private buildExecutionPlan(stages: StageConfig[]): StageConfig[][] {
    const plan: StageConfig[][] = [];
    const executed = new Set<string>();
    const remaining = [...stages];

    while (remaining.length > 0) {
      const batch: StageConfig[] = [];
      const toRemove: number[] = [];

      // 정순 순회하여 원본 배열 순서 유지
      for (let i = 0; i < remaining.length; i++) {
        const stage = remaining[i];

        // 의존성 확인
        const dependencies = stage.dependsOn || [];
        const allDependenciesMet = dependencies.every((dep) => executed.has(dep));

        if (allDependenciesMet) {
          // 같은 Provider이고 순차 모드면 따로 배치
          if (stage.mode !== 'parallel') {
            const sameProviderInBatch = batch.some((s) => s.provider === stage.provider);
            if (sameProviderInBatch) {
              continue; // 다음 배치로 미룸
            }
          }

          batch.push(stage);
          toRemove.push(i);
        }
      }

      // 역순으로 제거 (인덱스 변경 방지)
      for (let i = toRemove.length - 1; i >= 0; i--) {
        remaining.splice(toRemove[i], 1);
      }

      if (batch.length === 0 && remaining.length > 0) {
        // 순환 의존성 또는 해결 불가능한 의존성
        throw new Error(
          `Cannot resolve stage dependencies: ${remaining.map((s) => s.id).join(', ')}`
        );
      }

      if (batch.length > 0) {
        plan.push(batch);
        batch.forEach((s) => executed.add(s.id));
      }
    }

    return plan;
  }

  /**
   * 프롬프트 변수 치환 및 이전 시도 컨텍스트 주입
   */
  private interpolatePrompt(prompt: string): string {
    const vars = this.sharedContext.getVars();
    let result = prompt;

    // 변수 치환
    for (const [key, value] of Object.entries(vars)) {
      const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      result = result.replace(pattern, String(value));
    }

    // 이전 시도 컨텍스트 주입 (재시도 시)
    const previousAttemptContext = this.sharedContext.buildPreviousAttemptContext();
    if (previousAttemptContext) {
      result = previousAttemptContext + '\n' + result;
    }

    return result;
  }

  /**
   * 세션 취소
   */
  async cancel(): Promise<void> {
    if (this.status !== 'running') {
      return;
    }

    this.status = 'cancelled';
    this.error = 'Cancelled by user';
    this.completedAt = new Date();

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
    const duration =
      this.startedAt && this.completedAt
        ? this.completedAt.getTime() - this.startedAt.getTime()
        : null;

    return {
      orderId: this.orderId,
      cafeId: this.cafeId,
      status: this.status,
      terminals: this.terminalGroup?.getStatus() || null,
      context: this.sharedContext.snapshot(),
      startedAt: this.startedAt?.toISOString() || null,
      completedAt: this.completedAt?.toISOString() || null,
      duration,
      error: this.error,
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
    return this.failedState;
  }

  /**
   * 특정 stage부터 재시도
   * @param fromStageId 재시도 시작할 stage ID (null이면 실패한 stage부터)
   */
  async retryFromStage(fromStageId?: string): Promise<void> {
    if (this.status !== 'failed' || !this.failedState) {
      throw new Error(`Session ${this.orderId} is not in failed state or has no retry info`);
    }

    const { executionPlan, cwd, retryOptions } = this.failedState;

    // 재시도 시작 batch 인덱스 결정
    let startBatchIndex = 0;
    if (fromStageId) {
      const option = retryOptions.find(o => o.stageId === fromStageId);
      if (!option) {
        throw new Error(`Stage ${fromStageId} not found in retry options`);
      }
      startBatchIndex = option.batchIndex;

      // 해당 stage 이후의 완료된 stage들은 completedStages에서 제거
      const stageIndex = retryOptions.findIndex(o => o.stageId === fromStageId);
      for (let i = stageIndex; i < retryOptions.length; i++) {
        this.completedStages.delete(retryOptions[i].stageId);
      }
    } else {
      // 실패한 stage부터 재시도
      startBatchIndex = this.failedState.failedBatchIndex;
      this.completedStages.delete(this.failedState.failedStageId);
    }

    console.log(`[OrderSession] Retrying from stage ${fromStageId || this.failedState.failedStageId} (batch ${startBatchIndex})`);

    // 상태 초기화 전에 failedStageId 저장
    const originalFailedStageId = this.failedState.failedStageId;

    // 상태 초기화
    this.status = 'running';
    this.error = null;
    this.failedState = null;
    this.completedAt = null;

    this.emit('session:resumed', {
      orderId: this.orderId,
      fromStageId: fromStageId || originalFailedStageId,
      retryType: 'stage',
    });

    try {
      // TerminalGroup 재생성이 필요한 경우
      if (!this.terminalGroup) {
        const providers = this.extractProviders(executionPlan.flat());
        this.terminalGroup = new TerminalGroup(
          {
            orderId: this.orderId,
            cwd,
            providers,
          },
          this.terminalPool,
          this.sharedContext
        );

        this.terminalGroup.on('stage:output', (eventData) => {
          this.emit('output', { orderId: this.orderId, stageId: eventData.stageId, data: eventData.data });
        });
      }

      // 실행 재개
      await this.executeWithOrchestrator(executionPlan, cwd, startBatchIndex);

    } catch (error) {
      this.status = 'failed';
      this.error = error instanceof Error ? error.message : String(error);
      this.emit('session:failed', {
        orderId: this.orderId,
        error: this.error,
        failedState: this.failedState,
        canRetry: this.failedState !== null,
      });
      throw error;
    } finally {
      if ((this.status as SessionStatus) !== 'awaiting_input' && (this.status as SessionStatus) !== 'failed') {
        this.completedAt = new Date();
      }
    }
  }

  /**
   * 처음부터 재시도 (이전 시도 컨텍스트 포함)
   * @param preserveContext true면 이전 시도 정보를 컨텍스트에 포함
   */
  async retryFromBeginning(preserveContext: boolean = true): Promise<void> {
    if (this.status !== 'failed' || !this.failedState) {
      throw new Error(`Session ${this.orderId} is not in failed state or has no retry info`);
    }

    const { executionPlan, cwd } = this.failedState;

    console.log(`[OrderSession] Retrying from beginning (preserveContext: ${preserveContext})`);

    // 이전 시도 정보 저장
    if (preserveContext) {
      this.sharedContext.addPreviousAttempt({
        stageResults: this.sharedContext.getAllStageResults(),
        failedStageId: this.failedState.failedStageId,
        error: this.failedState.error,
        timestamp: Date.now(),
      });
    }

    // Stage 결과 초기화 (이전 시도 정보는 유지)
    this.sharedContext.resetStages();
    this.completedStages.clear();

    // 상태 초기화
    this.status = 'running';
    this.error = null;
    this.failedState = null;
    this.completedAt = null;
    this.startedAt = new Date();

    this.emit('session:resumed', {
      orderId: this.orderId,
      retryType: 'beginning',
      attemptNumber: this.sharedContext.getCurrentAttemptNumber(),
      preserveContext,
    });

    try {
      // TerminalGroup 재생성
      if (this.terminalGroup) {
        await this.terminalGroup.dispose();
      }

      const providers = this.extractProviders(executionPlan.flat());
      this.terminalGroup = new TerminalGroup(
        {
          orderId: this.orderId,
          cwd,
          providers,
        },
        this.terminalPool,
        this.sharedContext
      );

      this.terminalGroup.on('stage:output', (eventData) => {
        this.emit('output', { orderId: this.orderId, stageId: eventData.stageId, data: eventData.data });
      });

      // 처음부터 실행
      await this.executeWithOrchestrator(executionPlan, cwd, 0);

    } catch (error) {
      this.status = 'failed';
      this.error = error instanceof Error ? error.message : String(error);
      this.emit('session:failed', {
        orderId: this.orderId,
        error: this.error,
        failedState: this.failedState,
        canRetry: this.failedState !== null,
      });
      throw error;
    } finally {
      if ((this.status as SessionStatus) !== 'awaiting_input' && (this.status as SessionStatus) !== 'failed') {
        this.completedAt = new Date();
      }
    }
  }

  /**
   * 세션 정리
   */
  async dispose(): Promise<void> {
    if (this.terminalGroup) {
      await this.terminalGroup.dispose();
      this.terminalGroup = null;
    }

    this.sharedContext.dispose();
    this.removeAllListeners();

    console.log(`[OrderSession] Disposed session for order ${this.orderId}`);
  }
}
