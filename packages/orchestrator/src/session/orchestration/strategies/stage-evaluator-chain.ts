/**
 * Stage Evaluator Chain
 *
 * 여러 StageEvaluator를 순차적으로 실행하여 첫 번째 유효한 결과를 반환
 */

import { createLogger } from '@codecafe/core';
import { StageEvaluator, EvaluationContext, EvaluationResult } from './stage-evaluator';
import { AnalyzeStageEvaluator } from './analyze-stage-evaluator';
import { DefaultStageEvaluator } from './default-stage-evaluator';

const logger = createLogger({ context: 'StageEvaluatorChain' });

/**
 * Stage Evaluator Chain
 *
 * 여러 evaluator를 순차적으로 실행하여 첫 번째 null이 아닌 결과를 반환
 */
export class StageEvaluatorChain implements StageEvaluator {
  private readonly evaluators: StageEvaluator[];

  constructor(evaluators: StageEvaluator[]) {
    this.evaluators = evaluators;
  }

  isApplicable(context: EvaluationContext): boolean {
    // 체인은 항상 적용 가능
    return true;
  }

  evaluate(context: EvaluationContext): EvaluationResult {
    for (const evaluator of this.evaluators) {
      if (!evaluator.isApplicable(context)) {
        continue;
      }

      const result = evaluator.evaluate(context);
      if (result !== null && result.action !== null) {
        logger.debug(`Evaluator ${evaluator.constructor.name} returned: ${result.action}`);
        return result;
      }
    }

    // 모든 evaluator가 null을 반환하면 기본값
    logger.debug(`No evaluator returned a result, defaulting to await_user`);
    return {
      action: 'await_user',
      reason: 'No evaluator could determine the next action',
    };
  }

  /**
   * evaluator 추가
   */
  add(evaluator: StageEvaluator): void {
    this.evaluators.push(evaluator);
  }

  /**
   * evaluator 제거
   */
  remove(evaluatorClass: new (...args: unknown[]) => StageEvaluator): void {
    const index = this.evaluators.findIndex(e => e instanceof evaluatorClass);
    if (index >= 0) {
      this.evaluators.splice(index, 1);
    }
  }
}

/**
 * 기본 evaluator 체인 생성
 */
export function createDefaultEvaluatorChain(): StageEvaluatorChain {
  return new StageEvaluatorChain([
    new AnalyzeStageEvaluator(),
    new DefaultStageEvaluator(),
  ]);
}
