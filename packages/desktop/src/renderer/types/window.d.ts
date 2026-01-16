import type {
  Barista,
  Order,
  ProviderType,
  WorktreeInfo,
  Receipt,
  Skill,
  SkillPreset,
} from './models';
import type { Cafe, CreateCafeParams, UpdateCafeParams, Role } from '@codecafe/core';
import type { TerminalPoolConfig, PoolStatus, PoolMetrics } from '@codecafe/core';

// =============================================
// Workflow Execution Types
// =============================================

/** Stage execution status */
export type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/** Workflow run status */
export type RunStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

/** Failure handling strategy */
export type FailureStrategy = 'stop' | 'continue' | 'retry';

/** Execution mode for stages */
export type StageExecutionMode = 'sequential' | 'parallel';

/** Single provider configuration for parallel execution */
export interface ProviderConfigItem {
  provider: string;
  role?: string;
  weight?: number;
}

/** Extended stage assignment with new configuration options */
export interface ExtendedStageAssignment extends StageAssignment {
  /** Execution mode: sequential (default) or parallel */
  mode?: StageExecutionMode;
  /** Multiple providers (for parallel execution) */
  providers?: ProviderConfigItem[];
  /** Parallel execution strategy: 'all' (run all), 'race' (first wins), 'majority' (majority wins) */
  parallel_strategy?: 'all' | 'race' | 'majority';
  /** Failure handling strategy */
  on_failure?: FailureStrategy;
  /** Number of retries when on_failure is 'retry' */
  retries?: number;
  /** Backoff multiplier in seconds for retries */
  retry_backoff?: number;
  /** Minimum iterations before this stage can be skipped (e.g., review must run at least N times) */
  min_iterations?: number;
  /** List of skill names to use */
  skills?: string[];
  /** Custom prompt template for this stage */
  prompt?: string;
}

/** Extended workflow info with full stage configurations */
export interface ExtendedWorkflowInfo extends WorkflowInfo {
  /** Full stage configurations with all options */
  stageConfigs?: Record<string, ExtendedStageAssignment>;
  /** Loop configuration */
  loop?: {
    max_iters: number;
    fallback_next_stage: string;
    stop_when: string;
  };
}

/** Result from a single provider execution in parallel mode */
export interface ProviderResult {
  provider: string;
  role: string;
  status: StageStatus;
  output?: any;
  error?: string;
  duration?: number;
}

/** Result from a single stage execution */
export interface StageResult {
  /** Stage name */
  stage: string;
  /** Execution status */
  status: StageStatus;
  /** Stage output data */
  output?: any;
  /** Error message if failed */
  error?: string;
  /** Number of retries attempted */
  retries?: number;
  /** Stage start timestamp */
  startedAt: string;
  /** Stage end timestamp */
  completedAt?: string;
  /** Parallel execution results (if mode is parallel) */
  providerResults?: ProviderResult[];
  /** Aggregation method used for parallel results */
  aggregationMethod?: 'first' | 'majority' | 'weighted' | 'all';
}

/** Execution context shared across stages */
export interface ExecutionContext {
  /** Input variables provided at workflow start */
  vars: Record<string, any>;
  /** Results from previous stages */
  stages: Record<string, any>;
  /** Current iteration number */
  iteration: number;
  /** Workflow run ID */
  runId: string;
}

/** Extended workflow run details */
export interface WorkflowRunDetail {
  /** Unique run identifier */
  runId: string;
  /** Workflow ID */
  workflowId: string;
  /** Current run status */
  status: RunStatus;
  /** Current stage being executed */
  currentStage?: string;
  /** Current iteration number */
  iteration: number;
  /** Shared execution context */
  context: ExecutionContext;
  /** Results from completed stages */
  stageResults: Record<string, StageResult>;
  /** Run start timestamp */
  startedAt: string;
  /** Run completion timestamp */
  completedAt?: string;
  /** Error message if failed */
  lastError?: string;
}

/** Options for starting a workflow run */
export interface WorkflowRunOptions {
  /** Input variables for the workflow */
  vars?: Record<string, any>;
  /** Execution mode: assisted, headless, or auto */
  mode?: 'assisted' | 'headless' | 'auto';
  /** Enable interactive mode (with TUI) */
  interactive?: boolean;
  /** Override failure strategy for all stages */
  on_failure?: FailureStrategy;
  /** Maximum iterations override */
  max_iters?: number;
}

export interface IpcResponse<T = void> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  errors?: Array<{ path: string[]; message: string }>;
}

export interface CreateOrderParams {
  workflowId?: string; // Optional for backward compatibility
  workflowName?: string; // Optional for backward compatibility
  counter: string;
  provider: ProviderType;
  vars: Record<string, any>;
  // @deprecated Legacy fields for backward compatibility
  recipeId?: string;
  recipeName?: string;
}

