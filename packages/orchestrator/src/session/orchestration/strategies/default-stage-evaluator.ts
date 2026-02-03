/**
 * Default Stage Evaluator Strategy
 *
 * 일반적인 Stage 평가:
 * - 충분한 출력 + 완료 지표 + 과도한 질문 아님 → proceed
 * - 불확실성 지표 또는 과도한 질문 → await_user
 * - 그 외 → await_user (신호 없음)
 */

import { StageEvaluator, EvaluationContext, EvaluationResult } from './stage-evaluator';
import { hasCompletionIndicators, hasUncertaintyIndicators, hasExcessiveQuestions } from './stage-evaluator';

/**
 * 충분한 출력 임계값
 */
const SUBSTANTIAL_OUTPUT_THRESHOLD = 500;

/**
 * 기본 Stage 평가자
 */
export class DefaultStageEvaluator implements StageEvaluator {
  isApplicable(context: EvaluationContext): boolean {
    // 항상 적용 가능 (fallback)
    return true;
  }

  evaluate(context: EvaluationContext): EvaluationResult {
    const { outputLength, questionCount, questionDensity } = context;
    const hasSubstantialOutput = outputLength > SUBSTANTIAL_OUTPUT_THRESHOLD;
    const hasCompletion = hasCompletionIndicators(context.output);
    const hasUncertainty = hasUncertaintyIndicators(context.output);
    const excessiveQuestions = hasExcessiveQuestions(questionCount, questionDensity);

    // 실질적인 작업이 수행된 것으로 보임 → proceed
    if (hasSubstantialOutput && hasCompletion && !excessiveQuestions) {
      return {
        action: 'proceed',
        confidence: 0.8,
        reason: 'Inferred completion from output content (no signals block but work appears done)',
      };
    }

    // 불확실성 또는 과도한 질문 → await_user
    if (hasUncertainty || excessiveQuestions) {
      return {
        action: 'await_user',
        reason: 'No signals block found and output contains uncertainty indicators',
      };
    }

    // 기본: signals 블록이 없고 판단하기 어려움 → await_user
    return {
      action: 'await_user',
      reason: 'No signals block found and cannot infer completion',
    };
  }
}
