/**
 * ExecutionPlanner - Stage 실행 계획 수립 및 프롬프트 처리
 */

import { createLogger } from '@codecafe/core';
import type { SharedContext } from '../shared-context';

const logger = createLogger({ context: 'ExecutionPlanner' });

export interface StageConfig {
  id: string;
  name: string;
  provider: 'claude-code' | 'codex' | 'gemini' | 'grok';
  prompt: string;
  role?: string;
  mode?: 'sequential' | 'parallel';
  dependsOn?: string[];
  skills?: string[];
}

/**
 * Stage 실행 계획 및 프롬프트 처리를 담당하는 클래스
 */
export class ExecutionPlanner {
  constructor(private readonly sharedContext: SharedContext) {}

  /**
   * Stage 실행 계획 생성 (의존성 기반)
   *
   * 같은 배치에 있는 Stage들은 병렬 실행 가능
   * 순차 모드에서는 원본 배열 순서를 유지
   */
  buildPlan(stages: StageConfig[]): StageConfig[][] {
    logger.debug('[ExecutionPlanner.buildPlan] Input stages:', {
      count: stages.length,
      stages: stages.map(s => ({
        id: s.id,
        name: s.name,
        provider: s.provider,
        mode: s.mode,
        dependsOn: s.dependsOn,
        skills: s.skills,
      })),
    });

    const plan: StageConfig[][] = [];
    const executed = new Set<string>();
    const remaining = [...stages];

    while (remaining.length > 0) {
      const batch: StageConfig[] = [];
      const toRemove: number[] = [];

      // 정순 순회하여 원본 배열 순서 유지
      for (let i = 0; i < remaining.length; i++) {
        const stage = remaining[i];

        // 의존성 확인
        const dependencies = stage.dependsOn || [];
        const allDependenciesMet = dependencies.every((dep) => executed.has(dep));

        if (allDependenciesMet) {
          // 같은 Provider이고 순차 모드면 따로 배치
          if (stage.mode !== 'parallel') {
            const sameProviderInBatch = batch.some((s) => s.provider === stage.provider);
            if (sameProviderInBatch) {
              continue; // 다음 배치로 미룸
            }
          }

          batch.push(stage);
          toRemove.push(i);
        }
      }

      // 역순으로 제거 (인덱스 변경 방지)
      for (let i = toRemove.length - 1; i >= 0; i--) {
        remaining.splice(toRemove[i], 1);
      }

      if (batch.length === 0 && remaining.length > 0) {
        // 순환 의존성 또는 해결 불가능한 의존성
        throw new Error(
          `Cannot resolve stage dependencies: ${remaining.map((s) => s.id).join(', ')}`
        );
      }

      if (batch.length > 0) {
        plan.push(batch);
        batch.forEach((s) => executed.add(s.id));
      }
    }

    logger.debug('[ExecutionPlanner.buildPlan] Execution plan:', {
      batches: plan.length,
      plan: plan.map((batch, idx) => ({
        batch: idx,
        stages: batch.map(s => ({ id: s.id, name: s.name, skills: s.skills })),
      })),
    });

    return plan;
  }

  /**
   * Stage에서 사용하는 Provider 목록 추출
   */
  extractProviders<T extends { provider: string }>(stages: T[]): string[] {
    const providers = new Set<string>();
    for (const stage of stages) {
      providers.add(stage.provider);
    }
    return Array.from(providers);
  }

  /**
   * 프롬프트 변수 치환 및 이전 시도 컨텍스트 주입
   */
  interpolatePrompt(prompt: string): string {
    const vars = this.sharedContext.getVars();
    let result = prompt;

    // 변수 치환
    for (const [key, value] of Object.entries(vars)) {
      const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      result = result.replace(pattern, String(value));
    }

    // 이전 시도 컨텍스트 주입 (재시도 시)
    const previousAttemptContext = this.sharedContext.buildPreviousAttemptContext();
    if (previousAttemptContext) {
      result = previousAttemptContext + '\n' + result;
    }

    return result;
  }
}
