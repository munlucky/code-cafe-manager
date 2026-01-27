/**
 * Workflow Executor
 * High-level workflow executor with pause/resume/cancel support
 * Integrates with existing DAGExecutor, FSMEngine, RunStateManager
 */

import * as path from 'path';
import { EventEmitter } from 'events';
import { createLogger } from '@codecafe/core';

const logger = createLogger({ context: 'WorkflowExecutor' });
import { randomBytes } from 'crypto';
import { DAGExecutor } from '../engine/dag-executor';
import { FSMEngine } from '../engine/fsm';
import { EventLogger } from '../storage/event-logger';
import { RunStateManager } from '../storage/run-state';
import { ProviderExecutor } from '../provider/executor';
import { RoleManager } from '../role/role-manager';

/** Generate a unique ID using crypto */
function nanoid(): string {
  return randomBytes(8).toString('hex');
}
import {
  loadStageProfile,
  loadWorkflow,
} from '../schema/validator';
import {
  ExecutionContext,
  ExecutionMode,
  Node,
  ProviderConfig,
  ProviderConfigItem,
  ProviderResult,
  ProviderType,
  RunState,
  RunStatus,
  StageAssignment,
  StageConfig,
  StageResult,
  StageStatus,
  StageType,
  Workflow,
  WorkflowRun,
} from '../types';
import type { NodeContext } from '../engine/dag-executor';

/**
 * Run control options
 */
export interface RunControlOptions {
  pause?: boolean;
  cancel?: boolean;
}

/**
 * Stage execution options
 */
export interface StageExecutionOptions {
  provider: ProviderType;
  role: string;
  profile: string;
  mode?: 'sequential' | 'parallel';
  on_failure?: 'stop' | 'continue' | 'retry';
  retries?: number;
  retry_backoff?: number;
  skills?: string[];
  prompt?: string;
}

/**
 * Workflow execution options
 */
export interface WorkflowExecutionOptions {
  orchDir: string;
  mode?: ExecutionMode;
  vars?: Record<string, any>;
  onStateChange?: (run: WorkflowRun) => void;
  onEvent?: (event: any) => void;
  onStageComplete?: (result: StageResult) => void;
}

/**
 * Workflow Executor
 * Manages workflow execution with pause/resume/cancel capabilities
 */
export class WorkflowExecutor extends EventEmitter {
  private orchDir: string;
  private activeRuns: Map<string, WorkflowRun> = new Map();
  private runPromises: Map<string, { resolve: (value: any) => void; reject: (reason: any) => void }> = new Map();
  private runControls: Map<string, RunControlOptions> = new Map();
  private stateManager: RunStateManager;
  private providerExecutor: ProviderExecutor;
  private roleManager: RoleManager;

  constructor(orchDir: string) {
    super();
    this.orchDir = orchDir;
    this.stateManager = new RunStateManager(orchDir);
    this.providerExecutor = new ProviderExecutor(orchDir);
    this.roleManager = new RoleManager(orchDir);
  }

  /**
   * Start a new workflow execution
   */
  async start(
    workflowId: string,
    options: WorkflowExecutionOptions
  ): Promise<string> {
    const runId = nanoid();
    const workflow = await this.loadWorkflow(workflowId);

    // Create workflow run
    const run: WorkflowRun = {
      runId,
      workflowId,
      status: 'running',
      currentStage: workflow.stages[0],
      iteration: 0,
      context: {
        vars: options.vars || {},
        stages: {},
        iteration: 0,
        runId,
      },
      stageResults: new Map(),
      startedAt: new Date().toISOString(),
    };

    // Store active run
    this.activeRuns.set(runId, run);
    this.runControls.set(runId, {});

    // Notify start
    this.notifyStateChange(run, options);
    this.notifyEvent({ type: 'run_start', runId, workflowId }, options);

    // Start execution in background
    this.executeWorkflow(run, workflow, options).catch((error) => {
      logger.error(`Workflow run ${runId} failed`, { error });
      this.cleanupRun(runId);
    });

    return runId;
  }

