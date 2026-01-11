import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import chalk from 'chalk';
import { nanoid } from 'nanoid';
import { AssistedExecutor } from '../../provider/assisted';
import { RoleManager } from '../../role/role-manager';
import { validateJson, loadStageProfile, loadWorkflow } from '../../schema/validator';
import { DAGExecutor } from '../../engine/dag-executor';
import { FSMEngine } from '../../engine/fsm';
import { EventLogger } from '../../storage/event-logger';
import { RunStateManager } from '../../storage/run-state';
import {
  ExecutionMode,
  ProviderType,
  RunState,
  StageAssignment,
  StageProfile,
  StageType,
  Workflow,
} from '../../types';

interface AssignmentsConfig {
  assignments: Record<StageType, StageAssignment>;
}

interface RunWorkflowOptions {
  orchDir?: string;
  mode?: ExecutionMode;
  runId?: string;
}

interface ResumeWorkflowOptions {
  orchDir?: string;
  mode?: ExecutionMode;
}

export async function runWorkflow(
  workflowId: string,
  options: RunWorkflowOptions = {}
): Promise<RunState> {
  const orchDir = options.orchDir || path.join(process.cwd(), '.orch');
  assertOrchDir(orchDir);

  const workflowPath = resolveWorkflowPath(orchDir, workflowId);
  const workflow = await loadWorkflowFile(workflowPath);
  const runId = options.runId || nanoid();

  return executeWorkflow({
    orchDir,
    workflow,
    workflowId,
    runId,
    mode: options.mode || 'assisted',
  });
}

export async function resumeWorkflow(
  runId: string,
  options: ResumeWorkflowOptions = {}
): Promise<RunState> {
  const orchDir = options.orchDir || path.join(process.cwd(), '.orch');
  assertOrchDir(orchDir);

  const stateManager = new RunStateManager(orchDir);
  const existing = stateManager.loadRun(runId);
  if (!existing) {
    throw new Error(`Run not found: ${runId}`);
  }

  const workflowPath = resolveWorkflowPath(orchDir, existing.workflow);
  const workflow = await loadWorkflowFile(workflowPath);

  return executeWorkflow({
    orchDir,
    workflow,
    workflowId: existing.workflow,
    runId,
    mode: options.mode || 'assisted',
    resumeState: existing,
  });
}

interface ExecuteWorkflowOptions {
  orchDir: string;
  workflow: Workflow;
  workflowId: string;
  runId: string;
  mode: ExecutionMode;
  resumeState?: RunState;
}

