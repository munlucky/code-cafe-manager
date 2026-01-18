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

    // 3. 규칙으로 결정 불가 + AI 폴백 활성화 시
    if (decision.action === 'proceed' && !parseResult.success && this.config.enableAIFallback) {
      // 출력에 불확실성 징후가 있는지 추가 확인
      if (this.hasUncertaintyIndicators(output)) {
        return this.evaluateWithAI(stageId, output, context);
      }
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
        userMessage: `다음 사항에 대한 확인이 필요합니다:\n${signals.uncertainties.map((u, i) => `${i + 1}. ${u}`).join('\n')}`,
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
    // TODO: 실제 AI 호출 구현
    // 현재는 휴리스틱 기반 판단
    console.log(`[StageOrchestrator] AI evaluation for stage ${stageId}`);

    const questionCount = (output.match(/\?/g) || []).length;
    const hasErrorKeywords = /error|fail|exception|cannot|unable/i.test(output);

    if (questionCount >= 5 || hasErrorKeywords) {
      return {
        action: 'await_user',
        reason: 'AI analysis detected uncertainty or errors',
        userMessage: 'The stage output contains questions or errors. Please review.',
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
   * 불확실성 징후 감지
   */
  private hasUncertaintyIndicators(output: string): boolean {
    const indicators = [
      /\?\s*$/gm,                    // 줄 끝의 물음표
      /확인.*필요/g,                  // "확인이 필요"
      /명확하지 않/g,                 // "명확하지 않"
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