  /**
   * Pause a running workflow
   */
  pause(runId: string): boolean {
    const control = this.runControls.get(runId);
    if (!control) {
      return false;
    }
    control.pause = true;

    const run = this.activeRuns.get(runId);
    if (run) {
      run.status = 'paused';
      this.notifyStateChange(run);
    }

    return true;
  }

  /**
   * Resume a paused workflow
   */
  resume(runId: string, options: WorkflowExecutionOptions): boolean {
    const control = this.runControls.get(runId);
    if (!control) {
      return false;
    }
    control.pause = false;

    const run = this.activeRuns.get(runId);
    if (!run) {
      return false;
    }

    run.status = 'running';
    this.notifyStateChange(run, options);
    this.notifyEvent({ type: 'run_resume', runId }, options);

    return true;
  }

  /**
   * Cancel a running workflow
   */
  cancel(runId: string): boolean {
    const control = this.runControls.get(runId);
    if (!control) {
      return false;
    }
    control.cancel = true;

    const run = this.activeRuns.get(runId);
    if (run) {
      run.status = 'cancelled';
      run.completedAt = new Date().toISOString();
      this.notifyStateChange(run);
    }

    return true;
  }

  /**
   * Get active run by ID
   */
  getRun(runId: string): WorkflowRun | undefined {
    return this.activeRuns.get(runId);
  }

  /**
   * List all active runs
   */
  listRuns(): WorkflowRun[] {
    return Array.from(this.activeRuns.values());
  }

  /**
   * Check if run should pause
   */
  private shouldPause(runId: string): boolean {
    return this.runControls.get(runId)?.pause === true;
  }

  /**
   * Check if run should cancel
   */
  private shouldCancel(runId: string): boolean {
    return this.runControls.get(runId)?.cancel === true;
  }

  /**
   * Load workflow from file
   */
  private async loadWorkflow(workflowId: string): Promise<Workflow> {
    const workflowPath = path.join(this.orchDir, 'workflows', `${workflowId}.workflow.yml`);
    const workflowResult = await loadWorkflow(workflowPath);

    if (!workflowResult.valid || !workflowResult.data) {
      throw new Error(`Invalid workflow: ${workflowResult.errors?.join(', ')}`);
    }

    const workflowWrapper = workflowResult.data as { workflow: Workflow; [key: string]: any };
    if (!workflowWrapper.workflow) {
      throw new Error('Invalid workflow format: missing workflow root');
    }

    // Parse stage configs from workflow file
    const workflow = workflowWrapper.workflow;
    const stageConfigs: Record<string, StageConfig> = {};

    for (const stage of workflow.stages) {
      const stageConfig = workflowWrapper[stage];
      if (stageConfig && typeof stageConfig === 'object') {
        stageConfigs[stage] = {
          provider: stageConfig.provider,
          role: stageConfig.role,
          profile: stageConfig.profile || 'simple',
          mode: stageConfig.mode,
          providers: stageConfig.providers,
          parallel_strategy: stageConfig.parallel_strategy,
          on_failure: stageConfig.on_failure,
          retries: stageConfig.retries,
          retry_backoff: stageConfig.retry_backoff,
          min_iterations: stageConfig.min_iterations,
          skills: stageConfig.skills,
          prompt: stageConfig.prompt,
        };
      } else if (typeof stageConfig === 'string') {
        stageConfigs[stage] = { profile: stageConfig };
      }
    }

    if (Object.keys(stageConfigs).length > 0) {
      (workflow as any).stageConfigs = stageConfigs;
    }

    return workflow;
  }

