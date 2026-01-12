const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('codecafe', {
  createBarista: (provider: string) => ipcRenderer.invoke('createBarista', provider),
  getAllBaristas: () => ipcRenderer.invoke('getAllBaristas'),

  createOrder: (params: any) => ipcRenderer.invoke('createOrder', params),
  getAllOrders: () => ipcRenderer.invoke('getAllOrders'),
  getOrder: (orderId: string) => ipcRenderer.invoke('getOrder', orderId),
  getOrderLog: (orderId: string) => ipcRenderer.invoke('getOrderLog', orderId),
  cancelOrder: (orderId: string) => ipcRenderer.invoke('cancelOrder', orderId),

  getReceipts: () => ipcRenderer.invoke('getReceipts'),

  getAvailableProviders: () => ipcRenderer.invoke('getAvailableProviders'),

  listWorktrees: (repoPath: string) => ipcRenderer.invoke('listWorktrees', repoPath),
  exportPatch: (worktreePath: string, baseBranch: string, outputPath?: string) =>
    ipcRenderer.invoke('exportPatch', worktreePath, baseBranch, outputPath),
  removeWorktree: (worktreePath: string, force?: boolean) =>
    ipcRenderer.invoke('removeWorktree', worktreePath, force),
  openWorktreeFolder: (worktreePath: string) =>
    ipcRenderer.invoke('openWorktreeFolder', worktreePath),

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

  onBaristaEvent: (callback: (event: any) => void) => {
    ipcRenderer.removeAllListeners('barista:event');
    ipcRenderer.on('barista:event', (_event: unknown, event: any) => callback(event));
  },
  onOrderEvent: (callback: (event: any) => void) => {
    ipcRenderer.removeAllListeners('order:event');
    ipcRenderer.on('order:event', (_event: unknown, event: any) => callback(event));
  },
  onOrderAssigned: (callback: (data: any) => void) => {
    ipcRenderer.removeAllListeners('order:assigned');
    ipcRenderer.on('order:assigned', (_event: unknown, data: any) => callback(data));
  },
  onOrderCompleted: (callback: (data: any) => void) => {
    ipcRenderer.removeAllListeners('order:completed');
    ipcRenderer.on('order:completed', (_event: unknown, data: any) => callback(data));
  },
});
