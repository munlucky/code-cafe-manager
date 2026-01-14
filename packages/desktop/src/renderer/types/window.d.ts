import type {
  Barista,
  Order,
  ProviderType,
  WorktreeInfo,
  Receipt,
} from './models';
import type { Cafe, CreateCafeParams, UpdateCafeParams, Role } from '@codecafe/core';
import type { TerminalPoolConfig, PoolStatus, PoolMetrics } from '@codecafe/core';

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

      // Order 관리
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

      // Orchestrator - Using standardized IpcResponse
      listWorkflows: () => Promise<IpcResponse<WorkflowInfo[]>>;
      getWorkflow: (workflowId: string) => Promise<IpcResponse<WorkflowInfo | null>>;
      runWorkflow: (
        workflowId: string,
        options?: { mode?: string; interactive?: boolean }
      ) => Promise<IpcResponse<string>>;
      listRuns: () => Promise<IpcResponse<RunProgress[]>>;
      getRunStatus: (runId: string) => Promise<IpcResponse<RunProgress | null>>;
      resumeRun: (runId: string) => Promise<IpcResponse<void>>;
      getRunLogs: (runId: string) => Promise<IpcResponse<RunLogEntry[]>>;
      getAssignments: () => Promise<IpcResponse<ProviderAssignmentInfo[]>>;
      setAssignment: (stage: string, provider: string, role: string) => Promise<IpcResponse<void>>;
      listProfiles: (stage: string) => Promise<IpcResponse<string[]>>;
      setProfile: (stage: string, profile: string) => Promise<IpcResponse<void>>;
      listRoles: () => Promise<IpcResponse<string[]>>;

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
