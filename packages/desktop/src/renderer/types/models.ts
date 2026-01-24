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
  prompt?: string;
  createdAt: Date | string;
  startedAt: Date | string | null;
  endedAt: Date | string | null;
  error?: string;
  worktreeInfo?: {
    path: string;
    branch: string;
    baseBranch: string;
    repoPath?: string;  // 원본 카페 경로 (worktree 삭제 시 Git 컨텍스트 제공)
    removed?: boolean;  // worktree 삭제 여부
    merged?: boolean;   // 병합 완료 여부
    mergedTo?: string;  // 병합 대상 브랜치
    mergeCommit?: string; // 병합 커밋 해시
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
  isDefault?: boolean;
  protected?: boolean;
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

// Skill types (단일 스킬 관리)
export type SkillCategory = 'analysis' | 'planning' | 'implementation' | 'verification' | 'utility';

/**
 * 단일 스킬 정의
 * - Skills 메뉴에서 개별 관리
 * - Workflow의 Stage에서 skills: ['skill-id-1', 'skill-id-2'] 형태로 참조
 */
export interface Skill {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  skillCommand: string; // e.g., '/moonshot-classify-task'
  context?: 'fork' | 'inherit';
  isBuiltIn?: boolean; // 시스템 제공 여부
  createdAt?: string;
  updatedAt?: string;
}

// Legacy: SkillPresetItem은 Skill의 별칭으로 유지 (하위 호환성)
export type SkillPresetItem = Skill;

// Legacy: SkillPreset은 하위 호환성을 위해 유지 (사용하지 않음)
export interface SkillPreset {
  id: string;
  name: string;
  description: string;
  skills: Skill[];
  isBuiltIn?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
