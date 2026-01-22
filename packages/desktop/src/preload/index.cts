/**
 * Preload Script (CommonJS)
 * Exposes IPC handlers to renderer process via contextBridge
 */

const { contextBridge, ipcRenderer } = require('electron');

// Helper to create IPC invoke functions with IpcResponse wrapper
function createIpcInvoker(channel: string) {
  return (...args: any[]) => ipcRenderer.invoke(channel, ...args);
}

// Helper to manage IPC event listeners
function setupIpcListener(channel: string, callback: (event: any) => void): () => void {
  const listener = (_: any, event: any) => callback(event);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('codecafe', {
  cafe: {
    list: createIpcInvoker('cafe:list'),
    get: createIpcInvoker('cafe:get'),
    create: createIpcInvoker('cafe:create'),
    update: createIpcInvoker('cafe:update'),
    delete: createIpcInvoker('cafe:delete'),
    setLastAccessed: createIpcInvoker('cafe:setLastAccessed'),
    getLastAccessed: createIpcInvoker('cafe:getLastAccessed'),
  },

  barista: {
    create: createIpcInvoker('barista:create'),
    getAll: createIpcInvoker('barista:getAll'),
    onEvent: (callback: (event: any) => void) => setupIpcListener('barista:event', callback),
  },

  order: {
    create: createIpcInvoker('order:create'),
    getAll: createIpcInvoker('order:getAll'),
    get: createIpcInvoker('order:get'),
    getLog: createIpcInvoker('order:getLog'),
    cancel: createIpcInvoker('order:cancel'),
    delete: createIpcInvoker('order:delete'),
    deleteMany: createIpcInvoker('order:deleteMany'),
    execute: createIpcInvoker('order:execute'),
    sendInput: createIpcInvoker('order:sendInput'),
    createWithWorktree: createIpcInvoker('order:createWithWorktree'),
    subscribeOutput: createIpcInvoker('order:subscribeOutput'),
    unsubscribeOutput: createIpcInvoker('order:unsubscribeOutput'),
    // Retry support
    retryFromStage: createIpcInvoker('order:retryFromStage'),
    retryFromBeginning: createIpcInvoker('order:retryFromBeginning'),
    getRetryOptions: createIpcInvoker('order:getRetryOptions'),
    onEvent: (callback: (event: any) => void) => setupIpcListener('order:event', callback),
    onAssigned: (callback: (data: any) => void) => setupIpcListener('order:assigned', callback),
    onCompleted: (callback: (data: any) => void) => setupIpcListener('order:completed', callback),
    onFailed: (callback: (data: any) => void) => setupIpcListener('order:failed', callback),
    onOutput: (callback: (event: any) => void) => setupIpcListener('order:output', callback),
    // Session events
    onSessionStarted: (callback: (data: any) => void) => setupIpcListener('order:session-started', callback),
    onSessionCompleted: (callback: (data: any) => void) => setupIpcListener('order:session-completed', callback),
    onSessionFailed: (callback: (data: any) => void) => setupIpcListener('order:session-failed', callback),
    // Stage events
    onStageStarted: (callback: (data: any) => void) => setupIpcListener('order:stage-started', callback),
    onStageCompleted: (callback: (data: any) => void) => setupIpcListener('order:stage-completed', callback),
    onStageFailed: (callback: (data: any) => void) => setupIpcListener('order:stage-failed', callback),
    // Awaiting input event
    onAwaitingInput: (callback: (data: any) => void) => setupIpcListener('order:awaiting-input', callback),
    // Todo progress event (from Claude's TodoWrite)
    onTodoProgress: (callback: (data: any) => void) => setupIpcListener('order:todo-progress', callback),
    // Order status changed event (for retry status updates)
    onStatusChanged: (callback: (data: any) => void) => setupIpcListener('order:status-changed', callback),
  },

  receipt: {
    getAll: createIpcInvoker('receipt:getAll'),
  },

  provider: {
    getAvailable: createIpcInvoker('provider:getAvailable'),
  },

  worktree: {
    list: createIpcInvoker('worktree:list'),
    exportPatch: createIpcInvoker('worktree:exportPatch'),
    remove: createIpcInvoker('worktree:remove'),
    openFolder: createIpcInvoker('worktree:openFolder'),
  },

  workflow: {
    list: createIpcInvoker('workflow:list'),
    get: createIpcInvoker('workflow:get'),
    create: createIpcInvoker('workflow:create'),
    update: createIpcInvoker('workflow:update'),
    delete: createIpcInvoker('workflow:delete'),
    run: createIpcInvoker('workflow:run'),
  },

  skill: {
    list: createIpcInvoker('skill:list'),
    get: createIpcInvoker('skill:get'),
    create: createIpcInvoker('skill:create'),
    update: createIpcInvoker('skill:update'),
    delete: createIpcInvoker('skill:delete'),
    duplicate: createIpcInvoker('skill:duplicate'),
  },

  run: {
    list: createIpcInvoker('run:list'),
    getStatus: createIpcInvoker('run:status'),
    resume: createIpcInvoker('run:resume'),
    getLogs: createIpcInvoker('run:logs'),
  },

  config: {
    assignments: {
      get: createIpcInvoker('config:assignments:get'),
      set: createIpcInvoker('config:assignments:set'),
    },
    profiles: {
      list: createIpcInvoker('config:profiles:list'),
      set: createIpcInvoker('config:profiles:set'),
    },
  },

  terminal: {
    init: createIpcInvoker('terminal:init'),
    getStatus: createIpcInvoker('terminal:poolStatus'),
    getMetrics: createIpcInvoker('terminal:poolMetrics'),
    subscribe: createIpcInvoker('terminal:subscribe'),
    unsubscribe: createIpcInvoker('terminal:unsubscribe'),
    shutdown: createIpcInvoker('terminal:shutdown'),
    onData: (terminalId: string, callback: (data: string) => void) =>
      setupIpcListener(`terminal:data:${terminalId}`, callback),
  },

  // Backward compatibility - legacy flat API
  createBarista: createIpcInvoker('barista:create'),
  getAllBaristas: createIpcInvoker('barista:getAll'),
  createOrder: createIpcInvoker('order:create'),
  getAllOrders: createIpcInvoker('order:getAll'),
  getOrder: createIpcInvoker('order:get'),
  getOrderLog: createIpcInvoker('order:getLog'),
  cancelOrder: createIpcInvoker('order:cancel'),
  getReceipts: createIpcInvoker('receipt:getAll'),
  getAvailableProviders: createIpcInvoker('provider:getAvailable'),
  listWorktrees: createIpcInvoker('worktree:list'),
  exportPatch: createIpcInvoker('worktree:exportPatch'),
  removeWorktree: createIpcInvoker('worktree:remove'),
  openWorktreeFolder: createIpcInvoker('worktree:openFolder'),
  onBaristaEvent: (callback: (event: any) => void) => setupIpcListener('barista:event', callback),
  onOrderEvent: (callback: (event: any) => void) => setupIpcListener('order:event', callback),
  onOrderAssigned: (callback: (data: any) => void) => setupIpcListener('order:assigned', callback),
  onOrderCompleted: (callback: (data: any) => void) => setupIpcListener('order:completed', callback),
});

// Expose 'api' namespace for terminal
contextBridge.exposeInMainWorld('api', {
  terminal: {
    init: createIpcInvoker('terminal:init'),
    getStatus: createIpcInvoker('terminal:poolStatus'),
    getMetrics: createIpcInvoker('terminal:poolMetrics'),
    subscribe: createIpcInvoker('terminal:subscribe'),
    unsubscribe: createIpcInvoker('terminal:unsubscribe'),
    shutdown: createIpcInvoker('terminal:shutdown'),
    onData: (terminalId: string, callback: (data: string) => void) =>
      setupIpcListener(`terminal:data:${terminalId}`, callback),
  },
});
