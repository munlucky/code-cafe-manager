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
 * 컨텍스트 크기 관리 옵션
 */
export interface ContextSizeOptions {
  /** 최대 토큰 수 (기본값: 8000) */
  maxTokens?: number;
  /** 경고 임계값 비율 (기본값: 0.8 = 80%) */
  warningThreshold?: number;
  /** 자동 아카이빙 활성화 (기본값: true) */
  autoArchive?: boolean;
}

/**
 * 아카이브된 컨텍스트 정보
 */
export interface ArchivedContext {
  version: number;
  snapshot: ContextSnapshot;
  archivedAt: string;
  reason: 'token_limit' | 'manual';
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

  // Context size management
  private readonly maxTokens: number;
  private readonly warningThreshold: number;
  private readonly autoArchive: boolean;
  private archives: ArchivedContext[] = [];
  private archiveVersion: number = 0;
  private warningEmitted: boolean = false;

  constructor(
    orderId: string,
    initialVars: Record<string, unknown> = {},
    sizeOptions: ContextSizeOptions = {}
  ) {
    super();
    this.orderId = orderId;
    this.vars = { ...initialVars };
    this.stages = new Map();
    this.artifacts = new Map();
    this.updatedAt = new Date();
    this.previousAttempts = [];

    // Context size management initialization
    this.maxTokens = sizeOptions.maxTokens ?? 8000;
    this.warningThreshold = sizeOptions.warningThreshold ?? 0.8;
    this.autoArchive = sizeOptions.autoArchive ?? true;
  }

  /**
   * 변수 설정
   */
  setVar(key: string, value: unknown): void {
    this.vars[key] = value;
    this.updatedAt = new Date();
    this.emit('var:updated', { key, value, orderId: this.orderId });
    this.checkAndManageSize();
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
  startStage(stageId: string, provider: string, stageName?: string, skills?: string[]): void {
    const result: StageResult = {
      stageId,
      provider,
      status: 'running',
      startedAt: new Date().toISOString(),
    };
    this.stages.set(stageId, result);
    this.updatedAt = new Date();
    this.emit('stage:started', { stageId, stageName, provider, skills, orderId: this.orderId });
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
    this.checkAndManageSize();
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

  // ==========================================================================
  // Context Size Management
  // ==========================================================================

  /**
   * 현재 컨텍스트의 토큰 수 추정
   * 대략적인 추정: 1 토큰 ≈ 3 문자 (영어/한국어 혼합 기준)
   */
  estimateTokens(): number {
    const snapshot = this.snapshot();
    const content = JSON.stringify(snapshot);
    return Math.ceil(content.length / 3);
  }

  /**
   * 현재 토큰 사용률 (0.0 ~ 1.0+)
   */
  getTokenUsageRatio(): number {
    return this.estimateTokens() / this.maxTokens;
  }

  /**
   * 컨텍스트 크기 상태 조회
   */
  getContextSizeStatus(): {
    currentTokens: number;
    maxTokens: number;
    usageRatio: number;
    isWarning: boolean;
    isOverLimit: boolean;
    archiveCount: number;
  } {
    const currentTokens = this.estimateTokens();
    const usageRatio = currentTokens / this.maxTokens;
    return {
      currentTokens,
      maxTokens: this.maxTokens,
      usageRatio,
      isWarning: usageRatio >= this.warningThreshold,
      isOverLimit: usageRatio >= 1.0,
      archiveCount: this.archives.length,
    };
  }

  /**
   * 컨텍스트 크기 체크 및 관리
   * 변수/결과 추가 후 호출하여 자동 아카이빙 트리거
   */
  checkAndManageSize(): void {
    const status = this.getContextSizeStatus();

    // 경고 임계값 도달 시 이벤트 발행 (한 번만)
    if (status.isWarning && !this.warningEmitted) {
      this.warningEmitted = true;
      this.emit('context:size:warning', {
        orderId: this.orderId,
        currentTokens: status.currentTokens,
        maxTokens: status.maxTokens,
        usageRatio: status.usageRatio,
      });
    }

    // 한도 초과 시 자동 아카이빙
    if (status.isOverLimit && this.autoArchive) {
      this.archiveAndReset('token_limit');
    }
  }

  /**
   * 현재 컨텍스트 아카이빙 및 리셋
   */
  archiveAndReset(reason: 'token_limit' | 'manual' = 'manual'): ArchivedContext {
    const snapshot = this.snapshot();
    this.archiveVersion++;

    const archived: ArchivedContext = {
      version: this.archiveVersion,
      snapshot,
      archivedAt: new Date().toISOString(),
      reason,
    };

    this.archives.push(archived);

    // 스테이지 결과 및 아티팩트 초기화 (vars는 유지)
    const stageCount = this.stages.size;
    const artifactCount = this.artifacts.size;
    this.stages.clear();
    this.artifacts.clear();
    this.warningEmitted = false;
    this.updatedAt = new Date();

    this.emit('context:archived', {
      orderId: this.orderId,
      version: this.archiveVersion,
      reason,
      clearedStages: stageCount,
      clearedArtifacts: artifactCount,
    });

    return archived;
  }

  /**
   * 아카이브 목록 조회
   */
  getArchives(): ArchivedContext[] {
    return [...this.archives];
  }

  /**
   * 특정 버전의 아카이브 조회
   */
  getArchive(version: number): ArchivedContext | undefined {
    return this.archives.find((a) => a.version === version);
  }

  /**
   * 최신 아카이브 조회
   */
  getLatestArchive(): ArchivedContext | undefined {
    return this.archives[this.archives.length - 1];
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * 정리
   */
  dispose(): void {
    this.removeAllListeners();
    this.stages.clear();
    this.artifacts.clear();
    this.archives = [];
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
