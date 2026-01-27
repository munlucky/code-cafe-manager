/**
 * StageCoordinator - Stage 실행 조율 및 오케스트레이터 결정 처리
 */

import { createLogger } from '@codecafe/core';
import type { TerminalGroup } from '../terminal-group';
import type { SharedContext } from '../shared-context';
import type { StageOrchestrator } from '../stage-orchestrator';
import type { OrchestratorDecision } from '../stage-signals';
import type { StageConfig, AwaitingState } from '../order-session';

const logger = createLogger({ context: 'StageCoordinator' });

export type StageExecutionAction = 'proceed' | 'awaiting' | 'retry' | 'failed';

export interface StageExecutionResult {
  action: StageExecutionAction;
  awaitingState?: AwaitingState;
  skipStages?: string[];
  error?: string;
}

export interface StageCoordinatorCallbacks {
  onSkipStages: (stageIds: string[]) => void;
  onAwaitingState: (state: AwaitingState) => void;
  onStageCompleted: (stageId: string) => void;
  onBuildFailedState: (error: string, batchIndex: number, failedStageId?: string) => void;
}

/**
 * Stage 실행 조율 클래스
 */
export class StageCoordinator {
  constructor(
    private readonly orchestrator: StageOrchestrator,
    private readonly terminalGroup: TerminalGroup,
    private readonly sharedContext: SharedContext,
    private readonly callbacks: StageCoordinatorCallbacks
  ) {}

  /**
   * 단일 Stage 실행 및 오케스트레이터 판단
   * @returns 'proceed' | 'awaiting' | 'retry'
   */
  async executeStage(
    stage: StageConfig,
    interpolatedPrompt: string,
    executionPlan: StageConfig[][],
    batchIndex: number,
    cwd: string
  ): Promise<StageExecutionAction> {
    const result = await this.terminalGroup.executeStage(
      stage.id,
      stage.provider,
      interpolatedPrompt,
      { role: stage.role, skills: stage.skills, includeContext: true }
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

    logger.debug(`Orchestrator decision for ${stage.id}`, { decision });

    return this.handleDecision(
      decision,
      stage.id,
      executionPlan,
      batchIndex,
      cwd
    );
  }

  /**
   * 병렬 Stage들의 결과 처리
   */
  async processParallelResults(
    results: Array<{ stageId: string; success: boolean; output?: string; error?: string }>,
    executionPlan: StageConfig[][],
    batchIndex: number,
    cwd: string
  ): Promise<StageExecutionAction> {
    // 실패한 Stage 확인
    const failed = results.filter((r) => !r.success);
    if (failed.length > 0) {
      throw new Error(
        `Parallel stages failed: ${failed.map((f) => `${f.stageId}: ${f.error}`).join(', ')}`
      );
    }

    // 모든 결과의 시그널 확인
    for (const result of results) {
      const decision = await this.orchestrator.evaluate(
        result.stageId,
        result.output || '',
        this.sharedContext
      );

      const handled = this.handleDecision(
        decision,
        result.stageId,
        executionPlan,
        batchIndex,
        cwd
      );

      if (handled === 'awaiting') {
        // 어떤 병렬 stage라도 사용자 입력 필요 시 중단
        return 'awaiting';
      }

      // 병렬 실행 후에도 completedStages에 추가
      this.callbacks.onStageCompleted(result.stageId);
    }

    return 'proceed';
  }

  /**
   * 오케스트레이터 결정 처리
   */
  handleDecision(
    decision: OrchestratorDecision,
    stageId: string,
    executionPlan: StageConfig[][],
    batchIndex: number,
    cwd: string
  ): StageExecutionAction {
    switch (decision.action) {
      case 'await_user': {
        const awaitingState: AwaitingState = {
          stageId,
          questions: decision.questions,
          message: decision.userMessage,
          remainingPlan: executionPlan.slice(batchIndex + 1),
          batchIndex: batchIndex + 1,
          cwd,
        };
        this.callbacks.onAwaitingState(awaitingState);
        return 'awaiting';
      }

      case 'skip_next':
        if (decision.skipStages) {
          this.callbacks.onSkipStages(decision.skipStages);
          logger.debug(`Skipping stages: ${decision.skipStages.join(', ')}`);
        }
        return 'proceed';

      case 'retry':
        logger.debug(`Retry requested for stage ${stageId}: ${decision.reason}`);
        // 재시도는 orchestrator 내부에서 카운트 관리
        return 'retry';

      case 'proceed':
      default:
        return 'proceed';
    }
  }

  /**
   * Batch 실행 (with retry support)
   */
  async executeBatch(
    batch: StageConfig[],
    executionPlan: StageConfig[][],
    batchIndex: number,
    cwd: string,
    interpolatePrompt: (prompt: string) => string,
    shouldSkipStage: (stageId: string) => boolean
  ): Promise<{ action: StageExecutionAction; shouldBreak: boolean }> {
    const MAX_RETRIES = 2;

    // 스킵할 stage 필터링
    const filteredBatch = batch.filter(stage => !shouldSkipStage(stage.id));
    if (filteredBatch.length === 0) {
      logger.debug(`Skipping batch ${batchIndex} - all stages skipped or completed`);
      return { action: 'proceed', shouldBreak: false };
    }

    if (filteredBatch.length === 1) {
      // 순차 실행 + 오케스트레이터 판단 (with retry support)
      const stage = filteredBatch[0];
      let retries = 0;
      let result: StageExecutionAction;

      do {
        try {
          const interpolatedPrompt = interpolatePrompt(stage.prompt);
          result = await this.executeStage(
            stage,
            interpolatedPrompt,
            executionPlan,
            batchIndex,
            cwd
          );
        } catch (stageError) {
          // Stage 실행 중 에러 발생 - failedState 설정
          const errorMsg = stageError instanceof Error ? stageError.message : String(stageError);
          this.callbacks.onBuildFailedState(errorMsg, batchIndex, stage.id);
          throw stageError;
        }

        if (result === 'retry') {
          retries++;
          logger.debug(`Retrying stage ${stage.id} (${retries}/${MAX_RETRIES})...`);
        }
      } while (result === 'retry' && retries < MAX_RETRIES);

      if (result === 'awaiting') {
        // 대기 상태로 전환 - 실행 중단
        return { action: 'awaiting', shouldBreak: true };
      }

      if (result === 'retry') {
        // 재시도 한도 초과 - failedState 설정
        const errorMsg = `Stage ${stage.id} failed after ${MAX_RETRIES} retries`;
        this.callbacks.onBuildFailedState(errorMsg, batchIndex, stage.id);
        throw new Error(errorMsg);
      }

      // Stage 완료 기록
      this.callbacks.onStageCompleted(stage.id);
      return { action: 'proceed', shouldBreak: false };
    } else {
      // 병렬 실행
      const stagesWithPrompts = filteredBatch.map((stage) => ({
        stageId: stage.id,
        provider: stage.provider,
        prompt: interpolatePrompt(stage.prompt),
        role: stage.role,
        skills: stage.skills,
      }));

      const results = await this.terminalGroup.executeStagesParallel(stagesWithPrompts);
      const action = await this.processParallelResults(results, executionPlan, batchIndex, cwd);

      if (action === 'awaiting') {
        return { action: 'awaiting', shouldBreak: true };
      }

      return { action: 'proceed', shouldBreak: false };
    }
  }
}
