/**
 * IPC Types for Preload Bridge
 * Type definitions for all IPC channels between main and renderer processes
 */

// ============================================================================
// Re-export core types
// ============================================================================

export type {
  Cafe,
  CafeRegistry,
  CreateCafeParams,
  UpdateCafeParams,
  CafeSettings,
} from '@codecafe/core';

export {
  BaristaStatus,
  OrderStatus,
  EventType,
} from '@codecafe/core';

export type {
  Barista,
  Order,
  Receipt,
  ProviderType,
  BaristaEvent,
  OrderEvent,
} from '@codecafe/core';

export type {
  WorktreeInfo,
  WorktreeMergeOptions,
  MergeResult,
} from '@codecafe/git-worktree';

// ============================================================================
// IPC Response Types
// ============================================================================

/**
 * Standardized IPC Response wrapper
 */
export interface IpcResponse<T = void> {
  success: boolean;
  data?: T;
  error?: IpcErrorInfo;
}

export interface IpcErrorInfo {
  code: string;
  message: string;
  details?: unknown;
}

// ============================================================================
// Order Event Types (for IPC listeners)
// ============================================================================

/**
 * Output event data sent via order:output channel
 */
export interface OutputEvent {
  orderId: string;
  timestamp: string;
  type: 'stdout' | 'stderr' | 'system' | 'user-input' | 'thinking' | 'tool-use' | 'tool-result';
  content: string;
}

/**
 * Output history item returned from subscribeOutput
 */
export interface OutputHistoryItem {
  orderId: string;
  timestamp: string;
  type: string;
  content: string;
}

/**
 * Session started event data
 */
export interface SessionStartedEvent {
  sessionId: string;
  orderId: string;
  workflowId: string;
  timestamp: string;
}

/**
 * Session completed event data
 */
export interface SessionCompletedEvent {
  sessionId: string;
  orderId: string;
  duration: number;
  status: 'completed' | 'failed' | 'cancelled';
  timestamp: string;
}

/**
 * Session failed event data
 */
export interface SessionFailedEvent {
  sessionId: string;
  orderId: string;
  error: string;
  canRetry: boolean;
  timestamp: string;
}

/**
 * Stage started event data
 */
export interface StageStartedEvent {
  sessionId: string;
  orderId: string;
  stageId: string;
  stageName: string;
  stageIndex: number;
  timestamp: string;
}

/**
 * Stage completed event data
 */
export interface StageCompletedEvent {
  sessionId: string;
  orderId: string;
  stageId: string;
  stageName: string;
  status: 'completed' | 'failed' | 'skipped';
  duration: number;
  output?: unknown;
  timestamp: string;
}

/**
 * Stage failed event data
 */
export interface StageFailedEvent {
  sessionId: string;
  orderId: string;
  stageId: string;
  stageName: string;
  error: string;
  canRetry: boolean;
  timestamp: string;
}

/**
 * Awaiting input event data
 */
export interface AwaitingInputEvent {
  sessionId: string;
  orderId: string;
  stageId: string;
  questions?: string[];
  message?: string;
  timestamp: string;
}

/**
 * Todo progress event data (from Claude's TodoWrite)
 */
export interface TodoProgressEvent {
  orderId: string;
  todos: Array<{
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
    activeForm: string;
  }>;
  timestamp: string;
}

/**
 * Order status changed event data
 */
export interface StatusChangedEvent {
  orderId: string;
  previousStatus: string;
  newStatus: string;
  timestamp: string;
}

/**
 * Followup started event data
 */
export interface FollowupStartedEvent {
  sessionId: string;
  orderId: string;
  prompt: string;
  timestamp: string;
}

/**
 * Followup completed event data
 */
export interface FollowupCompletedEvent {
  sessionId: string;
  orderId: string;
  stageId: string;
  output?: string;
  timestamp: string;
}

/**
 * Followup failed event data
 */
export interface FollowupFailedEvent {
  sessionId: string;
  orderId: string;
  stageId?: string;
  error: string;
  timestamp: string;
}

/**
 * Followup finished event data
 */
export interface FollowupFinishedEvent {
  sessionId: string;
  orderId: string;
  timestamp: string;
}

/**
 * Order assigned event data
 */
