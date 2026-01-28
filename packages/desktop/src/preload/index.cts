/**
 * Preload Script (CommonJS)
 * Exposes IPC handlers to renderer process via contextBridge
 */

const { contextBridge, ipcRenderer, IpcRendererEvent } = require('electron');

// ============================================================================
// Type Definitions for Preload Bridge
// ============================================================================

// IPC Response Types
interface IpcResponse<T = void> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Event Data Types
interface BaristaEvent {
  type: string;
  timestamp: Date;
  baristaId: string;
  data: unknown;
}

interface OrderEvent {
  type: string;
  timestamp: Date;
  orderId: string;
  data: unknown;
}

interface OutputEvent {
  orderId: string;
  timestamp: string;
  type: string;
  content: string;
}

interface OrderAssignedEvent {
  orderId: string;
  baristaId: string;
  timestamp?: string;
}

interface OrderCompletedEvent {
  orderId: string;
  status: string;
  timestamp?: string;
}

interface OrderFailedEvent {
  orderId: string;
  error: string;
  timestamp?: string;
}

interface SessionStartedEvent {
  sessionId: string;
  orderId: string;
  workflowId: string;
  timestamp: string;
}

interface SessionCompletedEvent {
  sessionId: string;
  orderId: string;
  duration: number;
  status: string;
  timestamp: string;
}

interface SessionFailedEvent {
  sessionId: string;
  orderId: string;
  error: string;
  canRetry: boolean;
  timestamp: string;
}

interface StageStartedEvent {
  sessionId: string;
  orderId: string;
  stageId: string;
  stageName: string;
  stageIndex: number;
  timestamp: string;
}

interface StageCompletedEvent {
  sessionId: string;
  orderId: string;
  stageId: string;
  stageName: string;
  status: string;
  duration: number;
  output?: unknown;
  timestamp: string;
}

interface StageFailedEvent {
  sessionId: string;
  orderId: string;
  stageId: string;
  stageName: string;
  error: string;
  canRetry: boolean;
  timestamp: string;
}

interface AwaitingInputEvent {
  sessionId: string;
  orderId: string;
  stageId: string;
  questions?: string[];
  message?: string;
  timestamp: string;
}

interface TodoProgressEvent {
  orderId: string;
  todos: Array<{
    content: string;
    status: string;
    activeForm: string;
  }>;
  timestamp: string;
}

interface StatusChangedEvent {
  orderId: string;
  previousStatus: string;
  newStatus: string;
  timestamp: string;
}

interface FollowupStartedEvent {
  sessionId: string;
  orderId: string;
  prompt: string;
  timestamp: string;
}

interface FollowupCompletedEvent {
  sessionId: string;
  orderId: string;
  stageId: string;
  output?: string;
  timestamp: string;
}

interface FollowupFailedEvent {
  sessionId: string;
  orderId: string;
  stageId?: string;
  error: string;
  timestamp: string;
}

interface FollowupFinishedEvent {
  sessionId: string;
  orderId: string;
  timestamp: string;
}

// IPC Channel type (string literal union for common channels)
type IpcChannel = string;

// Generic callback type for IPC listeners
type IpcEventCallback<T> = (event: T) => void;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Helper to create IPC invoke functions with type safety
 * Returns a function that invokes the IPC channel with provided arguments
 */
function createIpcInvoker<TArgs extends unknown[], TResponse>(
  channel: IpcChannel
): (...args: TArgs) => Promise<TResponse> {
  return (...args: TArgs) => ipcRenderer.invoke(channel, ...args);
}

/**
 * Helper to manage IPC event listeners with type safety
 * Returns cleanup function to remove the listener
 */
