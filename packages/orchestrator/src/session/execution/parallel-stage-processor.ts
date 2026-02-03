/**
 * Parallel Stage Processor
 *
 * Extracted from stage-coordinator.ts processParallelResults() (135 lines)
 * Handles complex parallel stage result processing with retry logic
 */

import { createLogger } from '@codecafe/core';
import type { StageOrchestrator } from '../stage-orchestrator';
import type { SharedContext } from '../shared-context';
import type { OrchestratorDecision } from '../stage-signals';
import type { StageConfig, AwaitingState } from '../order-session';
import type { TerminalGroup } from '../terminal-group';

const logger = createLogger({ context: 'ParallelStageProcessor' });

/**
 * Stage result from parallel execution
 */
export interface StageResult {
  stageId: string;
  success: boolean;
  output?: string;
  error?: string;
}

/**
 * Decision returned by result handler
 */
export interface HandlerDecision {
  action: 'proceed' | 'awaiting' | 'retry' | 'failed';
  reason?: string;
  awaitingState?: AwaitingState;
}

/**
 * Callbacks for parallel stage processing
 */
export interface ParallelProcessorCallbacks {
  onSkipStages: (stageIds: string[]) => void;
  onAwaitingState: (state: AwaitingState) => void;
  onStageCompleted: (stageId: string) => void;
  onBuildFailedState: (error: string, batchIndex: number, failedStageId?: string) => void;
}

/**
 * Parallel result handler - processes individual stage results
 */
class ParallelResultHandler {
  constructor(
    private readonly orchestrator: StageOrchestrator,
    private readonly sharedContext: SharedContext,
    private readonly stageId: string,
    private readonly executionPlan: StageConfig[][],
    private readonly batchIndex: number,
    private readonly cwd: string
  ) {}

  /**
   * Handle a single stage result
   */
  async handle(result: StageResult): Promise<HandlerDecision> {
    const decision = await this.orchestrator.evaluate(
      result.stageId,
      result.output || '',
      this.sharedContext
    );

    logger.debug(`Orchestrator decision for parallel stage ${result.stageId}`, { decision });

    return this.convertDecision(decision, result.stageId);
  }

  /**
   * Convert orchestrator decision to handler decision
   */
  private convertDecision(decision: OrchestratorDecision, stageId: string): HandlerDecision {
    switch (decision.action) {
      case 'await_user':
        return {
          action: 'awaiting',
          reason: 'Awaiting user input',
          awaitingState: {
            stageId,
            questions: decision.questions,
            message: decision.userMessage,
            remainingPlan: this.executionPlan.slice(this.batchIndex + 1),
            batchIndex: this.batchIndex + 1,
            cwd: this.cwd,
          },
        };

      case 'skip_next':
        return {
          action: 'proceed',
          reason: 'Skipping next stages',
        };

      case 'retry':
        return {
          action: 'retry',
          reason: decision.reason || 'Stage requested retry',
        };

      case 'proceed':
      default:
        return {
          action: 'proceed',
          reason: 'Continue to next stage',
        };
    }
  }
}

/**
 * Parallel Stage Processor
 *
 * Processes results from parallel stage execution with retry logic
 */
export class ParallelStageProcessor {
  constructor(
    private readonly orchestrator: StageOrchestrator,
    private readonly sharedContext: SharedContext,
    private readonly terminalGroup: TerminalGroup,
    private readonly callbacks: ParallelProcessorCallbacks,
    private readonly maxRetries: number = 3
  ) {}

  /**
   * Process parallel stage results with retry support
   *
   * @param results Array of stage execution results
   * @param executionPlan Full execution plan
   * @param batchIndex Current batch index
   * @param cwd Working directory
   * @param stagesMap Map of stage ID to config
   * @param interpolatePrompt Function to interpolate prompt templates
   * @returns 'proceed' | 'awaiting'
   */
  async process(
    results: StageResult[],
    executionPlan: StageConfig[][],
    batchIndex: number,
    cwd: string,
    stagesMap: Map<string, StageConfig>,
    interpolatePrompt: (prompt: string) => string
  ): Promise<'proceed' | 'awaiting'> {
    // Step 1: Check for failed executions
    const failed = results.filter((r) => !r.success);
    if (failed.length > 0) {
      return this.handleFailedResults(results, failed, batchIndex);
    }

    // Step 2: Process orchestrator decisions with retry loop
    let currentResults = results;
    let retryCount = 0;

    while (true) {
      const processingResult = await this.processOrchestratorDecisions(
        currentResults,
        executionPlan,
        batchIndex,
        cwd
      );

      // If awaiting, handle remaining stages
      if (processingResult.action === 'awaiting') {
        return this.handleAwaitingResult(currentResults, processingResult, executionPlan, batchIndex, cwd);
      }

      // If no retries needed, complete and proceed
      if (processingResult.toRetry.length === 0) {
        for (const stageId of processingResult.completed) {
          this.callbacks.onStageCompleted(stageId);
        }
        return 'proceed';
      }

      // Step 3: Check retry limit
      retryCount++;
      if (retryCount > this.maxRetries) {
        return this.handleRetryLimitExceeded(processingResult, batchIndex, retryCount);
      }

      // Step 4: Execute retry stages
      logger.debug(`Retrying ${processingResult.toRetry.length} parallel stages (${retryCount}/${this.maxRetries})`, {
        stageIds: processingResult.toRetry.map((r) => r.stageId),
      });

      // Complete succeeded stages
      for (const stageId of processingResult.completed) {
        this.callbacks.onStageCompleted(stageId);
      }

      // Retry failed stages
      currentResults = await this.executeRetryStages(
        processingResult.toRetry,
        stagesMap,
        interpolatePrompt
      );
    }
  }

