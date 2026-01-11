import type {
  Barista,
  Order,
  Recipe,
  ProviderType,
  WorktreeInfo,
  Receipt,
} from './models';

export interface IpcResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Array<{ path: string[]; message: string }>;
}

export interface CreateOrderParams {
  recipeId: string;
  recipeName: string;
  counter: string;
  provider: ProviderType;
  vars: Record<string, any>;
}

export interface ProviderInfo {
  id: ProviderType;
  name: string;
}

export type StageStatus = 'pending' | 'running' | 'completed' | 'failed';
export type RunStatus = 'running' | 'completed' | 'failed' | 'paused';

export interface WorkflowInfo {
  id: string;
  name: string;
  description?: string;
  stages: string[];
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
      // Barista 관리
      createBarista: (provider: ProviderType) => Promise<Barista>;
      getAllBaristas: () => Promise<Barista[]>;

      // Order 관리
      createOrder: (params: CreateOrderParams) => Promise<Order>;
      getAllOrders: () => Promise<Order[]>;
      getOrder: (orderId: string) => Promise<Order>;
      getOrderLog: (orderId: string) => Promise<string>;
      cancelOrder: (orderId: string) => Promise<void>;

      // Receipt
      getReceipts: () => Promise<Receipt[]>;

      // Provider
      getAvailableProviders: () => Promise<ProviderInfo[]>;

      // Worktree
      listWorktrees: (repoPath: string) => Promise<IpcResult<WorktreeInfo[]>>;
      exportPatch: (
        worktreePath: string,
        baseBranch: string,
        outputPath?: string
      ) => Promise<IpcResult<string>>;
      removeWorktree: (
        worktreePath: string,
        force?: boolean
      ) => Promise<IpcResult<void>>;
      openWorktreeFolder: (worktreePath: string) => Promise<void>;

      // Recipe
      listRecipes: () => Promise<IpcResult<string[]>>;
      getRecipe: (recipeName: string) => Promise<IpcResult<Recipe>>;
      saveRecipe: (
        recipeName: string,
        recipeData: Recipe
      ) => Promise<IpcResult<void>>;
      validateRecipe: (recipeData: Recipe) => Promise<IpcResult<void>>;
      deleteRecipe: (recipeName: string) => Promise<IpcResult<void>>;

      // Orchestrator
      listWorkflows: () => Promise<WorkflowInfo[]>;
      getWorkflow: (workflowId: string) => Promise<WorkflowInfo | null>;
      runWorkflow: (
        workflowId: string,
        options?: { mode?: string; interactive?: boolean }
      ) => Promise<string>;
      listRuns: () => Promise<RunProgress[]>;
      getRunStatus: (runId: string) => Promise<RunProgress | null>;
      resumeRun: (runId: string) => Promise<void>;
      getRunLogs: (runId: string) => Promise<RunLogEntry[]>;
      getAssignments: () => Promise<ProviderAssignmentInfo[]>;
      setAssignment: (stage: string, provider: string, role: string) => Promise<void>;
      listProfiles: (stage: string) => Promise<string[]>;
      setProfile: (stage: string, profile: string) => Promise<void>;
      listRoles: () => Promise<string[]>;

      // Event Listeners
      onBaristaEvent: (callback: (event: any) => void) => void;
      onOrderEvent: (callback: (event: any) => void) => void;
      onOrderAssigned: (callback: (data: any) => void) => void;
      onOrderCompleted: (callback: (data: any) => void) => void;
    };
  }
}

export {};
