import { contextBridge, ipcRenderer } from 'electron';

// Renderer에서 사용할 API 노출
contextBridge.exposeInMainWorld('codecafe', {
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

  // Recipe Studio (M2)
  listRecipes: () => ipcRenderer.invoke('listRecipes'),
  getRecipe: (recipeName: string) => ipcRenderer.invoke('getRecipe', recipeName),
  saveRecipe: (recipeName: string, recipeData: any) =>
    ipcRenderer.invoke('saveRecipe', recipeName, recipeData),
  validateRecipe: (recipeData: any) => ipcRenderer.invoke('validateRecipe', recipeData),
  deleteRecipe: (recipeName: string) => ipcRenderer.invoke('deleteRecipe', recipeName),

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
