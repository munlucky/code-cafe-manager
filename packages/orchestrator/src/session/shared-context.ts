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

/**
 * 이전 실행 시도 정보
 */
export interface PreviousAttempt {
  stageResults: Record<string, StageResult>;
  failedStageId: string;
  error: string;
  timestamp: number;
  attemptNumber: number;
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
  private previousAttempts: PreviousAttempt[] = [];

  constructor(orderId: string, initialVars: Record<string, unknown> = {}) {
    super();
    this.orderId = orderId;
    this.vars = { ...initialVars };
    this.stages = new Map();
    this.artifacts = new Map();
    this.updatedAt = new Date();
    this.previousAttempts = [];
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

  /**
   * 이전 시도 정보 추가
   */
  addPreviousAttempt(attempt: Omit<PreviousAttempt, 'attemptNumber'>): void {
    this.previousAttempts.push({
      ...attempt,
      attemptNumber: this.previousAttempts.length + 1,
    });
    this.updatedAt = new Date();
  }

  /**
   * 이전 시도 존재 여부
   */
  hasPreviousAttempt(): boolean {
    return this.previousAttempts.length > 0;
  }

  /**
   * 최근 이전 시도 조회
   */
  getLastPreviousAttempt(): PreviousAttempt | undefined {
    return this.previousAttempts[this.previousAttempts.length - 1];
  }

  /**
   * 모든 이전 시도 조회
   */
  getAllPreviousAttempts(): PreviousAttempt[] {
    return [...this.previousAttempts];
  }

  /**
   * 현재 시도 번호 (1부터 시작)
   */
  getCurrentAttemptNumber(): number {
    return this.previousAttempts.length + 1;
  }

  /**
   * Stage 결과 초기화 (재시도 시 사용)
   */
  resetStages(): void {
    this.stages.clear();
    this.updatedAt = new Date();
  }

  /**
   * 이전 시도 컨텍스트를 프롬프트용 문자열로 생성
   */
  buildPreviousAttemptContext(): string {
    if (!this.hasPreviousAttempt()) {
      return '';
    }

    const lastAttempt = this.getLastPreviousAttempt()!;
    const completedStages = Object.entries(lastAttempt.stageResults)
      .filter(([_, result]) => result.status === 'completed')
      .map(([stageId]) => stageId);

    const lines = [
      '\n## 이전 시도 정보',
      `- 시도 횟수: ${this.getCurrentAttemptNumber()}번째 시도`,
      `- 이전 실패 stage: ${lastAttempt.failedStageId}`,
      `- 실패 원인: ${lastAttempt.error}`,
      `- 완료된 stages: ${completedStages.join(', ') || '없음'}`,
      '',
      '이전 시도에서 발생한 문제를 참고하여 개선된 결과를 도출해주세요.',
      '---',
    ];

    return lines.join('\n');
  }
}
