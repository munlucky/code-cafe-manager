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
import { Order, Barista } from '@codecafe/core';
import { TerminalPool } from '../terminal/terminal-pool';
import { SharedContext } from './shared-context';
import { TerminalGroup, ProviderType } from './terminal-group';

export interface StageConfig {
  id: string;
  name: string;
  provider: ProviderType;
  prompt: string;
  role?: string;
  mode?: 'sequential' | 'parallel';
  dependsOn?: string[];  // 의존하는 Stage ID 목록
}

export interface WorkflowConfig {
  stages: StageConfig[];
  vars?: Record<string, unknown>;
}

export type SessionStatus = 'created' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * OrderSession - Order 실행 세션
 */
export class OrderSession extends EventEmitter {
  readonly orderId: string;
  readonly cafeId: string;
  readonly barista: Barista;

  private readonly terminalPool: TerminalPool;
  private readonly sharedContext: SharedContext;
  private terminalGroup: TerminalGroup | null = null;

  private status: SessionStatus = 'created';
  private workflowConfig: WorkflowConfig | null = null;
  private startedAt: Date | null = null;
  private completedAt: Date | null = null;
  private error: string | null = null;

  constructor(
    order: Order,
    barista: Barista,
    cafeId: string,
    terminalPool: TerminalPool
  ) {
    super();
    this.orderId = order.id;
    this.cafeId = cafeId;
    this.barista = barista;
    this.terminalPool = terminalPool;

    // SharedContext 초기화 (Order 변수로)
    this.sharedContext = new SharedContext(order.id, order.vars || {});

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
      this.terminalGroup.on('stage:output', (data) => {
        this.emit('output', { orderId: this.orderId, stageId: data.stageId, data: data.data });
      });

      // Stage 실행 계획 생성
      const executionPlan = this.buildExecutionPlan(this.workflowConfig.stages);

      // 계획에 따라 Stage 실행
      for (const batch of executionPlan) {
        if (batch.length === 1) {
          // 순차 실행
          const stage = batch[0];
          const interpolatedPrompt = this.interpolatePrompt(stage.prompt);
          const result = await this.terminalGroup.executeStage(
            stage.id,
            stage.provider,
            interpolatedPrompt,
            { role: stage.role, includeContext: true }
          );

          if (!result.success) {
            throw new Error(`Stage ${stage.id} failed: ${result.error}`);
          }
        } else {
          // 병렬 실행
          const stagesWithPrompts = batch.map((stage) => ({
            stageId: stage.id,
            provider: stage.provider,
            prompt: this.interpolatePrompt(stage.prompt),
            role: stage.role,
          }));

          const results = await this.terminalGroup.executeStagesParallel(stagesWithPrompts);

          // 실패한 Stage 확인
          const failed = results.filter((r) => !r.success);
          if (failed.length > 0) {
            throw new Error(
              `Parallel stages failed: ${failed.map((f) => `${f.stageId}: ${f.error}`).join(', ')}`
            );
          }
        }
      }

      this.status = 'completed';
      this.emit('session:completed', {
        orderId: this.orderId,
        context: this.sharedContext.snapshot(),
      });
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
   */
  private buildExecutionPlan(stages: StageConfig[]): StageConfig[][] {
    const plan: StageConfig[][] = [];
    const executed = new Set<string>();
    const remaining = [...stages];

    while (remaining.length > 0) {
      const batch: StageConfig[] = [];

      for (let i = remaining.length - 1; i >= 0; i--) {
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
          remaining.splice(i, 1);
        }
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
   * 프롬프트 변수 치환
   */
  private interpolatePrompt(prompt: string): string {
    const vars = this.sharedContext.getVars();
    let result = prompt;

    for (const [key, value] of Object.entries(vars)) {
      const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      result = result.replace(pattern, String(value));
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
