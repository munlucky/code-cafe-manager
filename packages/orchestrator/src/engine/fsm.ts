import { Workflow, StageType, StageConfig } from '../types';
import { JSONPath } from 'jsonpath-plus';

/**
 * FSM Engine - Finite State Machine for stage transitions
 */
export class FSMEngine {
  private workflow: Workflow;
  private currentStage: StageType;
  private currentIter: number;
  private stageHistory: Array<{ stage: StageType; iter: number }>;
  // Track execution count for each stage (for min_iterations check)
  private stageExecutionCounts: Map<StageType, number>;

  constructor(workflow: Workflow, initialStage?: StageType) {
    this.workflow = workflow;
    this.currentStage = initialStage || workflow.stages[0];
    this.currentIter = 0;
    this.stageHistory = [];
    this.stageExecutionCounts = new Map();
    // Initialize all stages with 0 count
    for (const stage of workflow.stages) {
      this.stageExecutionCounts.set(stage, 0);
    }
  }

  /**
   * Get stage config for current stage
   */
  private getStageConfig(stage: StageType): StageConfig | undefined {
    return this.workflow.stageConfigs?.[stage];
  }

  /**
   * Get min iterations for a stage
   */
  private getMinIterations(stage: StageType): number {
    const config = this.getStageConfig(stage);
    return config?.min_iterations ?? 0;
  }

  /**
   * Get execution count for a specific stage
   */
  getStageExecutionCount(stage: StageType): number {
    return this.stageExecutionCounts.get(stage) ?? 0;
  }

  /**
   * Increment execution count for a stage
   */
  incrementStageCount(stage: StageType): void {
    const current = this.stageExecutionCounts.get(stage) ?? 0;
    this.stageExecutionCounts.set(stage, current + 1);
  }

  /**
   * Get current stage
   */
  getCurrentStage(): StageType {
    return this.currentStage;
  }

  /**
   * Get current iteration count
   */
  getCurrentIter(): number {
    return this.currentIter;
  }

  /**
   * Get stage history
   */
  getHistory(): Array<{ stage: StageType; iter: number }> {
    return [...this.stageHistory];
  }

  /**
   * Transition to next stage in sequence
   */
  transitionToNext(): StageType | null {
    const currentIndex = this.workflow.stages.indexOf(this.currentStage);

    if (currentIndex === -1) {
      throw new Error(`Invalid current stage: ${this.currentStage}`);
    }

    // If at the end of stages, return to check stage or null
    if (currentIndex === this.workflow.stages.length - 1) {
      return null; // End of workflow sequence
    }

    const nextStage = this.workflow.stages[currentIndex + 1];
    this.transitionTo(nextStage);
    return nextStage;
  }

  /**
   * Transition to a specific stage
   */
  transitionTo(stage: StageType): void {
    if (!this.workflow.stages.includes(stage)) {
      throw new Error(`Invalid stage: ${stage}`);
    }

    const previousStage = this.currentStage;

    // Record history
    this.stageHistory.push({
      stage: previousStage,
      iter: this.currentIter,
    });

    this.currentStage = stage;

    // Increment iteration if we're looping back
    const isLoopingBack = this.isLoopingBack(previousStage, stage);
    if (isLoopingBack) {
      this.currentIter++;
    }
  }

  /**
   * Check if transitioning to this stage is a loop back
   */
  private isLoopingBack(previousStage: StageType, nextStage: StageType): boolean {
    // If the next stage is earlier or same as the previous stage, it's a loop back
    const currentIndex = this.workflow.stages.indexOf(previousStage);
    const targetIndex = this.workflow.stages.indexOf(nextStage);

    return targetIndex <= currentIndex;
  }