async function executeWorkflow(options: ExecuteWorkflowOptions): Promise<RunState> {
  const stateManager = new RunStateManager(options.orchDir);
  const eventLogger = new EventLogger(options.orchDir, options.runId);
  const assignments = loadAssignments(options.orchDir);
  const assistedExecutor = new AssistedExecutor(options.orchDir);
  const roleManager = new RoleManager(options.orchDir);

  let runState: RunState;

  if (options.resumeState) {
    runState = {
      ...options.resumeState,
      status: 'running',
      lastError: undefined,
    };
    stateManager.saveRun(runState);
  } else {
    runState = stateManager.createRun({
      workflow: options.workflowId,
      initialStage: options.workflow.stages[0],
      runId: options.runId,
    });
  }

  if (options.mode !== 'assisted') {
    console.log(chalk.yellow('Headless mode not implemented; using assisted mode'));
  }

  const fsm = new FSMEngine(options.workflow, runState.currentStage);
  fsm.restoreState({
    currentStage: runState.currentStage,
    currentIter: runState.stageIter,
    history: [],
  });

  while (true) {
    const stage = fsm.getCurrentStage();
    const stageConfig = assignments[stage];
    if (!stageConfig) {
      throw new Error(`No assignment configured for stage: ${stage}`);
    }

    runState = stateManager.updateRun(options.runId, {
      currentStage: stage,
      stageIter: fsm.getCurrentIter(),
      completedNodes: [],
      status: 'running',
      lastError: undefined,
    });

    const profilePath = resolveStageProfilePath(
      options.orchDir,
      stage,
      stageConfig.profile
    );
    const profileResult = await loadStageProfile(profilePath);

    if (!profileResult.valid || !profileResult.data) {
      const message = formatValidationErrors(profileResult.errors, 'stage profile');
      eventLogger.log({ type: 'error', stage, error: message });
      runState = stateManager.updateRun(options.runId, {
        status: 'failed',
        lastError: message,
      });
      return runState;
    }

    const stageProfile = profileResult.data as StageProfile & {
      vars?: Record<string, any>;
    };

    const resolvedProfile = resolveStageProfile(stageProfile, stageConfig);
    const resolvedVars = (resolvedProfile as any).vars || stageProfile.vars || {};
    const initialVars = { ...resolvedVars };

    const dag = new DAGExecutor(resolvedProfile, initialVars, {
      runNode: async (node, context) => {
        const provider = (resolveStageValue(node.provider, stageConfig) ||
          stageConfig.provider) as ProviderType;
        const roleId = (resolveStageValue(node.role, stageConfig) || stageConfig.role) as string;

        if (!provider || !roleId) {
          throw new Error(`Run node ${node.id} missing provider or role`);
        }

        const outputDir = getNodeOutputDir(
          options.orchDir,
          options.runId,
          fsm.getCurrentIter(),
          stage,
          node.id
        );

        const role = roleManager.loadRole(roleId);
        if (!role) {
          throw new Error(`Role not found: ${roleId}`);
        }

        const executionContext = buildExecutionContext(context, node, stage, options.runId);
        const schemaRef = role.output_schema || node.output_schema;

        if (!schemaRef) {
          const result = await assistedExecutor.execute({
            provider,
            role: roleId,
            context: executionContext,
            outputDir,
            orchDir: options.orchDir,
          });

          if (!result.success) {
            throw new Error(result.error || `Run node ${node.id} failed`);
          }

          return result.output;
        }

        const schemaPath = resolveSchemaPath(options.orchDir, schemaRef);
        const result = await assistedExecutor.executeWithSchema({
          provider,
          role: roleId,
          context: executionContext,
          outputDir,
          orchDir: options.orchDir,
          schemaPath,
          maxRetries: 3,
          onValidationFail: (errors) => {
            eventLogger.log({
              type: 'validation_fail',
              nodeId: node.id,
              stage,
              data: { errors },
              error: errors.join('; '),
            });
          },
          onRetry: (attempt, remaining) => {
            eventLogger.log({
              type: 'retry',
              nodeId: node.id,
              stage,
              data: { attempt, remaining },
            });
          },
        });

        if (!result.success) {
          throw new Error(result.error || `Run node ${node.id} failed`);
        }

        return result.output;
      },
      exportValidator: async (data, schemaRef, node) => {
        if (!schemaRef) {
          return;
        }

        const schemaPath = resolveSchemaPath(options.orchDir, schemaRef);
        const validation = await validateJson(data, schemaPath);

        if (!validation.valid) {
          const errors = validation.errors || ['Schema validation failed'];
          eventLogger.log({
            type: 'validation_fail',
            nodeId: node.id,
            stage,
            data: { errors },
            error: errors.join('; '),
          });
          throw new Error(`Schema validation failed: ${errors.join('; ')}`);
        }
      },
      onNodeStart: (node) => {
        eventLogger.log({ type: 'node_start', nodeId: node.id, stage });
      },
      onNodeEnd: (node) => {
        if (!runState.completedNodes.includes(node.id)) {
          runState.completedNodes.push(node.id);
          stateManager.saveRun(runState);
        }
        eventLogger.log({ type: 'node_end', nodeId: node.id, stage });
      },
      onNodeError: (node, error) => {
        eventLogger.log({ type: 'error', nodeId: node.id, stage, error });
      },
    });

    const dagResult = await dag.execute();

    if (!dagResult.success) {
      const message = dagResult.error || `Stage ${stage} failed`;
      eventLogger.log({ type: 'error', stage, error: message });
      eventLogger.log({ type: 'stage_end', stage, data: { success: false } });
      runState = stateManager.updateRun(options.runId, {
        status: 'failed',
        lastError: message,
      });
      return runState;
    }

    eventLogger.log({ type: 'stage_end', stage, data: { success: true } });

    const stageOutput = getStageOutput(resolvedProfile, dagResult.results, dagResult.executionOrder);

    if (stage === 'check') {
      const checkResult = fsm.evaluateCheckResult(stageOutput);
      if (checkResult.done || !checkResult.nextStage) {
        runState = stateManager.updateRun(options.runId, {
          status: 'completed',
        });
        return runState;
      }

      fsm.transitionTo(checkResult.nextStage);
      continue;
    }

    const nextStage = fsm.transitionToNext();
    if (!nextStage) {
      runState = stateManager.updateRun(options.runId, {
        status: 'completed',
      });
      return runState;
    }
  }
}

function loadAssignments(orchDir: string): Record<StageType, StageAssignment> {
  const configPath = path.join(orchDir, 'config', 'assignments.yml');

  const defaults: Record<StageType, StageAssignment> = {
    plan: { provider: 'claude-code', role: 'planner', profile: 'simple' },
    code: { provider: 'claude-code', role: 'coder', profile: 'simple' },
    test: { provider: 'claude-code', role: 'tester', profile: 'simple' },
    check: { provider: 'claude-code', role: 'checker', profile: 'simple' },
  };

  if (!fs.existsSync(configPath)) {
    return defaults;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = yaml.load(content) as AssignmentsConfig;
    return { ...defaults, ...(config?.assignments || {}) };
  } catch (error) {
    console.warn('Failed to load assignments.yml, using defaults:', error);
    return defaults;
  }
}

