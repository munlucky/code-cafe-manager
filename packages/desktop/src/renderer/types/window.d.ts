import type {
  Barista,
  Order,
  ProviderType,
  WorktreeInfo,
  Receipt,
} from './models';
import type { Cafe, CreateCafeParams, UpdateCafeParams } from '@codecafe/core';
// import type { Role, TerminalPoolConfig, PoolStatus } from '@codecafe/core/types';

// Temporary types for compilation
interface Role {
  id: string;
  name: string;
  systemPrompt: string;
  skills: string[];
  recommendedProvider: string;
  variables: any[];
  isDefault: boolean;
  source: string;
}
interface TerminalPoolConfig {
  maxTerminals: number;
  idleTimeout: number;
}
interface PoolStatus {
  totalTerminals: number;
  activeTerminals: number;
  idleTerminals: number;
  maxTerminals: number;
}

export interface IpcResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Array<{ path: string[]; message: string }>;
}

// Phase 2: IpcResponse for Role/Terminal APIs
export interface IpcResponse<T = void> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
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
        list: () => Promise<Cafe[]>;
        get: (id: string) => Promise<Cafe | null>;
        create: (params: CreateCafeParams) => Promise<Cafe>;
        update: (id: string, params: UpdateCafeParams) => Promise<Cafe>;
        delete: (id: string) => Promise<void>;
        setLastAccessed: (id: string) => Promise<void>;
        getLastAccessed: () => Promise<Cafe | null>;
      };

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
        subscribe: (terminalId: string) => Promise<IpcResponse<void>>;
        unsubscribe: (terminalId: string) => Promise<IpcResponse<void>>;
        shutdown: () => Promise<IpcResponse<void>>;
        onData: (terminalId: string, callback: (data: string) => void) => () => void;
      };
    };
  }
}

export {};
