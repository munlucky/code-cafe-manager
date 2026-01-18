/**
 * Stage Orchestrator - Stage 간 전이 결정
 *
 * 각 Stage 완료 후 시그널을 분석하여 다음 행동을 결정
 * - 규칙 기반 판단 (빠름, 비용 없음)
 * - AI 판단 폴백 (복잡한 경우)
 */

import { EventEmitter } from 'events';
import {
  StageSignals,
  OrchestratorDecision,
  NextAction,
  DEFAULT_SIGNALS,
} from './stage-signals';
import { SignalParser, ParseResult } from './signal-parser';
import { SharedContext } from './shared-context';

/**
 * 오케스트레이터 설정
 */
export interface OrchestratorConfig {
  /** AI 폴백 활성화 여부 */
  enableAIFallback?: boolean;

  /** 불확실성 임계값 (이 이상이면 사용자 입력 요청) */
  uncertaintyThreshold?: number;

  /** 최대 재시도 횟수 */
  maxRetries?: number;

  /** 단순 작업 시 스킵 가능한 stage 목록 */
  skippableOnSimple?: string[];
}

const DEFAULT_CONFIG: Required<OrchestratorConfig> = {
  enableAIFallback: true,
  uncertaintyThreshold: 3,
  maxRetries: 2,
  skippableOnSimple: ['review'],
};

/**
 * Stage Orchestrator
 */
export class StageOrchestrator extends EventEmitter {
  private readonly config: Required<OrchestratorConfig>;
  private readonly signalParser: SignalParser;
  private retryCount: Map<string, number> = new Map();

  constructor(config?: OrchestratorConfig) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.signalParser = new SignalParser();
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

    console.log(`[StageOrchestrator] Stage ${stageId} signals:`, {
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
      const currentRetries = this.retryCount.get(stageId) || 0;
      const maxRetries = signals.maxRetries || this.config.maxRetries;

      if (currentRetries < maxRetries) {
        this.retryCount.set(stageId, currentRetries + 1);
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
   * AI 기반 판단 (복잡한 경우 폴백)
   */
  private async evaluateWithAI(
    stageId: string,
    output: string,
    context?: SharedContext
  ): Promise<OrchestratorDecision> {
    console.log(`[StageOrchestrator] AI evaluation for stage ${stageId}`);

    const questionCount = (output.match(/\?/g) || []).length;
    const hasErrorKeywords = /error|fail|exception|cannot|unable/i.test(output);

    // 1. 작업 미수행 패턴 감지 (Claude가 질문만 하고 실제 작업을 안 한 경우)
    const nonProductivePatterns = [
      /무엇을.*도와/i,                          // 한글: "무엇을 도와드릴까요"
      /어떤.*작업/i,                            // 한글: "어떤 작업을"
      /what would you like/i,                  // 영어: "What would you like to work on"
      /how can i help/i,                       // 영어: "How can I help"
      /i'm ready to help/i,                    // 영어: "I'm ready to help"
      /please provide/i,                       // 영어: "Please provide more details"
      /could you clarify/i,                    // 영어: "Could you clarify"
      /사용자.*메시지.*없/i,                     // 한글: "사용자의 메시지가 없습니다"
    ];

    const isNonProductive = nonProductivePatterns.some(pattern => pattern.test(output));

    // 출력이 너무 짧으면 작업을 수행하지 않았을 가능성 높음
    const outputTooShort = output.trim().length < 200;

    // 2. 작업 미수행 판정
    if (isNonProductive || (outputTooShort && questionCount > 0)) {
      console.log(`[StageOrchestrator] Non-productive output detected for stage ${stageId}`, {
        isNonProductive,
        outputTooShort,
        questionCount,
        outputLength: output.length,
      });

      return {
        action: 'await_user',
        reason: 'Stage output indicates no actual work was performed',
        userMessage: `Stage ${stageId} did not produce expected output. The AI may need clearer instructions or the request may be ambiguous.`,
        usedAI: true,
      };
    }

    // 3. 에러 키워드 또는 질문 5개 이상
    if (questionCount >= 5 || hasErrorKeywords) {
      return {
        action: 'await_user',
        reason: 'AI analysis detected uncertainty or errors',
        userMessage: 'The stage output contains questions or errors. Please review.',
        usedAI: true,
      };
    }

    // 4. 불확실성 패턴 감지
    if (this.hasUncertaintyIndicators(output)) {
      return {
        action: 'await_user',
        reason: 'AI analysis detected uncertainty indicators',
        userMessage: 'The stage output contains uncertainty. Please review.',
        usedAI: true,
      };
    }

    return {
      action: 'proceed',
      reason: 'AI analysis found no blocking issues',
      usedAI: true,
    };
  }

  /**
   * Detect uncertainty indicators in output
   */
  private hasUncertaintyIndicators(output: string): boolean {
    const indicators = [
      /\?\s*$/gm,                    // Question mark at end of line
      /확인.*필요/g,                  // Korean: "confirmation needed"
      /명확하지 않/g,                 // Korean: "not clear"
      /clarification needed/gi,
      /please confirm/gi,
      /not sure/gi,
      /ambiguous/gi,
    ];

    for (const pattern of indicators) {
      if (pattern.test(output)) {
        return true;
      }
    }

    return false;
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
      this.retryCount.delete(stageId);
    } else {
      this.retryCount.clear();
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