export interface OrderAssignedEvent {
  orderId: string;
  baristaId: string;
  timestamp?: string;
}

/**
 * Order completed event data
 */
export interface OrderCompletedEvent {
  orderId: string;
  status: string;
  timestamp?: string;
}

/**
 * Order failed event data
 */
export interface OrderFailedEvent {
  orderId: string;
  error: string;
  timestamp?: string;
}

// ============================================================================
// Order Request/Response Types
// ============================================================================

/**
 * Create order with worktree params
 */
export interface CreateOrderWithWorktreeParams {
  cafeId: string;
  workflowId: string;
  workflowName: string;
  provider?: ProviderType;
  vars?: Record<string, string>;
  createWorktree: boolean;
  worktreeOptions?: {
    baseBranch?: string;
    branchPrefix?: string;
  };
}

/**
 * Create order with worktree result
 */
export interface CreateOrderWithWorktreeResult {
  order: Order;
  worktree?: {
    path: string;
    branch: string;
  };
}

/**
 * Subscribe output result
 */
export interface SubscribeOutputResult {
  subscribed: boolean;
  history: OutputHistoryItem[];
}

/**
 * Retry options for failed order
 */
export interface RetryOptions {
  orderId: string;
  canRetryFromStage: boolean;
  canRetryFromBeginning: boolean;
  availableStages?: Array<{
    stageId: string;
    stageName: string;
    status: string;
  }>;
  lastFailedStage?: string;
}

/**
 * Cleanup worktree only result
 */
export interface CleanupWorktreeOnlyResult {
  success: boolean;
  branch: string;
  message: string;
}

// ============================================================================
// Workflow Types
// ============================================================================

/**
 * Stage assignment configuration
 */
export interface StageAssignment {
  provider: string;
  role?: string;
  profile?: string;
  mode?: 'sequential' | 'parallel';
  on_failure?: 'stop' | 'continue' | 'retry';
  retries?: number;
  retry_backoff?: number;
  skills?: string[];
  prompt?: string;
}

/**
 * Workflow info
 */
export interface WorkflowInfo {
  id: string;
  name: string;
  description?: string;
  stages: string[];
  stageConfigs?: Record<string, StageAssignment>;
  isDefault?: boolean;
  protected?: boolean;
}

/**
 * Workflow run options
 */
export interface WorkflowRunOptions {
  mode?: 'assisted' | 'headless' | 'auto';
  vars?: Record<string, string>;
}

// ============================================================================
// Skill Types
// ============================================================================

export type SkillCategory = 'analysis' | 'planning' | 'implementation' | 'verification' | 'utility';

/**
 * Skill definition
 */
export interface Skill {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  skillCommand: string;
  context?: 'fork' | 'inherit';
  isBuiltIn?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// Run Types
// ============================================================================

export type RunStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

/**
 * Run info (summary)
 */
export interface RunInfo {
  runId: string;
  workflowId: string;
  currentStage?: string;
  currentIter?: number;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
  completedNodes: string[];
  lastError?: string;
}

/**
 * Run log entry
 */
export interface RunLogEntry {
  type: string;
  message: string;
  timestamp: string;
  stage?: string;
  nodeId?: string;
}

// ============================================================================
// System Types
// ============================================================================

/**
 * Environment check result
 */
export interface EnvironmentCheckResult {
  git: {
    installed: boolean;
    version?: string;
  };
  node: {
    installed: boolean;
    version?: string;
  };
  pnpm: {
    installed: boolean;
    version?: string;
  };
}

/**
 * Git repo status
 */
export interface GitRepoStatus {
  isGitRepo: boolean;
  hasRemote: boolean;
  remoteName?: string;
  remoteUrl?: string;
  currentBranch?: string;
}

// ============================================================================
// Dialog Types
// ============================================================================

/**
 * File selection options
 */
export interface FileSelectionOptions {
  filters?: Array<{
    name: string;
    extensions: string[];
  }>;
}

// ============================================================================
// Terminal Types
// ============================================================================

export type { PoolStatus, PoolMetrics, TerminalPoolConfig } from '@codecafe/core';

// ============================================================================
// IPC Channel Maps
// ============================================================================

/**
 * IPC Invoke channel definitions
 * Maps channel names to their request/response types
 */
export interface IpcInvokeChannels {
  // Cafe
  'cafe:list': { request: void; response: IpcResponse<Cafe[]> };
  'cafe:get': { request: string; response: IpcResponse<Cafe | null> };
  'cafe:create': { request: CreateCafeParams; response: IpcResponse<Cafe> };
  'cafe:update': { request: [string, UpdateCafeParams]; response: IpcResponse<Cafe> };
  'cafe:delete': { request: string; response: IpcResponse<void> };
  'cafe:setLastAccessed': { request: string; response: IpcResponse<void> };
  'cafe:getLastAccessed': { request: void; response: IpcResponse<Cafe | null> };

