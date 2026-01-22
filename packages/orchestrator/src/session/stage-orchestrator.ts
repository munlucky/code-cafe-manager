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
   * AI 기반 판단 (신호 파싱 실패 시 폴백)
   *
   * signals 블록이 없더라도 출력 내용을 분석하여 작업 완료 여부를 추론
   * 실질적인 작업이 수행되었다면 proceed, 그렇지 않으면 await_user
   */
  private async evaluateWithAI(
    stageId: string,
    output: string,
    context?: SharedContext
  ): Promise<OrchestratorDecision> {
    console.log(`[StageOrchestrator] AI evaluation for stage ${stageId} (no signals block found)`);

    // 1. 출력 길이 확인 - 실질적인 출력이 있는가?
    const outputLength = output.length;
    const hasSubstantialOutput = outputLength > 500;
    const hasVerySubstantialOutput = outputLength > 10000; // 10KB 이상이면 매우 충분한 출력

    // 2. 작업 완료 지표 확인
    const completionIndicators = [
      /(?:created|modified|updated|wrote|generated)\s+(?:file|files)/i,  // File operations
      /(?:analysis|plan|implementation|review)\s+(?:complete|completed|done)/i,  // Task completion
      /```(?:yaml|json|markdown)/i,  // Structured output blocks
      /^##?\s+/m,  // Markdown headers (structured output)
      /complexity:\s*(?:simple|medium|complex)/i,  // Complexity assessment
      /taskType:\s*(?:feature|modification|bugfix|refactor)/i,  // Task classification
    ];

    const hasCompletionIndicators = completionIndicators.some(pattern => pattern.test(output));

    // 3. 불확실성 지표 확인
    const hasUncertainty = this.hasUncertaintyIndicators(output);
    const questionCount = (output.match(/\?/g) || []).length;
    // 출력 대비 질문 비율 계산 (긴 출력에서는 질문이 자연스럽게 많을 수 있음)
    const questionDensity = questionCount / (outputLength / 1000); // 1KB당 질문 수
    const hasExcessiveQuestions = questionCount >= 5 && questionDensity > 2; // 1KB당 2개 이상의 질문이면 과다

    // 4. 스테이지별 특화 처리
    const isAnalyzeStage = stageId === 'analyze' || stageId.includes('analyze');
    const isPlanStage = stageId === 'plan' || stageId.includes('plan');

    // analyze/plan 스테이지에서는 질문이 많아도 출력이 충분하면 완료로 판단
    // 분석 과정에서 "이 파일을 수정해야 하나?" 같은 질문이 자연스럽게 포함됨
    if ((isAnalyzeStage || isPlanStage) && hasVerySubstantialOutput && hasCompletionIndicators) {
      console.log(`[StageOrchestrator] Inferring completion for ${stageId}: very substantial output (${outputLength} chars) with completion indicators (ignoring ${questionCount} questions)`);
      return {
        action: 'proceed',
        reason: `Inferred completion from substantial ${stageId} output (questions are part of analysis)`,
        usedAI: true,
      };
    }

    // 5. 일반 판단 로직
    if (hasSubstantialOutput && hasCompletionIndicators && !hasExcessiveQuestions) {
      // 실질적인 작업이 수행된 것으로 보임 - proceed
      console.log(`[StageOrchestrator] Inferring completion: substantial output (${outputLength} chars) with completion indicators`);
      return {
        action: 'proceed',
        reason: 'Inferred completion from output content (no signals block but work appears done)',
        usedAI: true,
      };
    }

    if (hasUncertainty || hasExcessiveQuestions) {
      // 명확한 불확실성이 있음 - await_user
      console.log(`[StageOrchestrator] Inferring uncertainty: ${questionCount} questions (density: ${questionDensity.toFixed(2)}/KB), uncertainty indicators: ${hasUncertainty}`);
      return {
        action: 'await_user',
        reason: 'No signals block found and output contains uncertainty indicators',
        userMessage: `Stage ${stageId} did not produce a signals block. The stage may need clarification.`,
        usedAI: true,
      };
    }

    // 6. 기본: signals 블록이 없고 판단하기 어려우면 await_user
    console.log(`[StageOrchestrator] Cannot infer completion: insufficient indicators (output: ${outputLength} chars)`);
    return {
      action: 'await_user',
      reason: 'No signals block found and cannot infer completion',
      userMessage: `Stage ${stageId} did not produce a signals block. Please review the output.`,
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
