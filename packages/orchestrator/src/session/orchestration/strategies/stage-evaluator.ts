/**
 * Stage Evaluator Strategy Pattern
 *
 * Stage 완료 후 다음 행동을 결정하는 Strategy 패턴 구현
 */

import { OUTPUT_THRESHOLDS } from '../../../constants/thresholds';

/**
 * 평가 컨텍스트
 */
export interface EvaluationContext {
  stageId: string;
  output: string;
  outputLength: number;
  hasSignalsBlock: boolean;
  uncertainties?: string[];
  questionCount: number;
  questionDensity: number;
}

/**
 * 평가 결과
 */
export interface EvaluationResult {
  action: 'proceed' | 'await_user' | null;
  confidence?: number;
  reason?: string;
}

/**
 * Stage Evaluator Strategy 인터페이스
 */
export interface StageEvaluator {
  /**
   * 평가 수행 (적용 가능하지 않으면 null 반환)
   */
  evaluate(context: EvaluationContext): EvaluationResult | null;

  /**
   * 적용 가능 여부 확인
   */
  isApplicable(context: EvaluationContext): boolean;
}

/**
 * 기본 헬퍼 함수
 */

/**
 * 작업 완료 지표 패턴
 */
export const COMPLETION_INDICATORS = [
  /(?:created|modified|updated|wrote|generated)\s+(?:file|files)/i,
  /(?:analysis|plan|implementation|review)\s+(?:complete|completed|done)/i,
  /```(?:yaml|json|markdown)/i,
  /^##?\s+/m,
  /complexity:\s*(?:simple|medium|complex)/i,
  /taskType:\s*(?:feature|modification|bugfix|refactor)/i,
];

/**
 * 불확실성 지표 패턴
 */
export const UNCERTAINTY_INDICATORS = [
  /\?\s*$/gm,
  /확인.*필요/g,
  /명확하지 않/g,
  /clarification needed/gi,
  /please confirm/gi,
  /not sure/gi,
  /ambiguous/gi,
];

/**
 * 작업 완료 지표 확인
 */
export function hasCompletionIndicators(output: string): boolean {
  return COMPLETION_INDICATORS.some(pattern => pattern.test(output));
}

/**
 * 불확실성 지표 확인
 */
export function hasUncertaintyIndicators(output: string): boolean {
  return UNCERTAINTY_INDICATORS.some(pattern => pattern.test(output));
}

/**
 * 질문 밀도 계산
 */
export function calculateQuestionDensity(questionCount: number, outputLength: number): number {
  return questionCount / (outputLength / OUTPUT_THRESHOLDS.QUESTION_DENSITY);
}

/**
 * 과도한 질문 여부 확인
 */
export function hasExcessiveQuestions(
  questionCount: number,
  questionDensity: number
): boolean {
  return questionCount >= 5 && questionDensity > 2;
}
