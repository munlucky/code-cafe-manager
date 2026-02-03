/**
 * Stage Orchestrator - Stage 간 전이 결정
 *
 * 각 Stage 완료 후 시그널을 분석하여 다음 행동을 결정
 * - 규칙 기반 판단 (빠름, 비용 없음)
 * - AI 판단 폴백 (복잡한 경우)
 */

import { EventEmitter } from 'events';
import { createLogger } from '@codecafe/core';
import {
  StageSignals,
  OrchestratorDecision,
  NextAction,
  DEFAULT_SIGNALS,
} from './stage-signals';
import { SignalParser, ParseResult } from './signal-parser';
import { SharedContext } from './shared-context';
import { OUTPUT_THRESHOLDS } from '../constants/thresholds';
import { RetryPolicyManager, createDefaultRetryPolicy } from './retry';
import { createDefaultEvaluatorChain, type EvaluationContext } from './orchestration';

const logger = createLogger({ context: 'StageOrchestrator' });

/**
 * 오케스트레이터 설정
 */
export interface OrchestratorConfig {
  /** AI 폴백 활성화 여부 */
  enableAIFallback?: boolean;

  /** 불확실성 임계값 (이 이상이면 사용자 입력 요청) */
  uncertaintyThreshold?: number;

  /** 재시도 정책 관리자 (기본값: ExponentialBackoffPolicy, maxRetries=3) */
  retryPolicyManager?: RetryPolicyManager;

  /** 단순 작업 시 스킵 가능한 stage 목록 */
  skippableOnSimple?: string[];
}

const DEFAULT_CONFIG: Required<Omit<OrchestratorConfig, 'retryPolicyManager'>> = {
  enableAIFallback: true,
  uncertaintyThreshold: 3,
  skippableOnSimple: ['review'],
};

/**
 * Stage Orchestrator
 */
export class StageOrchestrator extends EventEmitter {
  private readonly config: Omit<Required<OrchestratorConfig>, 'retryPolicyManager'>;
  private readonly signalParser: SignalParser;
  private readonly retryPolicyManager: RetryPolicyManager;
  private readonly evaluatorChain = createDefaultEvaluatorChain();