async function loadWorkflowFile(workflowPath: string): Promise<Workflow> {
  const workflowResult = await loadWorkflow(workflowPath);
  if (!workflowResult.valid || !workflowResult.data) {
    throw new Error(formatValidationErrors(workflowResult.errors, 'workflow'));
  }

  const workflowWrapper = workflowResult.data as { workflow: Workflow };
  if (!workflowWrapper.workflow) {
    throw new Error('Invalid workflow format: missing workflow root');
  }

  return workflowWrapper.workflow;
}

function resolveWorkflowPath(orchDir: string, workflowId: string): string {
  if (fs.existsSync(workflowId)) {
    return workflowId;
  }

  const workflowPath = path.join(orchDir, 'workflows', `${workflowId}.workflow.yml`);
  if (fs.existsSync(workflowPath)) {
    return workflowPath;
  }

  throw new Error(`Workflow not found: ${workflowId}`);
}

function resolveStageProfilePath(
  orchDir: string,
  stage: StageType,
  profile: string
): string {
  const profilePath = path.join(orchDir, 'workflows', 'stages', `${stage}.${profile}.yml`);
  if (!fs.existsSync(profilePath)) {
    throw new Error(`Stage profile not found: ${profilePath}`);
  }
  return profilePath;
}

function resolveSchemaPath(orchDir: string, schemaRef: string): string {
  if (path.isAbsolute(schemaRef)) {
    return schemaRef;
  }

  if (schemaRef.startsWith('.orch/') || schemaRef.startsWith('.orch\\')) {
    return path.resolve(process.cwd(), schemaRef);
  }

  return path.resolve(orchDir, schemaRef);
}

function resolveStageProfile(profile: StageProfile, stageConfig: StageAssignment): StageProfile {
  const stageContext = {
    stage: {
      provider: stageConfig.provider,
      role: stageConfig.role,
      profile: stageConfig.profile,
    },
  };

  return resolveTemplateValues(profile, stageContext) as StageProfile;
}

function resolveTemplateValues(value: any, context: Record<string, any>): any {
  if (Array.isArray(value)) {
    return value.map((item) => resolveTemplateValues(item, context));
  }

  if (value && typeof value === 'object') {
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = resolveTemplateValues(val, context);
    }
    return result;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const fullMatch = value.match(/^\$\{([^}]+)\}$/);
  if (fullMatch) {
    const resolved = resolveStageExpression(fullMatch[1], context);
    return resolved !== undefined ? resolved : value;
  }

  return value.replace(/\$\{([^}]+)\}/g, (match, expr) => {
    const resolved = resolveStageExpression(expr, context);
    return resolved !== undefined ? String(resolved) : match;
  });
}

function resolveStageExpression(expr: string, context: Record<string, any>): any {
  if (!expr.startsWith('stage.')) {
    return undefined;
  }

  return expr.split('.').reduce((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return acc[key];
    }
    return undefined;
  }, context);
}

function resolveStageValue(
  value: string | undefined,
  stageConfig: StageAssignment
): ProviderType | string | undefined {
  if (!value) {
    return undefined;
  }

  return value
    .replace(/\$\{stage\.provider\}/g, stageConfig.provider)
    .replace(/\$\{stage\.role\}/g, stageConfig.role)
    .replace(/\$\{stage\.profile\}/g, stageConfig.profile);
}

function buildExecutionContext(
  context: { variables: Record<string, any>; results: Map<string, any> },
  node: { inputs?: string[]; id: string },
  stage: StageType,
  runId: string
): Record<string, any> {
  const nodes: Record<string, any> = {};
  for (const [key, value] of context.results.entries()) {
    nodes[key] = value;
  }

  const nodeInputs: Record<string, any> = {};
  if (node.inputs) {
    for (const input of node.inputs) {
      if (context.results.has(input)) {
        nodeInputs[input] = context.results.get(input);
      }
    }
  }

  return {
    vars: context.variables,
    nodes,
    node_inputs: nodeInputs,
    stage,
    runId,
  };
}

function getNodeOutputDir(
  orchDir: string,
  runId: string,
  iter: number,
  stage: StageType,
  nodeId: string
): string {
  return path.join(orchDir, 'runs', runId, 'stages', String(iter), stage, 'nodes', nodeId);
}

function getStageOutput(
  profile: StageProfile,
  results: Map<string, any>,
  executionOrder: string[]
): any {
  const exportNode = profile.graph.find((node) => node.type === 'export');
  if (exportNode) {
    const exportResult = results.get(exportNode.id);
    if (exportResult && typeof exportResult === 'object' && 'data' in exportResult) {
      return (exportResult as any).data;
    }
    return exportResult;
  }

  const lastNodeId = executionOrder[executionOrder.length - 1];
  return lastNodeId ? results.get(lastNodeId) : null;
}

function formatValidationErrors(errors: string[] | undefined, label: string): string {
  if (!errors || errors.length === 0) {
    return `Invalid ${label}`;
  }
  return `Invalid ${label}: ${errors.join(', ')}`;
}

function assertOrchDir(orchDir: string): void {
  if (!fs.existsSync(orchDir)) {
    throw new Error(`.orch directory not found at ${orchDir}`);
  }
}
