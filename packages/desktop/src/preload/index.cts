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

  listRecipes: () => ipcRenderer.invoke('listRecipes'),
  getRecipe: (recipeName: string) => ipcRenderer.invoke('getRecipe', recipeName),
  saveRecipe: (recipeName: string, recipeData: any) =>
    ipcRenderer.invoke('saveRecipe', recipeName, recipeData),
  validateRecipe: (recipeData: any) => ipcRenderer.invoke('validateRecipe', recipeData),

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