  /**
   * Execute workflow with pause/resume/cancel support
   */
  private async executeWorkflow(
    run: WorkflowRun,
    workflow: Workflow,
    options: WorkflowExecutionOptions
  ): Promise<void> {
    const fsm = new FSMEngine(workflow, run.currentStage);
    const eventLogger = new EventLogger(this.orchDir, run.runId);
    const mode = options.mode || 'auto';

    // Restore FSM state if resuming
    fsm.restoreState({
      currentStage: run.currentStage || workflow.stages[0],
      currentIter: run.iteration,
      history: [],
    });

    // Merge global assignments with workflow stage configs
    const globalAssignments = this.loadGlobalAssignments();
    const assignments = this.mergeAssignments(globalAssignments, workflow);

    try {
      while (true) {
        // Check for pause
        if (this.shouldPause(run.runId)) {
          await this.waitForResume(run.runId);
          if (this.shouldCancel(run.runId)) {
            run.status = 'cancelled';
            break;
          }
        }

        // Check for cancel
        if (this.shouldCancel(run.runId)) {
          run.status = 'cancelled';
          break;
        }

        const stage = fsm.getCurrentStage();
        run.currentStage = stage;
        run.iteration = fsm.getCurrentIter();

        const stageConfig = assignments[stage];
        if (!stageConfig) {
          throw new Error(`No assignment configured for stage: ${stage}`);
        }

        // Update run state
        this.stateManager.updateRun(run.runId, {
          currentStage: stage,
          stageIter: fsm.getCurrentIter(),
          status: run.status,
        });
        this.notifyStateChange(run, options);

        // Execute stage
        const stageResult = await this.executeStage(
          stage,
          stageConfig,
          run,
          options,
          eventLogger
        );

        // Store stage result
        run.stageResults.set(stage, stageResult);
        run.context.stages[stage] = stageResult.output;

        // Increment stage execution count (for min_iterations check)
        fsm.incrementStageCount(stage);

        // Notify stage complete
        if (options.onStageComplete) {
          options.onStageComplete(stageResult);
        }

        // Handle stage failure
        if (stageResult.status === 'failed') {
          const failureAction = stageConfig.on_failure || 'stop';

          if (failureAction === 'stop') {
            run.status = 'failed';
            run.lastError = stageResult.error;
            eventLogger.log({ type: 'error', stage, error: stageResult.error });
            break;
          } else if (failureAction === 'continue') {
            // Continue to next stage
          } else if (failureAction === 'retry') {
            const retries = stageConfig.retries || 3;
            if ((stageResult.retries || 0) < retries) {
              // Retry this stage
              continue;
            } else {
              run.status = 'failed';
              run.lastError = stageResult.error;
              eventLogger.log({ type: 'error', stage, error: `Max retries exceeded` });
              break;
            }
          }
        }

        eventLogger.log({ type: 'stage_end', stage, data: { success: stageResult.status === 'completed' } });

        // Handle check stage and review stage (both can determine completion)
        if (stage === 'check' || stage === 'review') {
          const checkResult = fsm.evaluateCheckResult(stageResult.output);
          if (checkResult.done || !checkResult.nextStage) {
            run.status = 'completed';
            break;
          }
          fsm.transitionTo(checkResult.nextStage);
          continue;
        }

        // Transition to next stage
        const nextStage = fsm.transitionToNext();
        if (!nextStage) {
          run.status = 'completed';
          break;
        }
      }

      run.completedAt = new Date().toISOString();
      this.notifyStateChange(run, options);
      this.notifyEvent({ type: 'run_end', runId: run.runId, status: run.status }, options);

    } catch (error) {
      run.status = 'failed';
      run.lastError = error instanceof Error ? error.message : String(error);
      run.completedAt = new Date().toISOString();
      this.notifyStateChange(run, options);
      this.notifyEvent({
        type: 'run_error',
        runId: run.runId,
        error: run.lastError
      }, options);
    } finally {
      this.cleanupRun(run.runId);
    }
  }

  /**
   * Execute a single stage
   */
  private async executeStage(
    stage: StageType,
    stageConfig: StageAssignment & StageConfig,
    run: WorkflowRun,
    options: WorkflowExecutionOptions,
    eventLogger: EventLogger
  ): Promise<StageResult> {
    const startTime = new Date().toISOString();

    // Check for parallel execution
    if (stageConfig.mode === 'parallel' && stageConfig.providers && stageConfig.providers.length > 0) {
      return this.executeStageParallel(
        stage,
        stageConfig,
        run,
        options,
        eventLogger,
        startTime
      );
    }

    // Sequential execution (existing logic)
    return this.executeStageSequential(
      stage,
      stageConfig,
      run,
      options,
      eventLogger,
      startTime
    );
  }

