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

// Renderer에서 사용할 API 노출
contextBridge.exposeInMainWorld('codecafe', {
  // Phase 1: Cafe Management
  cafe: {
    list: (): Promise<Cafe[]> => ipcRenderer.invoke('cafe:list'),
    get: (id: string): Promise<Cafe | null> => ipcRenderer.invoke('cafe:get', id),
    create: (params: CreateCafeParams): Promise<Cafe> => ipcRenderer.invoke('cafe:create', params),
    update: (id: string, params: UpdateCafeParams): Promise<Cafe> =>
      ipcRenderer.invoke('cafe:update', id, params),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('cafe:delete', id),
    setLastAccessed: (id: string): Promise<void> => ipcRenderer.invoke('cafe:setLastAccessed', id),
    getLastAccessed: (): Promise<Cafe | null> => ipcRenderer.invoke('cafe:getLastAccessed'),
  },
  // 바리스타 관리
  createBarista: (provider: string) => ipcRenderer.invoke('createBarista', provider),
  getAllBaristas: () => ipcRenderer.invoke('getAllBaristas'),

  // 주문 관리
  createOrder: (params: any) => ipcRenderer.invoke('createOrder', params),
  getAllOrders: () => ipcRenderer.invoke('getAllOrders'),
  getOrder: (orderId: string) => ipcRenderer.invoke('getOrder', orderId),
  getOrderLog: (orderId: string) => ipcRenderer.invoke('getOrderLog', orderId),
  cancelOrder: (orderId: string) => ipcRenderer.invoke('cancelOrder', orderId),

  // Receipt
  getReceipts: () => ipcRenderer.invoke('getReceipts'),

  // Provider 관리 (M2)
  getAvailableProviders: () => ipcRenderer.invoke('getAvailableProviders'),

  // Worktree 관리 (M2)
  listWorktrees: (repoPath: string) => ipcRenderer.invoke('listWorktrees', repoPath),
  exportPatch: (worktreePath: string, baseBranch: string, outputPath?: string) =>
    ipcRenderer.invoke('exportPatch', worktreePath, baseBranch, outputPath),
  removeWorktree: (worktreePath: string, force?: boolean) =>
    ipcRenderer.invoke('removeWorktree', worktreePath, force),
  openWorktreeFolder: (worktreePath: string) =>
    ipcRenderer.invoke('openWorktreeFolder', worktreePath),

  // Orchestrator UI (M2-4)
  listWorkflows: () => ipcRenderer.invoke('workflow:list'),
  getWorkflow: (workflowId: string) => ipcRenderer.invoke('workflow:get', workflowId),
  runWorkflow: (workflowId: string, options?: { mode?: string; interactive?: boolean }) =>
    ipcRenderer.invoke('workflow:run', workflowId, options),
  listRuns: () => ipcRenderer.invoke('run:list'),
  getRunStatus: (runId: string) => ipcRenderer.invoke('run:status', runId),
  resumeRun: (runId: string) => ipcRenderer.invoke('run:resume', runId),
  getRunLogs: (runId: string) => ipcRenderer.invoke('run:logs', runId),
  getAssignments: () => ipcRenderer.invoke('config:assignments:get'),
  setAssignment: (stage: string, provider: string, role: string) =>
    ipcRenderer.invoke('config:assignments:set', stage, provider, role),
  listProfiles: (stage: string) => ipcRenderer.invoke('config:profiles:list', stage),
  setProfile: (stage: string, profile: string) =>
    ipcRenderer.invoke('config:profiles:set', stage, profile),
  listRoles: () => ipcRenderer.invoke('config:roles:list'),

  // 이벤트 리스너
  onBaristaEvent: (callback: (event: any) => void) => {
    // 기존 리스너 제거 후 새로 등록
    ipcRenderer.removeAllListeners('barista:event');
    ipcRenderer.on('barista:event', (_, event) => callback(event));
  },
  onOrderEvent: (callback: (event: any) => void) => {
    // 기존 리스너 제거 후 새로 등록
    ipcRenderer.removeAllListeners('order:event');
    ipcRenderer.on('order:event', (_, event) => callback(event));
  },
  onOrderAssigned: (callback: (data: any) => void) => {
    ipcRenderer.removeAllListeners('order:assigned');
    ipcRenderer.on('order:assigned', (_, data) => callback(data));
  },
  onOrderCompleted: (callback: (data: any) => void) => {
    ipcRenderer.removeAllListeners('order:completed');
    ipcRenderer.on('order:completed', (_, data) => callback(data));
  },
});

// Phase 2: Role and Terminal APIs (separate namespace)
contextBridge.exposeInMainWorld('api', {
  role: {
    list: (): Promise<any> => ipcRenderer.invoke('role:list'),
    get: (id: string): Promise<any> => ipcRenderer.invoke('role:get', id),
    listDefault: (): Promise<any> => ipcRenderer.invoke('role:list-default'),
    listUser: (): Promise<any> => ipcRenderer.invoke('role:list-user'),
    reload: (): Promise<any> => ipcRenderer.invoke('role:reload'),
  },

  terminal: {
    init: (config: TerminalPoolConfig): Promise<any> => ipcRenderer.invoke('terminal:init', config),
    getStatus: (): Promise<any> => ipcRenderer.invoke('terminal:pool-status'),
    subscribe: (terminalId: string): Promise<any> => ipcRenderer.invoke('terminal:subscribe', terminalId),
    unsubscribe: (terminalId: string): Promise<any> => ipcRenderer.invoke('terminal:unsubscribe', terminalId),
    shutdown: (): Promise<any> => ipcRenderer.invoke('terminal:shutdown'),
    onData: (terminalId: string, callback: (data: string) => void): (() => void) => {
      const channel = `terminal:data:${terminalId}`;
      const listener = (event: any, data: string) => callback(data);
      ipcRenderer.on(channel, listener);
      // Return unsubscribe function
      return () => ipcRenderer.removeListener(channel, listener);
    },
  },
});
