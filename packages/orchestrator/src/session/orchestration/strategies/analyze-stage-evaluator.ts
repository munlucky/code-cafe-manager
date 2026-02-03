/**
 * Analyze/Plan Stage Evaluator Strategy
 *
 * analyze 또는 plan 스테이지에서:
 * - 매우 큰 출력(10KB+) + 완료 지표 → proceed (질문 무시)
 * - 분석 과정에서 질문이 자연스럽게 포함될 수 있음을 고려
 */

import { StageEvaluator, EvaluationContext, EvaluationResult } from './stage-evaluator';
import { hasCompletionIndicators } from './stage-evaluator';
import { OUTPUT_THRESHOLDS } from '../../../constants/thresholds';

/**
 * Analyze/Plan 스테이지 전용 평가자
 *
 * 이 스테이지들은 분석 과정에서 "이 파일을 수정해야 하나?" 같은
 * 질문이 자연스럽게 포함될 수 있으므로, 질문 수가 많더라도
 * 충분한 출력과 완료 지표가 있으면 완료로 판단합니다.
 */
export class AnalyzeStageEvaluator implements StageEvaluator {
  isApplicable(context: EvaluationContext): boolean {
    return (
      context.stageId === 'analyze' ||
      context.stageId === 'plan' ||
      context.stageId.includes('analyze') ||
      context.stageId.includes('plan')
    );
  }

  evaluate(context: EvaluationContext): EvaluationResult | null {
    if (!this.isApplicable(context)) {
      return null;
    }

    const { outputLength, questionCount } = context;
    const hasVerySubstantialOutput = outputLength > OUTPUT_THRESHOLDS.VERY_SUBSTANTIAL;
    const hasCompletion = hasCompletionIndicators(context.output);

    // 10KB+ 출력 + 완료 지표 → proceed (질문 무시)
    if (hasVerySubstantialOutput && hasCompletion) {
      return {
        action: 'proceed',
        confidence: 0.9,
        reason: `Inferred completion from substantial ${context.stageId} output (${outputLength} chars) with completion indicators (ignoring ${questionCount} questions - part of analysis)`,
      };
    }

    // 그 외에는 다음 evaluator에게 위임
    return null;
  }
}