export interface CreateOrderWithWorktreeParams {
  cafeId: string;
  workflowId: string;
  workflowName: string;
  provider?: string; // Provider는 이제 workflow의 stageConfigs에서 결정됨 (선택적)
  vars?: Record<string, string>;
  createWorktree: boolean;
  worktreeOptions?: {
    baseBranch?: string;
    branchPrefix?: string;
  };
}

export interface CreateOrderWithWorktreeResult {
  order: Order;
  worktree?: {
    path: string;
    branch: string;
  };
}

export interface ProviderInfo {
  id: ProviderType;
  name: string;
}

export interface StageAssignment {
  provider: string;
  role?: string;
  profile?: string;
}

export interface WorkflowInfo {
  id: string;
  name: string;
  description?: string;
  stages: string[];
  // Stage별 provider 설정 (workflow 내에 정의된 경우)
  stageAssignments?: Record<string, StageAssignment>;
}

export interface RunProgress {
  runId: string;
  workflowId: string;
  currentStage: string;
  currentIter: number;
  status: RunStatus;
  createdAt?: string;
  updatedAt?: string;
  stages: Array<{
    name: string;
    status: StageStatus;
    startTime?: string;
    endTime?: string;
  }>;
  completedNodes: string[];
  lastError?: string;
}

export interface RunLogEntry {
  type: string;
  message: string;
  timestamp: string;
  stage?: string;
  nodeId?: string;
}

export interface ProviderAssignmentInfo {
  stage: string;
  provider: string;
  role: string;
  profile: string;
}

