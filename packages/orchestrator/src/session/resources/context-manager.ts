/**
 * SessionContextManager - 세션 컨텍스트 및 상태 정보 관리
 */

import { createLogger } from '@codecafe/core';
import type { SharedContext } from '../shared-context';
import type { AwaitingState, FailedState, StageConfig } from '../order-session';

const logger = createLogger({ context: 'SessionContextManager' });

export interface BuildFailedStateParams {
  error: string;
  executionPlan: StageConfig[][];
  failedBatchIndex: number;
  cwd: string;
  failedStageId?: string;
}

/**
 * 세션 컨텍스트 및 상태 정보 관리 클래스
 */
export class SessionContextManager {
  private awaitingState: AwaitingState | null = null;
  private failedState: FailedState | null = null;
  private readonly skipStages: Set<string> = new Set();
  private readonly completedStages: Set<string> = new Set();

  constructor(private readonly sharedContext: SharedContext) {}

  // --- Awaiting State Management ---

  /**
   * 대기 상태 설정
   */
  setAwaitingState(state: AwaitingState): void {
    this.awaitingState = state;
    logger.debug('Set awaiting state', { stageId: state.stageId });
  }

  /**
   * 대기 상태 조회
   */
  getAwaitingState(): AwaitingState | null {
    return this.awaitingState;
  }

  /**
   * 대기 상태 초기화
   */
  clearAwaitingState(): void {
    this.awaitingState = null;
  }

  // --- Failed State Management ---

  /**
   * 실패 상태 정보 구성
   */
  buildFailedState(params: BuildFailedStateParams): FailedState {
    const { error, executionPlan, failedBatchIndex, cwd, failedStageId } = params;

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

    logger.debug(`Built failedState for stage ${failedStageId}`, {
      failedStageId,
      error,
      completedStages: Array.from(this.completedStages),
      retryOptions: retryOptions.map(o => o.stageId),
    });

    return this.failedState;
  }

  /**
   * 실패 상태 조회
   */
  getFailedState(): FailedState | null {
    return this.failedState;
  }

  /**
   * 실패 상태 초기화
   */
  clearFailedState(): void {
    this.failedState = null;
  }

  // --- Completed Stages Management ---

  /**
   * Stage 완료 표시
   */
  markStageCompleted(stageId: string): void {
    this.completedStages.add(stageId);
  }

  /**
   * Stage 완료 여부 확인
   */
  isStageCompleted(stageId: string): boolean {
    return this.completedStages.has(stageId);
  }

  /**
   * 완료된 Stage 목록 조회
   */
  getCompletedStages(): string[] {
    return Array.from(this.completedStages);
  }

  /**
   * 완료된 Stage 제거 (재시도용)
   */
  removeCompletedStage(stageId: string): void {
    this.completedStages.delete(stageId);
  }

  /**
   * 완료된 Stage 초기화
   */
  clearCompletedStages(): void {
    this.completedStages.clear();
  }

  // --- Skip Stages Management ---

  /**
   * 스킵할 Stage 추가
   */
  addSkipStage(stageId: string): void {
    this.skipStages.add(stageId);
  }

  /**
   * Stage 스킵 여부 확인
   */
  shouldSkipStage(stageId: string): boolean {
    return this.skipStages.has(stageId) || this.completedStages.has(stageId);
  }

  /**
   * 스킵할 Stage 목록 조회
   */
  getSkipStages(): string[] {
    return Array.from(this.skipStages);
  }

  // --- SharedContext Delegation ---

  /**
   * SharedContext 접근
   */
  getSharedContext(): SharedContext {
    return this.sharedContext;
  }

  /**
   * 사용자 입력 저장
   */
  setUserInput(stageId: string, input: string): void {
    this.sharedContext.setVar('userInput', input);
    this.sharedContext.setVar(`userInput_${stageId}`, input);
  }
}