  // Barista
  'barista:create': { request: ProviderType; response: IpcResponse<Barista> };
  'barista:getAll': { request: void; response: IpcResponse<Barista[]> };

  // Order
  'order:create': {
    request: {
      workflowId: string;
      workflowName: string;
      counter: string;
      provider?: ProviderType;
      vars?: Record<string, string>;
    };
    response: IpcResponse<Order>;
  };
  'order:getAll': { request: void; response: IpcResponse<Order[]> };
  'order:get': { request: string; response: IpcResponse<Order | null> };
  'order:getLog': { request: string; response: IpcResponse<string | null> };
  'order:cancel': { request: string; response: IpcResponse<{ cancelled: boolean }> };
  'order:delete': { request: string; response: IpcResponse<{ deleted: boolean }> };
  'order:deleteMany': { request: string[]; response: IpcResponse<{ deleted: string[] }> };
  'order:execute': {
    request: [string, string, Record<string, string>?];
    response: IpcResponse<{ started: boolean }>;
  };
  'order:sendInput': { request: [string, string]; response: IpcResponse<{ sent: boolean }> };
  'order:createWithWorktree': {
    request: CreateOrderWithWorktreeParams;
    response: IpcResponse<CreateOrderWithWorktreeResult>;
  };
  'order:subscribeOutput': { request: string; response: IpcResponse<SubscribeOutputResult> };
  'order:unsubscribeOutput': { request: string; response: IpcResponse<{ unsubscribed: boolean }> };
  'order:retryFromStage': {
    request: { orderId: string; fromStageId?: string };
    response: IpcResponse<{ started: boolean }>;
  };
  'order:retryFromBeginning': {
    request: { orderId: string; preserveContext?: boolean };
    response: IpcResponse<{ started: boolean }>;
  };
  'order:getRetryOptions': { request: string; response: IpcResponse<RetryOptions | null> };
  'order:enterFollowup': { request: string; response: IpcResponse<{ success: boolean }> };
  'order:executeFollowup': { request: [string, string]; response: IpcResponse<{ started: boolean }> };
  'order:finishFollowup': { request: string; response: IpcResponse<{ success: boolean }> };
  'order:canFollowup': { request: string; response: IpcResponse<{ canFollowup: boolean }> };
  'order:cleanupWorktreeOnly': { request: string; response: IpcResponse<CleanupWorktreeOnlyResult> };
  'order:mergeWorktreeToMain': {
    request: { orderId: string; targetBranch?: string; deleteAfterMerge?: boolean; squash?: boolean };
    response: IpcResponse<MergeResult>;
  };

  // Receipt
  'receipt:getAll': { request: void; response: IpcResponse<Receipt[]> };

  // Provider
  'provider:getAvailable': { request: void; response: IpcResponse<ProviderType[]> };

  // Worktree
  'worktree:list': { request: string; response: IpcResponse<WorktreeInfo[]> };
  'worktree:exportPatch': {
    request: [string, string, string?];
    response: IpcResponse<string>;
  };
  'worktree:remove': { request: [string, string, boolean?]; response: IpcResponse<{ success: boolean }> };
  'worktree:openFolder': { request: string; response: IpcResponse<{ success: boolean }> };
  'worktree:mergeToTarget': { request: WorktreeMergeOptions; response: MergeResult };
  'worktree:removeOnly': { request: [string, string]; response: void };

