/**
 * SharedContext - 터미널 간 공유 컨텍스트
 *
 * 여러 터미널이 동일한 Order를 실행할 때 결과를 동기화하기 위한 컨텍스트
 * - Stage 결과 저장
 * - 변수 공유
 * - 이벤트 발행
 */

import { EventEmitter } from 'events';

export interface StageResult {
  stageId: string;
  provider: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: any;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
}

export interface ContextSnapshot {
  orderId: string;
  vars: Record<string, unknown>;
  stages: Record<string, StageResult>;
  artifacts: Record<string, unknown>;
  updatedAt: string;
}

/**
 * SharedContext - 터미널 간 결과 동기화를 위한 공유 컨텍스트
 */
export class SharedContext extends EventEmitter {
  private readonly orderId: string;
  private vars: Record<string, unknown>;
  private stages: Map<string, StageResult>;
  private artifacts: Map<string, unknown>;
  private updatedAt: Date;

  constructor(orderId: string, initialVars: Record<string, unknown> = {}) {
    super();
    this.orderId = orderId;
    this.vars = { ...initialVars };
    this.stages = new Map();
    this.artifacts = new Map();
    this.updatedAt = new Date();
  }

  /**
   * 변수 설정
   */
  setVar(key: string, value: unknown): void {
    this.vars[key] = value;
    this.updatedAt = new Date();
    this.emit('var:updated', { key, value, orderId: this.orderId });
  }

  /**
   * 변수 조회
   */
  getVar(key: string): unknown {
    return this.vars[key];
  }

  /**
   * 모든 변수 조회
   */
  getVars(): Record<string, unknown> {
    return { ...this.vars };
  }

  /**
   * Stage 결과 시작 기록
   */
  startStage(stageId: string, provider: string): void {
    const result: StageResult = {
      stageId,
      provider,
      status: 'running',
      startedAt: new Date().toISOString(),
    };
    this.stages.set(stageId, result);
    this.updatedAt = new Date();
    this.emit('stage:started', { stageId, provider, orderId: this.orderId });
  }

  /**
   * Stage 결과 완료 기록
   */
  completeStage(stageId: string, output: any): void {
    const existing = this.stages.get(stageId);
    if (!existing) {
      throw new Error(`Stage ${stageId} not found in context`);
    }

    const completedAt = new Date().toISOString();
    const duration = existing.startedAt
      ? new Date(completedAt).getTime() - new Date(existing.startedAt).getTime()
      : 0;

    const result: StageResult = {
      ...existing,
      status: 'completed',
      output,
      completedAt,
      duration,
    };
    this.stages.set(stageId, result);
    this.updatedAt = new Date();

    // 결과를 변수로도 저장 (다음 Stage에서 참조 가능)
    this.vars[`stage_${stageId}_output`] = output;

    this.emit('stage:completed', { stageId, output, duration, orderId: this.orderId });
  }

  /**
   * Stage 결과 실패 기록
   */
  failStage(stageId: string, error: string): void {
    const existing = this.stages.get(stageId);
    if (!existing) {
      throw new Error(`Stage ${stageId} not found in context`);
    }

    const result: StageResult = {
      ...existing,
      status: 'failed',
      error,
      completedAt: new Date().toISOString(),
    };
    this.stages.set(stageId, result);
    this.updatedAt = new Date();
    this.emit('stage:failed', { stageId, error, orderId: this.orderId });
  }

  /**
   * Stage 결과 조회
   */
  getStageResult(stageId: string): StageResult | undefined {
    return this.stages.get(stageId);
  }

  /**
   * 모든 Stage 결과 조회
   */
  getAllStageResults(): Record<string, StageResult> {
    const results: Record<string, StageResult> = {};
    for (const [key, value] of this.stages) {
      results[key] = value;
    }
    return results;
  }

  /**
   * Artifact 저장 (파일, 생성물 등)
   */
  setArtifact(key: string, value: unknown): void {
    this.artifacts.set(key, value);
    this.updatedAt = new Date();
    this.emit('artifact:created', { key, orderId: this.orderId });
  }

  /**
   * Artifact 조회
   */
  getArtifact(key: string): unknown {
    return this.artifacts.get(key);
  }

  /**
   * 컨텍스트 스냅샷 생성
   */
  snapshot(): ContextSnapshot {
    return {
      orderId: this.orderId,
      vars: { ...this.vars },
      stages: this.getAllStageResults(),
      artifacts: Object.fromEntries(this.artifacts),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  /**
   * 다른 터미널에게 전달할 프롬프트 컨텍스트 생성
   */
  buildPromptContext(additionalContext?: Record<string, unknown>): string {
    const context = {
      previousResults: this.getAllStageResults(),
      vars: this.vars,
      ...additionalContext,
    };

    // 완료된 Stage 결과만 포함
    const completedStages = Object.entries(context.previousResults)
      .filter(([_, result]) => result.status === 'completed')
      .map(([stageId, result]) => `[${stageId}]: ${JSON.stringify(result.output)}`);

    if (completedStages.length === 0) {
      return '';
    }

    return `\n\n[Previous Stage Results]\n${completedStages.join('\n')}`;
  }

  /**
   * 정리
   */
  dispose(): void {
    this.removeAllListeners();
    this.stages.clear();
    this.artifacts.clear();
  }
}
