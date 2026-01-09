const { contextBridge, ipcRenderer } = require('electron');

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

  // 이벤트 리스너
  onBaristaEvent: (callback: (event: any) => void) => {
    ipcRenderer.on('barista:event', (_: any, event: any) => callback(event));
  },
  onOrderEvent: (callback: (event: any) => void) => {
    ipcRenderer.on('order:event', (_: any, event: any) => callback(event));
  },
  onOrderAssigned: (callback: (data: any) => void) => {
    ipcRenderer.on('order:assigned', (_: any, data: any) => callback(data));
  },
  onOrderCompleted: (callback: (data: any) => void) => {
    ipcRenderer.on('order:completed', (_: any, data: any) => callback(data));
  },
});