  // Workflow
  'workflow:list': { request: void; response: IpcResponse<WorkflowInfo[]> };
  'workflow:get': { request: string; response: IpcResponse<WorkflowInfo> };
  'workflow:create': { request: WorkflowInfo; response: IpcResponse<WorkflowInfo> };
  'workflow:update': { request: WorkflowInfo; response: IpcResponse<WorkflowInfo> };
  'workflow:delete': { request: string; response: IpcResponse<{ success: boolean }> };
  'workflow:run': { request: [string, WorkflowRunOptions?]; response: IpcResponse<{ runId: string }> };

  // Skill
  'skill:list': { request: void; response: IpcResponse<Skill[]> };
  'skill:get': { request: string; response: IpcResponse<Skill> };
  'skill:create': { request: Skill; response: IpcResponse<Skill> };
  'skill:update': { request: Skill; response: IpcResponse<Skill> };
  'skill:delete': { request: string; response: IpcResponse<{ success: boolean }> };
  'skill:duplicate': { request: [string, string, string?]; response: IpcResponse<Skill> };

  // Run
  'run:list': { request: void; response: IpcResponse<RunInfo[]> };
  'run:status': { request: string; response: IpcResponse<RunInfo | null> };
  'run:resume': { request: string; response: IpcResponse<void> };
  'run:logs': { request: string; response: IpcResponse<RunLogEntry[]> };

  // Terminal
  'terminal:init': { request: TerminalPoolConfig; response: IpcResponse<void> };
  'terminal:poolStatus': { request: void; response: IpcResponse<PoolStatus> };
  'terminal:poolMetrics': { request: void; response: IpcResponse<PoolMetrics> };
  'terminal:subscribe': { request: string; response: IpcResponse<void> };
  'terminal:unsubscribe': { request: string; response: IpcResponse<void> };
  'terminal:shutdown': { request: void; response: IpcResponse<void> };

  // Dialog
  'dialog:selectFolder': { request: void; response: IpcResponse<string | null> };
  'dialog:selectFile': { request: FileSelectionOptions | undefined; response: IpcResponse<string | null> };

  // System
  'system:checkEnvironment': { request: void; response: IpcResponse<EnvironmentCheckResult> };
  'system:checkGitRepo': { request: string; response: IpcResponse<GitRepoStatus> };
  'system:gitInit': { request: string; response: IpcResponse<void> };
}

/**
 * IPC Event channel definitions
 * Maps channel names to their event data types
 */
export interface IpcEventChannels {
  'barista:event': BaristaEvent;
  'order:event': OrderEvent;
  'order:assigned': OrderAssignedEvent;
  'order:completed': OrderCompletedEvent;
  'order:failed': OrderFailedEvent;
  'order:output': OutputEvent;
  'order:session-started': SessionStartedEvent;
  'order:session-completed': SessionCompletedEvent;
  'order:session-failed': SessionFailedEvent;
  'order:stage-started': StageStartedEvent;
  'order:stage-completed': StageCompletedEvent;
  'order:stage-failed': StageFailedEvent;
  'order:awaiting-input': AwaitingInputEvent;
  'order:todo-progress': TodoProgressEvent;
  'order:status-changed': StatusChangedEvent;
  'order:followup': FollowupStartedEvent;
  'order:followup-started': FollowupStartedEvent;
  'order:followup-completed': FollowupCompletedEvent;
  'order:followup-failed': FollowupFailedEvent;
  'order:followup-finished': FollowupFinishedEvent;
}

// ============================================================================
// Type Helpers
// ============================================================================

/**
 * Extract the request type for a given IPC channel
 */
export type IpcRequest<C extends keyof IpcInvokeChannels> = IpcInvokeChannels[C]['request'];

/**
 * Extract the response type for a given IPC channel
 */
export type IpcResponseType<C extends keyof IpcInvokeChannels> = IpcInvokeChannels[C]['response'];

/**
 * Extract the event data type for a given event channel
 */
export type IpcEventData<C extends keyof IpcEventChannels> = IpcEventChannels[C];

// Import ProviderType, Cafe, Order, etc. for type references
import type { Cafe, Barista, Order, Receipt, ProviderType, BaristaEvent, OrderEvent, CreateCafeParams, UpdateCafeParams } from '@codecafe/core';
import type { WorktreeInfo, WorktreeMergeOptions, MergeResult } from '@codecafe/git-worktree';
import type { PoolStatus, PoolMetrics, TerminalPoolConfig } from '@codecafe/core';