function setupIpcListener<T>(
  channel: IpcChannel,
  callback: IpcEventCallback<T>
): () => void {
  const listener = (_: typeof IpcRendererEvent, event: T): void => callback(event);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

// ============================================================================
// CodeCafe API Bridge
// ============================================================================

contextBridge.exposeInMainWorld('codecafe', {
  cafe: {
    list: createIpcInvoker<[], IpcResponse<unknown[]>>('cafe:list'),
    get: createIpcInvoker<[string], IpcResponse<unknown>>('cafe:get'),
    create: createIpcInvoker<[unknown], IpcResponse<unknown>>('cafe:create'),
    update: createIpcInvoker<[string, unknown], IpcResponse<unknown>>('cafe:update'),
    delete: createIpcInvoker<[string], IpcResponse<void>>('cafe:delete'),
    setLastAccessed: createIpcInvoker<[string], IpcResponse<void>>('cafe:setLastAccessed'),
    getLastAccessed: createIpcInvoker<[], IpcResponse<unknown>>('cafe:getLastAccessed'),
  },

  barista: {
    create: createIpcInvoker<[string], IpcResponse<unknown>>('barista:create'),
    getAll: createIpcInvoker<[], IpcResponse<unknown[]>>('barista:getAll'),
    onEvent: (callback: IpcEventCallback<BaristaEvent>) => setupIpcListener('barista:event', callback),
  },

  order: {
    create: createIpcInvoker<[unknown], IpcResponse<unknown>>('order:create'),
    getAll: createIpcInvoker<[], IpcResponse<unknown[]>>('order:getAll'),
    get: createIpcInvoker<[string], IpcResponse<unknown>>('order:get'),
    getLog: createIpcInvoker<[string], IpcResponse<string | null>>('order:getLog'),
    cancel: createIpcInvoker<[string], IpcResponse<{ cancelled: boolean }>>('order:cancel'),
    delete: createIpcInvoker<[string], IpcResponse<{ deleted: boolean }>>('order:delete'),
    deleteMany: createIpcInvoker<[string[]], IpcResponse<{ deleted: string[] }>>('order:deleteMany'),
    execute: createIpcInvoker<[string, string, Record<string, string>?], IpcResponse<{ started: boolean }>>('order:execute'),
    sendInput: createIpcInvoker<[string, string], IpcResponse<{ sent: boolean }>>('order:sendInput'),
    createWithWorktree: createIpcInvoker<[unknown], IpcResponse<unknown>>('order:createWithWorktree'),
    subscribeOutput: createIpcInvoker<[string], IpcResponse<{ subscribed: boolean; history: unknown[] }>>('order:subscribeOutput'),
    unsubscribeOutput: createIpcInvoker<[string], IpcResponse<{ unsubscribed: boolean }>>('order:unsubscribeOutput'),
    // Retry support
    retryFromStage: createIpcInvoker<[{ orderId: string; fromStageId?: string }], IpcResponse<{ started: boolean }>>('order:retryFromStage'),
    retryFromBeginning: createIpcInvoker<[{ orderId: string; preserveContext?: boolean }], IpcResponse<{ started: boolean }>>('order:retryFromBeginning'),
    getRetryOptions: createIpcInvoker<[string], IpcResponse<unknown>>('order:getRetryOptions'),
    // Followup support (additional commands after completion)
    enterFollowup: createIpcInvoker<[string], IpcResponse<{ success: boolean }>>('order:enterFollowup'),
    executeFollowup: createIpcInvoker<[string, string], IpcResponse<{ started: boolean }>>('order:executeFollowup'),
    finishFollowup: createIpcInvoker<[string], IpcResponse<{ success: boolean }>>('order:finishFollowup'),
    canFollowup: createIpcInvoker<[string], IpcResponse<{ canFollowup: boolean }>>('order:canFollowup'),
    // Worktree management (preserve order history)
    cleanupWorktreeOnly: createIpcInvoker<[string], IpcResponse<{ success: boolean; branch: string; message: string }>>('order:cleanupWorktreeOnly'),
    mergeWorktreeToMain: createIpcInvoker<[{ orderId: string; targetBranch?: string; deleteAfterMerge?: boolean; squash?: boolean }], IpcResponse<unknown>>('order:mergeWorktreeToMain'),
    onEvent: (callback: IpcEventCallback<OrderEvent>) => setupIpcListener('order:event', callback),
    onAssigned: (callback: IpcEventCallback<OrderAssignedEvent>) => setupIpcListener('order:assigned', callback),
    onCompleted: (callback: IpcEventCallback<OrderCompletedEvent>) => setupIpcListener('order:completed', callback),
    onFailed: (callback: IpcEventCallback<OrderFailedEvent>) => setupIpcListener('order:failed', callback),
    onOutput: (callback: IpcEventCallback<OutputEvent>) => setupIpcListener('order:output', callback),
    // Session events
    onSessionStarted: (callback: IpcEventCallback<SessionStartedEvent>) => setupIpcListener('order:session-started', callback),
    onSessionCompleted: (callback: IpcEventCallback<SessionCompletedEvent>) => setupIpcListener('order:session-completed', callback),
    onSessionFailed: (callback: IpcEventCallback<SessionFailedEvent>) => setupIpcListener('order:session-failed', callback),
    // Stage events
    onStageStarted: (callback: IpcEventCallback<StageStartedEvent>) => setupIpcListener('order:stage-started', callback),
    onStageCompleted: (callback: IpcEventCallback<StageCompletedEvent>) => setupIpcListener('order:stage-completed', callback),
    onStageFailed: (callback: IpcEventCallback<StageFailedEvent>) => setupIpcListener('order:stage-failed', callback),
    // Awaiting input event
    onAwaitingInput: (callback: IpcEventCallback<AwaitingInputEvent>) => setupIpcListener('order:awaiting-input', callback),
    // Todo progress event (from Claude's TodoWrite)
    onTodoProgress: (callback: IpcEventCallback<TodoProgressEvent>) => setupIpcListener('order:todo-progress', callback),
    // Order status changed event (for retry status updates)
    onStatusChanged: (callback: IpcEventCallback<StatusChangedEvent>) => setupIpcListener('order:status-changed', callback),
    // Followup events
    onFollowup: (callback: IpcEventCallback<FollowupStartedEvent>) => setupIpcListener('order:followup', callback),
    onFollowupStarted: (callback: IpcEventCallback<FollowupStartedEvent>) => setupIpcListener('order:followup-started', callback),
    onFollowupCompleted: (callback: IpcEventCallback<FollowupCompletedEvent>) => setupIpcListener('order:followup-completed', callback),
    onFollowupFailed: (callback: IpcEventCallback<FollowupFailedEvent>) => setupIpcListener('order:followup-failed', callback),
    onFollowupFinished: (callback: IpcEventCallback<FollowupFinishedEvent>) => setupIpcListener('order:followup-finished', callback),
  },

  receipt: {
    getAll: createIpcInvoker<[], IpcResponse<unknown[]>>('receipt:getAll'),
  },

  provider: {
    getAvailable: createIpcInvoker<[], IpcResponse<string[]>>('provider:getAvailable'),
  },

  worktree: {
    list: createIpcInvoker<[string], IpcResponse<unknown[]>>('worktree:list'),
    exportPatch: createIpcInvoker<[string, string, string?], IpcResponse<string>>('worktree:exportPatch'),
    remove: createIpcInvoker<[string, string, boolean?], IpcResponse<{ success: boolean }>>('worktree:remove'),
    openFolder: createIpcInvoker<[string], IpcResponse<{ success: boolean }>>('worktree:openFolder'),
    // New: merge and cleanup functions
    mergeToTarget: createIpcInvoker<[unknown], unknown>('worktree:mergeToTarget'),
    removeOnly: createIpcInvoker<[string, string], void>('worktree:removeOnly'),
  },

  workflow: {
    list: createIpcInvoker<[], IpcResponse<unknown[]>>('workflow:list'),
    get: createIpcInvoker<[string], IpcResponse<unknown>>('workflow:get'),
    create: createIpcInvoker<[unknown], IpcResponse<unknown>>('workflow:create'),
    update: createIpcInvoker<[unknown], IpcResponse<unknown>>('workflow:update'),
    delete: createIpcInvoker<[string], IpcResponse<{ success: boolean }>>('workflow:delete'),
    run: createIpcInvoker<[string, unknown?], IpcResponse<{ runId: string }>>('workflow:run'),
  },

  skill: {
    list: createIpcInvoker<[], IpcResponse<unknown[]>>('skill:list'),
    get: createIpcInvoker<[string], IpcResponse<unknown>>('skill:get'),
    create: createIpcInvoker<[unknown], IpcResponse<unknown>>('skill:create'),
    update: createIpcInvoker<[unknown], IpcResponse<unknown>>('skill:update'),
    delete: createIpcInvoker<[string], IpcResponse<{ success: boolean }>>('skill:delete'),
    duplicate: createIpcInvoker<[string, string, string?], IpcResponse<unknown>>('skill:duplicate'),
  },

  run: {
    list: createIpcInvoker<[], IpcResponse<unknown[]>>('run:list'),
    getStatus: createIpcInvoker<[string], IpcResponse<unknown>>('run:status'),
    resume: createIpcInvoker<[string], IpcResponse<void>>('run:resume'),
    getLogs: createIpcInvoker<[string], IpcResponse<unknown[]>>('run:logs'),
  },

  config: {
    assignments: {
      get: createIpcInvoker<[], IpcResponse<unknown>>('config:assignments:get'),
      set: createIpcInvoker<[unknown], IpcResponse<void>>('config:assignments:set'),
    },
    profiles: {
      list: createIpcInvoker<[], IpcResponse<unknown[]>>('config:profiles:list'),
      set: createIpcInvoker<[unknown], IpcResponse<void>>('config:profiles:set'),
    },
  },

  terminal: {
    init: createIpcInvoker<[unknown], IpcResponse<void>>('terminal:init'),
    getStatus: createIpcInvoker<[], IpcResponse<unknown>>('terminal:poolStatus'),
    getMetrics: createIpcInvoker<[], IpcResponse<unknown>>('terminal:poolMetrics'),
    subscribe: createIpcInvoker<[string], IpcResponse<void>>('terminal:subscribe'),
    unsubscribe: createIpcInvoker<[string], IpcResponse<void>>('terminal:unsubscribe'),
    shutdown: createIpcInvoker<[], IpcResponse<void>>('terminal:shutdown'),
    onData: (terminalId: string, callback: IpcEventCallback<string>) =>
      setupIpcListener(`terminal:data:${terminalId}`, callback),
  },

  dialog: {
    selectFolder: createIpcInvoker<[], IpcResponse<string | null>>('dialog:selectFolder'),
    selectFile: createIpcInvoker<[unknown?], IpcResponse<string | null>>('dialog:selectFile'),
  },

  system: {
    checkEnvironment: createIpcInvoker<[], IpcResponse<unknown>>('system:checkEnvironment'),
    checkGitRepo: createIpcInvoker<[string], IpcResponse<unknown>>('system:checkGitRepo'),
    gitInit: createIpcInvoker<[string], IpcResponse<void>>('system:gitInit'),
  },

  // Backward compatibility - legacy flat API
  createBarista: createIpcInvoker<[string], IpcResponse<unknown>>('barista:create'),
  getAllBaristas: createIpcInvoker<[], IpcResponse<unknown[]>>('barista:getAll'),
  createOrder: createIpcInvoker<[unknown], IpcResponse<unknown>>('order:create'),
  getAllOrders: createIpcInvoker<[], IpcResponse<unknown[]>>('order:getAll'),
  getOrder: createIpcInvoker<[string], IpcResponse<unknown>>('order:get'),
  getOrderLog: createIpcInvoker<[string], IpcResponse<string | null>>('order:getLog'),
  cancelOrder: createIpcInvoker<[string], IpcResponse<{ cancelled: boolean }>>('order:cancel'),
  getReceipts: createIpcInvoker<[], IpcResponse<unknown[]>>('receipt:getAll'),
  getAvailableProviders: createIpcInvoker<[], IpcResponse<string[]>>('provider:getAvailable'),
  listWorktrees: createIpcInvoker<[string], IpcResponse<unknown[]>>('worktree:list'),
  exportPatch: createIpcInvoker<[string, string, string?], IpcResponse<string>>('worktree:exportPatch'),
  removeWorktree: createIpcInvoker<[string, string, boolean?], IpcResponse<{ success: boolean }>>('worktree:remove'),
  openWorktreeFolder: createIpcInvoker<[string], IpcResponse<{ success: boolean }>>('worktree:openFolder'),
  onBaristaEvent: (callback: IpcEventCallback<BaristaEvent>) => setupIpcListener('barista:event', callback),
  onOrderEvent: (callback: IpcEventCallback<OrderEvent>) => setupIpcListener('order:event', callback),
  onOrderAssigned: (callback: IpcEventCallback<OrderAssignedEvent>) => setupIpcListener('order:assigned', callback),
  onOrderCompleted: (callback: IpcEventCallback<OrderCompletedEvent>) => setupIpcListener('order:completed', callback),
});

// Expose 'api' namespace for terminal
contextBridge.exposeInMainWorld('api', {
  terminal: {
    init: createIpcInvoker<[unknown], IpcResponse<void>>('terminal:init'),
    getStatus: createIpcInvoker<[], IpcResponse<unknown>>('terminal:poolStatus'),
    getMetrics: createIpcInvoker<[], IpcResponse<unknown>>('terminal:poolMetrics'),
    subscribe: createIpcInvoker<[string], IpcResponse<void>>('terminal:subscribe'),
    unsubscribe: createIpcInvoker<[string], IpcResponse<void>>('terminal:unsubscribe'),
    shutdown: createIpcInvoker<[], IpcResponse<void>>('terminal:shutdown'),
    onData: (terminalId: string, callback: IpcEventCallback<string>) =>
      setupIpcListener(`terminal:data:${terminalId}`, callback),
  },
});