  constructor(config?: OrchestratorConfig) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.signalParser = new SignalParser();
    this.retryPolicyManager = config?.retryPolicyManager ?? new RetryPolicyManager(createDefaultRetryPolicy());
  }

  /**
   * Stage 출력을 분석하여 다음 행동 결정
   */
  async evaluate(
    stageId: string,
    output: string,
    context?: SharedContext
  ): Promise<OrchestratorDecision> {
    // 1. 시그널 파싱
    const parseResult = this.signalParser.parse(output);

    logger.debug(` Stage ${stageId} signals:`, {
      success: parseResult.success,
      signals: parseResult.signals,
      error: parseResult.error,
    });

    // 2. 규칙 기반 판단
    const decision = this.evaluateWithRules(stageId, parseResult, context);

    // 3. 신호 파싱 실패 시 무조건 AI 폴백 호출
    //    (이전에는 hasUncertaintyIndicators 조건이 있었으나,
    //     Claude가 signals 블록 없이 질문만 할 때 proceed로 넘어가는 버그가 있었음)
    if (decision.action === 'proceed' && !parseResult.success && this.config.enableAIFallback) {
      return this.evaluateWithAI(stageId, output, context);
    }

    this.emit('decision', { stageId, decision });
    return decision;
  }

  /**
   * 규칙 기반 판단
   */
  private evaluateWithRules(
    stageId: string,
    parseResult: ParseResult,
    context?: SharedContext
  ): OrchestratorDecision {
    const { signals } = parseResult;

    // Rule 1: 명시적 nextAction 존중
    if (parseResult.success && signals.nextAction !== 'proceed') {
      return this.buildDecision(signals.nextAction, signals, stageId);
    }

    // Rule 2: needsUserInput이 true면 대기
    if (signals.needsUserInput) {
      return {
        action: 'await_user',
        reason: 'Stage explicitly requested user input',
        questions: signals.uncertainties,
        userMessage: signals.uncertainties?.join('\n') || 'Please provide additional information',
      };
    }

    // Rule 3: 불확실성이 임계값 초과
    if (signals.uncertainties && signals.uncertainties.length >= this.config.uncertaintyThreshold) {
      return {
        action: 'await_user',
        reason: `Too many uncertainties (${signals.uncertainties.length} >= ${this.config.uncertaintyThreshold})`,
        questions: signals.uncertainties,
        userMessage: `The following items require confirmation:\n${signals.uncertainties.map((u, i) => `${i + 1}. ${u}`).join('\n')}`,
      };
    }

    // Rule 4: 단순 작업이면 특정 stage 스킵 가능
    if (signals.complexity === 'simple' && this.config.skippableOnSimple.length > 0) {
      return {
        action: 'skip_next',
        reason: 'Simple task - skipping optional stages',
        skipStages: this.config.skippableOnSimple,
      };
    }

    // Rule 5: 재시도 요청
    if (signals.nextAction === 'retry') {
      const maxRetries = signals.maxRetries ?? this.retryPolicyManager.getMaxRetries();

      // Check if should retry using policy
      const shouldRetry = this.retryPolicyManager.shouldRetry(stageId, new Error(signals.retryReason || 'Stage requested retry'));

      if (shouldRetry) {
        this.retryPolicyManager.increment(stageId);
        return {
          action: 'retry',
          reason: signals.retryReason || 'Stage requested retry',
        };
      } else {
        // 재시도 한도 초과 - 사용자 입력 요청
        return {
          action: 'await_user',
          reason: `Max retries exceeded (${maxRetries})`,
          userMessage: `Stage ${stageId} failed after ${maxRetries} retries. ${signals.retryReason || ''}`,
        };
      }
    }

    // Default: 계속 진행
    return {
      action: 'proceed',
      reason: parseResult.success ? 'Signals indicate proceed' : 'No blocking signals found',
    };
  }

  /**
   * AI 기반 판단 (신호 파싱 실패 시 폴백)
   *
   * StageEvaluator Strategy Chain을 사용하여 판단
   */
  private async evaluateWithAI(
    stageId: string,
    output: string,
    context?: SharedContext
  ): Promise<OrchestratorDecision> {
    logger.debug(` AI evaluation for stage ${stageId} (no signals block found)`);

    // 1. 출력 길이 확인
    const outputLength = output.length;
    const questionCount = (output.match(/\?/g) || []).length;
    const questionDensity = questionCount / (outputLength / OUTPUT_THRESHOLDS.QUESTION_DENSITY);

    // 2. EvaluationContext 구성
    const evalContext: EvaluationContext = {
      stageId,
      output,
      outputLength,
      hasSignalsBlock: false,
      questionCount,
      questionDensity,
    };

    // 3. Strategy Chain 실행
    const result = this.evaluatorChain.evaluate(evalContext);

    logger.debug(` Evaluator chain result: ${result.action} (reason: ${result.reason || 'N/A'})`);

    // 4. OrchestratorDecision으로 변환
    return {
      action: result.action === 'await_user' ? 'await_user' : 'proceed',
      reason: result.reason || 'No signals block found - evaluated with strategy chain',
      usedAI: true,
    };
  }

  /**
   * 결정 객체 생성 헬퍼
   */
  private buildDecision(
    action: NextAction,
    signals: StageSignals,
    stageId: string
  ): OrchestratorDecision {
    switch (action) {
      case 'await_user':
        return {
          action: 'await_user',
          reason: 'Stage requested user input',
          questions: signals.uncertainties,
          userMessage: signals.uncertainties?.join('\n'),
        };

      case 'skip_next':
        return {
          action: 'skip_next',
          reason: 'Stage requested to skip next stages',
          skipStages: signals.skipStages || [],
        };

      case 'retry':
        return {
          action: 'retry',
          reason: signals.retryReason || 'Stage requested retry',
        };

      default:
        return {
          action: 'proceed',
          reason: 'Continue to next stage',
        };
    }
  }

  /**
   * 재시도 카운터 리셋
   */
  resetRetryCount(stageId?: string): void {
    if (stageId) {
      this.retryPolicyManager.reset(stageId);
    } else {
      this.retryPolicyManager.resetAll();
    }
  }

  /**
   * 설정 업데이트
   */
  updateConfig(config: Partial<OrchestratorConfig>): void {
    Object.assign(this.config, config);
  }
}

/**
 * 싱글톤 팩토리
 */
export function createOrchestrator(config?: OrchestratorConfig): StageOrchestrator {
  return new StageOrchestrator(config);
}
