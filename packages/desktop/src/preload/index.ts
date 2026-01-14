import { contextBridge, ipcRenderer } from 'electron';
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

// Helper to create IPC invoke functions
function createIpcInvoker<T>(channel: string) {
  return (...args: any[]): Promise<T> => ipcRenderer.invoke(channel, ...args);
}

// Helper to manage IPC event listeners
function setupIpcListener<T>(channel: string, callback: (event: T) => void): () => void {
  const listener = (_: any, event: T) => callback(event);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('codecafe', {
  cafe: {
    list: createIpcInvoker<Cafe[]>('cafe:list'),
    get: createIpcInvoker<Cafe | null>('cafe:get'),
    create: createIpcInvoker<Cafe>('cafe:create'),
    update: createIpcInvoker<Cafe>('cafe:update'),
    delete: createIpcInvoker<void>('cafe:delete'),
    setLastAccessed: createIpcInvoker<void>('cafe:setLastAccessed'),
    getLastAccessed: createIpcInvoker<Cafe | null>('cafe:getLastAccessed'),
  },

  barista: {
    create: createIpcInvoker<any>('barista:create'),
    getAll: createIpcInvoker<any>('barista:getAll'),
    onEvent: (callback: (event: any) => void) => setupIpcListener('barista:event', callback),
  },

  order: {
    create: createIpcInvoker<any>('order:create'),
    getAll: createIpcInvoker<any>('order:getAll'),
    get: createIpcInvoker<any>('order:get'),
    getLog: createIpcInvoker<any>('order:getLog'),
    cancel: createIpcInvoker<any>('order:cancel'),
    onEvent: (callback: (event: any) => void) => setupIpcListener('order:event', callback),
    onAssigned: (callback: (data: any) => void) => setupIpcListener('order:assigned', callback),
    onCompleted: (callback: (data: any) => void) => setupIpcListener('order:completed', callback),
  },

  receipt: {
    getAll: createIpcInvoker<any>('receipt:getAll'),
  },

  provider: {
    getAvailable: createIpcInvoker<any>('provider:getAvailable'),
  },

  worktree: {
    list: createIpcInvoker<any>('worktree:list'),
    exportPatch: createIpcInvoker<any>('worktree:exportPatch'),
    remove: createIpcInvoker<any>('worktree:remove'),
    openFolder: createIpcInvoker<any>('worktree:openFolder'),
  },

  workflow: {
    list: createIpcInvoker<any>('workflow:list'),
    get: createIpcInvoker<any>('workflow:get'),
    run: createIpcInvoker<any>('workflow:run'),
  },

  run: {
    list: createIpcInvoker<any>('run:list'),
    getStatus: createIpcInvoker<any>('run:status'),
    resume: createIpcInvoker<any>('run:resume'),
    getLogs: createIpcInvoker<any>('run:logs'),
  },

  config: {
    assignments: {
      get: createIpcInvoker<any>('config:assignments:get'),
      set: createIpcInvoker<any>('config:assignments:set'),
    },
    profiles: {
      list: createIpcInvoker<any>('config:profiles:list'),
      set: createIpcInvoker<any>('config:profiles:set'),
    },
    roles: {
      list: createIpcInvoker<any>('config:roles:list'),
    },
  },

  role: {
    list: createIpcInvoker<any>('role:list'),
    get: createIpcInvoker<any>('role:get'),
    listDefault: createIpcInvoker<any>('role:listDefault'),
    listUser: createIpcInvoker<any>('role:listUser'),
    reload: createIpcInvoker<any>('role:reload'),
  },

  terminal: {
    init: createIpcInvoker<any>('terminal:init'),
    getStatus: createIpcInvoker<any>('terminal:poolStatus'),
    getMetrics: createIpcInvoker<any>('terminal:poolMetrics'),
    subscribe: createIpcInvoker<any>('terminal:subscribe'),
    unsubscribe: createIpcInvoker<any>('terminal:unsubscribe'),
    shutdown: createIpcInvoker<any>('terminal:shutdown'),
    onData: (terminalId: string, callback: (data: string) => void) =>
      setupIpcListener(`terminal:data:${terminalId}`, callback),
  },
});
