// 도메인 모델 타입 정의
export type ProviderType = 'claude-code' | 'codex' | 'gemini' | 'grok';
export type BaristaStatus = 'IDLE' | 'RUNNING' | 'ERROR' | 'STOPPED';
export enum OrderStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}
export type WorkspaceMode = 'in-place' | 'worktree' | 'temp';

// Workflow execution types
export type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type RunStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type FailureStrategy = 'stop' | 'continue' | 'retry';
export type StageExecutionMode = 'sequential' | 'parallel';

export interface Barista {
  id: string;
  status: BaristaStatus;
  currentOrderId: string | null;
  provider: ProviderType;
  createdAt: Date | string;
  lastActivityAt: Date | string;
}

export interface Order {
  id: string;
  workflowId: string;
  workflowName: string;
  baristaId: string | null;
  status: OrderStatus;
  counter: string;
  provider: ProviderType;
  vars: Record<string, any>;
  createdAt: Date | string;
  startedAt: Date | string | null;
  endedAt: Date | string | null;
  error?: string;
  worktreeInfo?: {
    path: string;
    branch: string;
    baseBranch: string;
  };
}

export interface WorktreeInfo {
  path: string;
  branch: string | null;
  commit: string | null;
}

export interface Receipt {
  orderId: string;
  status: OrderStatus;
  startedAt: Date | string;
  endedAt: Date | string;
  provider: ProviderType;
  counter: string;
  errorSummary?: string;
  changedFiles?: string[];
  logs?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  stages: string[];
}

// Extended workflow types with stage configuration
export interface StageAssignment {
  provider: string;
  role?: string;
  profile?: string;
}

export interface ProviderConfigItem {
  provider: string;
  role?: string;
  weight?: number;
}

export interface ExtendedStageAssignment extends StageAssignment {
  mode?: StageExecutionMode;
  providers?: ProviderConfigItem[];
  parallel_strategy?: 'all' | 'race' | 'majority';
  on_failure?: FailureStrategy;
  retries?: number;
  retry_backoff?: number;
  min_iterations?: number;
  skills?: string[];
  prompt?: string;
}

export interface ExtendedWorkflowInfo extends Workflow {
  stageConfigs?: Record<string, ExtendedStageAssignment>;
  loop?: {
    max_iters: number;
    fallback_next_stage: string;
    stop_when: string;
  };
}

// Workflow run types
export interface ProviderResult {
  provider: string;
  role: string;
  status: StageStatus;
  output?: any;
  error?: string;
  duration?: number;
}

export interface StageResult {
  stage: string;
  status: StageStatus;
  output?: any;
  error?: string;
  retries?: number;
  startedAt: string;
  completedAt?: string;
  providerResults?: ProviderResult[];
  aggregationMethod?: 'first' | 'majority' | 'weighted' | 'all';
}

export interface ExecutionContext {
  vars: Record<string, any>;
  stages: Record<string, any>;
  iteration: number;
  runId: string;
}

export interface WorkflowRunDetail {
  runId: string;
  workflowId: string;
  status: RunStatus;
  currentStage?: string;
  iteration: number;
  context: ExecutionContext;
  stageResults: Record<string, StageResult>;
  startedAt: string;
  completedAt?: string;
  lastError?: string;
}

export interface WorkflowRunOptions {
  vars?: Record<string, any>;
  mode?: 'assisted' | 'headless' | 'auto';
  interactive?: boolean;
  on_failure?: FailureStrategy;
  max_iters?: number;
}

export interface RunLogEntry {
  type: string;
  message: string;
  timestamp: string;
  stage?: string;
  nodeId?: string;
}