  /**
   * Evaluate check result and determine next action
   */
  evaluateCheckResult(checkResult: any): {
    done: boolean;
    nextStage: StageType | null;
    reason: string;
  } {
    // Check if done
    const stopCondition = this.workflow.loop.stop_when;
    let done = false;

    try {
      // Evaluate stop condition using JSONPath
      const result = JSONPath({ path: stopCondition, json: checkResult });
      done = result[0] === true;
    } catch (error) {
      // Fallback to simple done field check
      done = checkResult.done === true;
    }

    // Check if current stage has min_iterations requirement (workflow iteration count)
    const minIters = this.getMinIterations(this.currentStage);

    if (done) {
      // Done but check min_iterations (must complete at least N workflow iterations)
      if (minIters > 0 && this.currentIter < minIters) {
        // Min workflow iterations not met - restart from beginning
        return {
          done: false,
          nextStage: this.workflow.stages[0], // Restart from first stage
          reason: `Workflow requires minimum ${minIters} iterations (current: ${this.currentIter}), restarting`,
        };
      }

      return {
        done: true,
        nextStage: null,
        reason: 'Check completed successfully',
      };
    }

    // Check max iterations
    if (!this.canContinue()) {
      return {
        done: true,
        nextStage: null,
        reason: `Maximum iterations (${this.workflow.loop.max_iters}) reached`,
      };
    }

    // Not done - restart workflow from beginning
    // This is the moonshot-style loop behavior: when check/review is not done,
    // restart the entire workflow from the first stage (e.g., analyze -> plan -> code -> review)
    let nextStage: StageType;

    if (checkResult.recommended_next_stage) {
      // Use recommended stage from check result
      nextStage = checkResult.recommended_next_stage as StageType;

      if (!this.workflow.stages.includes(nextStage)) {
        console.warn(
          `Invalid recommended_next_stage: ${checkResult.recommended_next_stage}, restarting from beginning`
        );
        nextStage = this.workflow.stages[0]; // Restart from first stage
      }
    } else {
      // Default: restart from beginning (moonshot-style loop)
      nextStage = this.workflow.stages[0];
    }

    return {
      done: false,
      nextStage,
      reason: 'Check requires more work - restarting workflow from beginning',
    };
  }

  /**
   * Check if workflow can continue (within max_iters)
   */
  canContinue(): boolean {
    return this.currentIter < this.workflow.loop.max_iters;
  }

  /**
   * Get remaining iterations
   */
  getRemainingIters(): number {
    return Math.max(0, this.workflow.loop.max_iters - this.currentIter);
  }

  /**
   * Reset FSM to initial state
   */
  reset(): void {
    this.currentStage = this.workflow.stages[0];
    this.currentIter = 0;
    this.stageHistory = [];
    this.stageExecutionCounts.clear();
    for (const stage of this.workflow.stages) {
      this.stageExecutionCounts.set(stage, 0);
    }
  }

  /**
   * Get workflow definition
   */
  getWorkflow(): Workflow {
    return this.workflow;
  }

  /**
   * Get FSM state as JSON
   */
  getState(): {
    currentStage: StageType;
    currentIter: number;
    maxIters: number;
    canContinue: boolean;
    history: Array<{ stage: StageType; iter: number }>;
    stageExecutionCounts: Record<string, number>;
  } {
    const counts: Record<string, number> = {};
    for (const [stage, count] of this.stageExecutionCounts.entries()) {
      counts[stage] = count;
    }
    return {
      currentStage: this.currentStage,
      currentIter: this.currentIter,
      maxIters: this.workflow.loop.max_iters,
      canContinue: this.canContinue(),
      history: this.getHistory(),
      stageExecutionCounts: counts,
    };
  }

  /**
   * Restore FSM state from JSON
   */
  restoreState(state: {
    currentStage: StageType;
    currentIter: number;
    history: Array<{ stage: StageType; iter: number }>;
    stageExecutionCounts?: Record<string, number>;
  }): void {
    this.currentStage = state.currentStage;
    this.currentIter = state.currentIter;
    this.stageHistory = [...state.history];
    // Restore stage execution counts if provided
    if (state.stageExecutionCounts) {
      for (const [stage, count] of Object.entries(state.stageExecutionCounts)) {
        this.stageExecutionCounts.set(stage as StageType, count);
      }
    }
  }
}