declare global {
  interface Window {
    codecafe: {
      // Phase 1: Cafe Management
      cafe: {
        list: () => Promise<IpcResponse<Cafe[]>>;
        get: (id: string) => Promise<IpcResponse<Cafe | null>>;
        create: (params: CreateCafeParams) => Promise<IpcResponse<Cafe>>;
        update: (id: string, params: UpdateCafeParams) => Promise<IpcResponse<Cafe>>;
        delete: (id: string) => Promise<IpcResponse<void>>;
        setLastAccessed: (id: string) => Promise<IpcResponse<void>>;
        getLastAccessed: () => Promise<IpcResponse<Cafe | null>>;
      };

      // Barista 관리
      createBarista: (provider: ProviderType) => Promise<IpcResponse<Barista>>;
      getAllBaristas: () => Promise<IpcResponse<Barista[]>>;

      // Order 관리 (Namespace)
      order: {
        create: (params: CreateOrderParams) => Promise<IpcResponse<Order>>;
        getAll: () => Promise<IpcResponse<Order[]>>;
        get: (orderId: string) => Promise<IpcResponse<Order>>;
        getLog: (orderId: string) => Promise<IpcResponse<string>>;
        cancel: (orderId: string) => Promise<IpcResponse<void>>;
        createWithWorktree: (
          params: CreateOrderWithWorktreeParams
        ) => Promise<IpcResponse<CreateOrderWithWorktreeResult>>;
        subscribeOutput: (orderId: string) => Promise<IpcResponse<{ subscribed: boolean }>>;
        unsubscribeOutput: (orderId: string) => Promise<IpcResponse<{ unsubscribed: boolean }>>;
        onEvent: (callback: (event: any) => void) => void;
        onAssigned: (callback: (data: any) => void) => void;
        onCompleted: (callback: (data: any) => void) => void;
        onOutput: (callback: (event: any) => void) => () => void;
      };

      // Order 관리 (Legacy flat API - backward compatibility)
      createOrder: (params: CreateOrderParams) => Promise<IpcResponse<Order>>;
      getAllOrders: () => Promise<IpcResponse<Order[]>>;
      getOrder: (orderId: string) => Promise<IpcResponse<Order>>;
      getOrderLog: (orderId: string) => Promise<IpcResponse<string>>;
      cancelOrder: (orderId: string) => Promise<IpcResponse<void>>;

      // Receipt
      getReceipts: () => Promise<IpcResponse<Receipt[]>>;

      // Provider
      getAvailableProviders: () => Promise<IpcResponse<ProviderInfo[]>>;

      // Worktree - Using standardized IpcResponse
      listWorktrees: (repoPath: string) => Promise<IpcResponse<WorktreeInfo[]>>;
      exportPatch: (
        worktreePath: string,
        baseBranch: string,
        outputPath?: string
      ) => Promise<IpcResponse<string>>;
      removeWorktree: (
        worktreePath: string,
        force?: boolean
      ) => Promise<IpcResponse<void>>;
      openWorktreeFolder: (worktreePath: string) => Promise<IpcResponse<void>>;

      // Workflow Management
      workflow: {
        list: () => Promise<IpcResponse<WorkflowInfo[]>>;
        get: (workflowId: string) => Promise<IpcResponse<WorkflowInfo | null>>;
        create: (workflowData: WorkflowInfo) => Promise<IpcResponse<WorkflowInfo>>;
        update: (workflowData: WorkflowInfo) => Promise<IpcResponse<WorkflowInfo>>;
        delete: (workflowId: string) => Promise<IpcResponse<{ success: boolean }>>;
        run: (
          workflowId: string,
          options?: WorkflowRunOptions
        ) => Promise<IpcResponse<{ runId: string }>>;
      };

      // Skill Management (단일 스킬 관리)
      skill: {
        list: () => Promise<IpcResponse<Skill[]>>;
        get: (skillId: string) => Promise<IpcResponse<Skill | null>>;
        create: (skillData: Skill) => Promise<IpcResponse<Skill>>;
        update: (skillData: Skill) => Promise<IpcResponse<Skill>>;
        delete: (skillId: string) => Promise<IpcResponse<{ success: boolean }>>;
        duplicate: (skillId: string, newId: string, newName?: string) => Promise<IpcResponse<Skill>>;
      };

      // Skill Preset Management (프리셋 관리 - 여러 스킬을 그룹화)
      skillPreset: {
        list: () => Promise<IpcResponse<SkillPreset[]>>;
        get: (presetId: string) => Promise<IpcResponse<SkillPreset | null>>;
        create: (presetData: SkillPreset) => Promise<IpcResponse<SkillPreset>>;
        update: (presetData: SkillPreset) => Promise<IpcResponse<SkillPreset>>;
        delete: (presetId: string) => Promise<IpcResponse<{ success: boolean }>>;
      };

      // Orchestrator (Run Management)
      run: {
        list: () => Promise<IpcResponse<RunProgress[]>>;
        getStatus: (runId: string) => Promise<IpcResponse<RunProgress | null>>;
        getDetail: (runId: string) => Promise<IpcResponse<WorkflowRunDetail | null>>;
        pause: (runId: string) => Promise<IpcResponse<void>>;
        resume: (runId: string) => Promise<IpcResponse<void>>;
        cancel: (runId: string) => Promise<IpcResponse<void>>;
        getLogs: (runId: string) => Promise<IpcResponse<RunLogEntry[]>>;
        onEvent: (callback: (event: any) => void) => void;
      };

      // Config
      config: {
        assignments: {
          get: () => Promise<IpcResponse<ProviderAssignmentInfo[]>>;
          set: (stage: string, provider: string, role: string) => Promise<IpcResponse<void>>;
        };
        profiles: {
          list: (stage: string) => Promise<IpcResponse<string[]>>;
          set: (stage: string, profile: string) => Promise<IpcResponse<void>>;
        };
        roles: {
          list: () => Promise<IpcResponse<string[]>>;
        };
      };

      // Role Management (re-namespaced)
      role: {
        list: () => Promise<IpcResponse<Role[]>>;
        get: (id: string) => Promise<IpcResponse<Role>>;
        listDefault: () => Promise<IpcResponse<Role[]>>;
        listUser: () => Promise<IpcResponse<Role[]>>;
        reload: () => Promise<IpcResponse<void>>;
      };

      // Event Listeners - No change for callbacks
      onBaristaEvent: (callback: (event: any) => void) => void;
      onOrderEvent: (callback: (event: any) => void) => void;
      onOrderAssigned: (callback: (data: any) => void) => void;
      onOrderCompleted: (callback: (data: any) => void) => void;
    };

    // Phase 2: Role and Terminal APIs (separate namespace)
    api: {
      role: {
        list: () => Promise<IpcResponse<Role[]>>;
        get: (id: string) => Promise<IpcResponse<Role>>;
        listDefault: () => Promise<IpcResponse<Role[]>>;
        listUser: () => Promise<IpcResponse<Role[]>>;
        reload: () => Promise<IpcResponse<void>>;
      };

      terminal: {
        init: (config: TerminalPoolConfig) => Promise<IpcResponse<void>>;
        getStatus: () => Promise<IpcResponse<PoolStatus>>;
        getMetrics: () => Promise<IpcResponse<PoolMetrics>>;
        subscribe: (terminalId: string) => Promise<IpcResponse<void>>;
        unsubscribe: (terminalId: string) => Promise<IpcResponse<void>>;
        shutdown: () => Promise<IpcResponse<void>>;
        onData: (terminalId: string, callback: (data: string) => void) => () => void;
      };
    };
  }
}

export {};