  /**
   * Handle failed stage executions
   */
  private async handleFailedResults(
    results: StageResult[],
    failed: StageResult[],
    batchIndex: number
  ): Promise<never> {
    // Record succeeded stages
    const succeeded = results.filter((r) => r.success);
    for (const s of succeeded) {
      this.callbacks.onStageCompleted(s.stageId);
    }

    // Build error message and throw
    const firstFailed = failed[0];
    const errorMsg = `Parallel stages failed: ${failed.map((f) => `${f.stageId}: ${f.error}`).join(', ')}`;
    this.callbacks.onBuildFailedState(errorMsg, batchIndex, firstFailed.stageId);
    throw new Error(errorMsg);
  }

  /**
   * Process orchestrator decisions for all results
   */
  private async processOrchestratorDecisions(
    results: StageResult[],
    executionPlan: StageConfig[][],
    batchIndex: number,
    cwd: string
  ): Promise<{
    toRetry: Array<{ stageId: string; output: string }>;
    completed: string[];
    action: 'proceed' | 'awaiting';
    awaitingState?: AwaitingState;
  }> {
    const toRetry: Array<{ stageId: string; output: string }> = [];
    const completed: string[] = [];

    for (const result of results) {
      const handler = new ParallelResultHandler(
        this.orchestrator,
        this.sharedContext,
        result.stageId,
        executionPlan,
        batchIndex,
        cwd
      );

      const decision = await handler.handle(result);

      if (decision.action === 'retry') {
        toRetry.push({ stageId: result.stageId, output: result.output || '' });
      } else if (decision.action === 'awaiting') {
        return {
          toRetry,
          completed,
          action: 'awaiting',
          awaitingState: decision.awaitingState,
        };
      } else {
        // proceed
        completed.push(result.stageId);
      }
    }

    return { toRetry, completed, action: 'proceed' };
  }

  /**
   * Handle awaiting result - complete other stages
   */
  private async handleAwaitingResult(
    results: StageResult[],
    processingResult: {
      toRetry: Array<{ stageId: string; output: string }>;
      completed: string[];
      action: 'proceed' | 'awaiting';
      awaitingState?: AwaitingState;
    },
    executionPlan: StageConfig[][],
    batchIndex: number,
    cwd: string
  ): Promise<'awaiting'> {
    // Complete non-awaiting stages
    for (const result of results) {
      const decision = await this.orchestrator.evaluate(
        result.stageId,
        result.output || '',
        this.sharedContext
      );
      if (decision.action === 'proceed' || decision.action === 'skip_next') {
        this.callbacks.onStageCompleted(result.stageId);
      }
    }

    // Set awaiting state
    if (processingResult.awaitingState) {
      this.callbacks.onAwaitingState(processingResult.awaitingState);
    }

    return 'awaiting';
  }

  /**
   * Handle retry limit exceeded
   */
  private async handleRetryLimitExceeded(
    processingResult: {
      toRetry: Array<{ stageId: string; output: string }>;
      completed: string[];
    },
    batchIndex: number,
    retryCount: number
  ): Promise<never> {
    // Complete succeeded stages
    for (const stageId of processingResult.completed) {
      this.callbacks.onStageCompleted(stageId);
    }

    // Build error message
    const firstRetry = processingResult.toRetry[0];
    const errorMsg = `Parallel stage ${firstRetry.stageId} failed after ${this.maxRetries} retries`;
    this.callbacks.onBuildFailedState(errorMsg, batchIndex, firstRetry.stageId);
    throw new Error(errorMsg);
  }

  /**
   * Execute retry stages
   */
  private async executeRetryStages(
    toRetry: Array<{ stageId: string; output: string }>,
    stagesMap: Map<string, StageConfig>,
    interpolatePrompt: (prompt: string) => string
  ): Promise<StageResult[]> {
    const retryStages = toRetry.map((r) => {
      const stage = stagesMap.get(r.stageId);
      if (!stage) {
        throw new Error(`Stage config not found for retry: ${r.stageId}`);
      }
      return {
        stageId: stage.id,
        provider: stage.provider,
        prompt: interpolatePrompt(stage.prompt),
        role: stage.role,
        skills: stage.skills,
      };
    });

    const retryResults = await this.terminalGroup.executeStagesParallel(retryStages);

    // Check for execution failures
    const retryFailed = retryResults.filter((r) => !r.success);
    if (retryFailed.length > 0) {
      const firstFailed = retryFailed[0];
      const errorMsg = `Parallel stage retry failed: ${retryFailed.map((f) => `${f.stageId}: ${f.error}`).join(', ')}`;
      throw new Error(errorMsg);
    }

    return retryResults;
  }
}

/**
 * Create parallel stage processor
 */
export function createParallelStageProcessor(
  orchestrator: StageOrchestrator,
  sharedContext: SharedContext,
  terminalGroup: TerminalGroup,
  callbacks: ParallelProcessorCallbacks,
  maxRetries?: number
): ParallelStageProcessor {
  return new ParallelStageProcessor(orchestrator, sharedContext, terminalGroup, callbacks, maxRetries);
}