  /**
   * Execute stage with multiple providers in parallel
   */
  private async executeStageParallel(
    stage: StageType,
    stageConfig: StageAssignment & StageConfig,
    run: WorkflowRun,
    options: WorkflowExecutionOptions,
    eventLogger: EventLogger,
    startTime: string
  ): Promise<StageResult> {
    const providers = stageConfig.providers || [];
    const strategy = stageConfig.parallel_strategy || 'all';

    this.notifyEvent({
      type: 'stage_parallel_start',
      stage,
      runId: run.runId,
      providers: providers.map(p => p.provider),
      strategy
    }, options);

    // Execute all providers in parallel
    const providerPromises = providers.map((providerConfig) =>
      this.executeWithProvider(
        stage,
        providerConfig.provider,
        providerConfig.role || stageConfig.role || stage,
        stageConfig,
        run,
        options,
        eventLogger
      )
    );

    let results: ProviderResult[];

    if (strategy === 'race') {
      // Race: take first successful result
      results = await Promise.race(
        providerPromises.map(async (promise) => {
          const result = await promise;
          if (result.status === 'completed') {
            // Cancel others by returning early
            return [result];
          }
          return promise.then(r => [r]);
        })
      );
    } else {
      // All or Majority: wait for all
      results = await Promise.all(providerPromises);
    }

    const completedCount = results.filter(r => r.status === 'completed').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    // Aggregate results based on strategy
    let finalOutput: any;
    let finalStatus: StageStatus;

    if (strategy === 'race') {
      const winner = results[0];
      finalOutput = winner.output;
      finalStatus = winner.status;
    } else if (strategy === 'majority') {
      if (completedCount > failedCount) {
        // Merge outputs from all successful providers
        finalOutput = this.mergeProviderOutputs(results.filter(r => r.status === 'completed'));
        finalStatus = 'completed';
      } else {
        finalOutput = { results, completedCount, failedCount };
        finalStatus = 'failed';
      }
    } else {
      // 'all' strategy: require all to succeed
      if (failedCount === 0) {
        finalOutput = this.mergeProviderOutputs(results);
        finalStatus = 'completed';
      } else {
        finalOutput = { results, completedCount, failedCount };
        finalStatus = 'failed';
      }
    }

    return {
      stage,
      status: finalStatus,
      output: finalOutput,
      startedAt: startTime,
      completedAt: new Date().toISOString(),
      providerResults: results,
      aggregationMethod: strategy === 'race' ? 'first' : strategy === 'majority' ? 'majority' : 'all',
    };
  }

