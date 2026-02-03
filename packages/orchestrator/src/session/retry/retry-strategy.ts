/**
 * Retry Strategy Pattern
 *
 * 세션 재시도 로직을 Strategy 패턴으로 분리
 * - RetryFromStageStrategy: 특정 stage부터 재시도
 * - RetryFromBeginningStrategy: 처음부터 재시도
 */

import { createLogger } from '@codecafe/core';
import type { StageConfig } from '../../types';

const logger = createLogger({ context: 'RetryStrategy' });

/**
 * 재시도 준비 결과
 */
export interface RetryPreparation {
  startBatchIndex: number;
  stagesToClear: string[];
}

/**
 * 재시도 Strategy 인터페이스
 */
export interface RetryStrategy {
  /**
   * 재시도 준비 수행
   */
  prepare(): RetryPreparation;

  /**
   * 재시도 설명
   */
  getDescription(): string;
}

/**
 * 재시도 대상 정보
 */
export interface RetryTarget {
  executionPlan: StageConfig[][];
  failedStageId: string;
  failedBatchIndex: number;
  retryOptions: Array<{ stageId: string; stageName: string; batchIndex: number }>;
}

/**
 * Context Manager 인터페이스 (추상화)
 */
export interface IRetryContextManager {
  removeCompletedStage(stageId: string): void;
  clearCompletedStages(): void;
  clearFailedState(): void;
}

/**
 * 특정 Stage부터 재시도 Strategy
 */
export class RetryFromStageStrategy implements RetryStrategy {
  constructor(
    private readonly target: RetryTarget,
    private readonly contextManager: IRetryContextManager,
    private readonly fromStageId?: string
  ) {}

  prepare(): RetryPreparation {
    const { executionPlan, failedStageId, failedBatchIndex, retryOptions } = this.target;

    let startBatchIndex = 0;
    const stagesToClear: string[] = [];

    if (this.fromStageId) {
      // 특정 stage부터 재시도
      const option = retryOptions.find(o => o.stageId === this.fromStageId);
      if (!option) {
        throw new Error(`Stage ${this.fromStageId} not found in retry options`);
      }
      startBatchIndex = option.batchIndex;

      const stageIndex = retryOptions.findIndex(o => o.stageId === this.fromStageId);
      for (let i = stageIndex; i < retryOptions.length; i++) {
        stagesToClear.push(retryOptions[i].stageId);
      }
    } else {
      // 실패한 stage부터 재시도
      startBatchIndex = failedBatchIndex < 0 ? 0 : failedBatchIndex;
      stagesToClear.push(failedStageId);
    }

    // 완료된 stage 제거
    for (const stageId of stagesToClear) {
      this.contextManager.removeCompletedStage(stageId);
    }

    return { startBatchIndex, stagesToClear };
  }

  getDescription(): string {
    const stageId = this.fromStageId || this.target.failedStageId;
    return `Retrying from stage ${stageId} (batch ${this.prepare().startBatchIndex})`;
  }
}

/**
 * 처음부터 재시도 Strategy
 */
export class RetryFromBeginningStrategy implements RetryStrategy {
  constructor(
    private readonly target: RetryTarget,
    private readonly contextManager: IRetryContextManager
  ) {}

  prepare(): RetryPreparation {
    // 모든 완료된 stage 제거
    this.contextManager.clearCompletedStages();

    return {
      startBatchIndex: 0,
      stagesToClear: [], // 전체를 초기화하므로 개별 제거 불필요
    };
  }

  getDescription(): string {
    return 'Retrying from beginning';
  }
}

/**
 * Retry Strategy Factory
 */
export class RetryStrategyFactory {
  static createFromStage(
    target: RetryTarget,
    contextManager: IRetryContextManager,
    fromStageId?: string
  ): RetryStrategy {
    return new RetryFromStageStrategy(target, contextManager, fromStageId);
  }

  static createFromBeginning(
    target: RetryTarget,
    contextManager: IRetryContextManager
  ): RetryStrategy {
    return new RetryFromBeginningStrategy(target, contextManager);
  }
}