  /**
   * Execute stage with single provider (sequential)
   */
  private async executeStageSequential(
    stage: StageType,
    stageConfig: StageAssignment & StageConfig,
    run: WorkflowRun,
    options: WorkflowExecutionOptions,
    eventLogger: EventLogger,
    startTime: string
  ): Promise<StageResult> {
    let attempt = 0;
    const maxRetries = stageConfig.retries || 0;
    const backoff = stageConfig.retry_backoff || 1;

    while (attempt <= maxRetries) {
      try {
        // Check for pause/cancel
        if (this.shouldPause(run.runId)) {
          await this.waitForResume(run.runId);
        }
        if (this.shouldCancel(run.runId)) {
          return {
            stage,
            status: 'failed',
            error: 'Cancelled by user',
            startedAt: startTime,
            completedAt: new Date().toISOString(),
            retries: attempt,
          };
        }

        eventLogger.log({ type: 'node_start', nodeId: stage, stage });
        this.notifyEvent({ type: 'stage_start', stage, runId: run.runId }, options);

        // Load stage profile
        const profilePath = path.join(this.orchDir, 'workflows', 'stages', `${stage}.${stageConfig.profile}.yml`);
        const profileResult = await loadStageProfile(profilePath);

        if (!profileResult.valid || !profileResult.data) {
          throw new Error(`Invalid stage profile: ${profileResult.errors?.join(', ')}`);
        }

        const stageProfile = profileResult.data;

        // Execute DAG
        const dag = new DAGExecutor(stageProfile, { ...run.context.vars }, {
          runNode: async (node, context) => {
            const provider = stageConfig.provider || 'claude-code';
            const roleId = stageConfig.role || stage;

            const outputDir = path.join(
              this.orchDir,
              'runs',
              run.runId,
              'stages',
              String(run.iteration),
              stage,
              'nodes',
              node.id
            );

            const role = this.roleManager.loadRole(roleId);
            if (!role) {
              throw new Error(`Role not found: ${roleId}`);
            }

            const executionContext = {
              ...context,
              runId: run.runId,
              stage,
            };

            const result = await this.providerExecutor.execute({
              provider,
              role: roleId,
              context: executionContext,
              outputDir,
              orchDir: this.orchDir,
              mode: options.mode || 'auto',
            });

            if (!result.success) {
              throw new Error(result.error || `Node ${node.id} failed`);
            }

            return result.output;
          },
          exportValidator: async (data, schemaRef, node) => {
            // Validation logic if needed
          },
          onNodeStart: (node) => {
            eventLogger.log({ type: 'node_start', nodeId: node.id, stage });
          },
          onNodeEnd: (node) => {
            eventLogger.log({ type: 'node_end', nodeId: node.id, stage });
          },
          onNodeError: (node, error) => {
            eventLogger.log({ type: 'error', nodeId: node.id, stage, error: String(error) });
          },
        });

        const dagResult = await dag.execute();

        if (!dagResult.success) {
          throw new Error(dagResult.error || `Stage ${stage} failed`);
        }

        // Get stage output
        const exportNode = stageProfile.graph.find((n: any) => n.type === 'export');
        const output = exportNode ? dagResult.results.get(exportNode.id) : undefined;

        return {
          stage,
          status: 'completed',
          output,
          startedAt: startTime,
          completedAt: new Date().toISOString(),
          retries: attempt,
        };

      } catch (error) {
        attempt++;

        if (attempt > maxRetries) {
          return {
            stage,
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
            startedAt: startTime,
            completedAt: new Date().toISOString(),
            retries: attempt - 1,
          };
        }

        // Wait before retry
        await this.sleep(backoff * 1000 * attempt);
      }
    }

    return {
      stage,
      status: 'failed',
      error: 'Unknown error',
      startedAt: startTime,
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * Execute with a specific provider
   */
  private async executeWithProvider(
    stage: StageType,
    provider: ProviderType,
    role: string,
    stageConfig: StageAssignment & StageConfig,
    run: WorkflowRun,
    options: WorkflowExecutionOptions,
    eventLogger: EventLogger
  ): Promise<ProviderResult> {
    const startTime = Date.now();

    try {
      // Load stage profile
      const profilePath = path.join(this.orchDir, 'workflows', 'stages', `${stage}.${stageConfig.profile}.yml`);
      const profileResult = await loadStageProfile(profilePath);

      if (!profileResult.valid || !profileResult.data) {
        throw new Error(`Invalid stage profile: ${profileResult.errors?.join(', ')}`);
      }

      const stageProfile = profileResult.data;

      // Execute DAG with this provider
      const dag = new DAGExecutor(stageProfile, { ...run.context.vars }, {
        runNode: async (node: Node, context: NodeContext) => {
          const outputDir = path.join(
            this.orchDir,
            'runs',
            run.runId,
            'stages',
            String(run.iteration),
            stage,
            'providers',
            provider,
            node.id
          );

          const roleDef = this.roleManager.loadRole(role);
          if (!roleDef) {
            throw new Error(`Role not found: ${role}`);
          }

          const executionContext = {
            ...context,
            runId: run.runId,
            stage,
          };

          const result = await this.providerExecutor.execute({
            provider,
            role,
            context: executionContext,
            outputDir,
            orchDir: this.orchDir,
            mode: options.mode || 'auto',
          });

          if (!result.success) {
            throw new Error(result.error || `Node ${node.id} failed`);
          }

          return result.output;
        },
        onNodeStart: (node: Node, _context: NodeContext) => {
          eventLogger.log({ type: 'node_start', nodeId: node.id, stage, provider });
        },
        onNodeEnd: (node: Node, _output: unknown, _context: NodeContext) => {
          eventLogger.log({ type: 'node_end', nodeId: node.id, stage, provider });
        },
        onNodeError: (node: Node, error: string, _context: NodeContext) => {
          eventLogger.log({ type: 'error', nodeId: node.id, stage, provider, error });
        },
      } as any);

      const dagResult = await dag.execute();

      if (!dagResult.success) {
        throw new Error(dagResult.error || `Stage ${stage} failed`);
      }

      const exportNode = stageProfile.graph.find((n: any) => n.type === 'export');
      const output = exportNode ? dagResult.results.get(exportNode.id) : undefined;

      return {
        provider,
        role,
        status: 'completed',
        output,
        duration: Date.now() - startTime,
      };

    } catch (error) {
      return {
        provider,
        role,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Merge outputs from multiple providers
   */
  private mergeProviderOutputs(results: ProviderResult[]): any {
    const successful = results.filter(r => r.status === 'completed');

    if (successful.length === 0) {
      return undefined;
    }

    if (successful.length === 1) {
      return successful[0].output;
    }

    // Merge outputs into a structured format
    return {
      merged: true,
      providerCount: successful.length,
      outputs: successful.map(r => ({
        provider: r.provider,
        output: r.output,
        duration: r.duration,
      })),
      // Try to find a common output format
      ...(successful[0].output as object),
    };
  }

  /**
   * Wait for run to be resumed
   */
  private async waitForResume(runId: string): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!this.shouldPause(runId)) {
          clearInterval(checkInterval);
          resolve();
        }
        if (this.shouldCancel(runId)) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Load global assignments from config
   */
  private loadGlobalAssignments(): Record<StageType, StageAssignment> {
    const defaults: Record<StageType, StageAssignment> = {
      analyze: { provider: 'claude-code', role: 'planner', profile: 'simple' },
      plan: { provider: 'claude-code', role: 'planner', profile: 'simple' },
      code: { provider: 'claude-code', role: 'coder', profile: 'simple' },
      review: { provider: 'claude-code', role: 'checker', profile: 'simple' },
      test: { provider: 'claude-code', role: 'tester', profile: 'simple' },
      check: { provider: 'claude-code', role: 'checker', profile: 'simple' },
    };

    return defaults;
  }

  /**
   * Merge global assignments with workflow stage configs
   */
  private mergeAssignments(
    globalAssignments: Record<StageType, StageAssignment>,
    workflow: Workflow
  ): Record<StageType, StageAssignment & StageConfig> {
    const merged: Record<string, StageAssignment & StageConfig> = {};
    const stageConfigs = (workflow as any).stageConfigs as Record<StageType, StageConfig> | undefined;

    for (const stage of workflow.stages) {
      merged[stage] = {
        ...globalAssignments[stage],
        ...(stageConfigs?.[stage] || {}),
      };
    }

    return merged;
  }

  /**
   * Notify state change
   */
  private notifyStateChange(run: WorkflowRun, options?: WorkflowExecutionOptions): void {
    if (options?.onStateChange) {
      options.onStateChange(run);
    }
    this.emit('stateChange', run);
  }

  /**
   * Notify event
   */
  private notifyEvent(event: any, options?: WorkflowExecutionOptions): void {
    if (options?.onEvent) {
      options.onEvent(event);
    }
    this.emit('event', event);
  }

  /**
   * Clean up completed run
   */
  private cleanupRun(runId: string): void {
    const promise = this.runPromises.get(runId);
    if (promise) {
      promise.resolve(this.activeRuns.get(runId));
      this.runPromises.delete(runId);
    }
    // Keep run in activeRuns for querying until explicitly removed
    // this.activeRuns.delete(runId);
    this.runControls.delete(runId);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Remove run from active runs
   */
  removeRun(runId: string): void {
    this.activeRuns.delete(runId);
    this.runControls.delete(runId);
    this.runPromises.delete(runId);
  }
}
