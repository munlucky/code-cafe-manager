import { useOrderStore } from '../useOrderStore';

/**
 * Memoized selectors for order store
 * Prevents unnecessary re-renders when accessing specific state slices
 */
export function useActiveOrders() {
  return useOrderStore((state) => state.orders.filter((o) => o.status === 'RUNNING'));
}

export function useSessionStatus(orderId: string) {
  return useOrderStore((state) => state.sessionStatuses[orderId]);
}

export function useStageResults(orderId: string) {
  return useOrderStore((state) => state.stageResults[orderId]);
}

export function useTodoProgress(orderId: string) {
  return useOrderStore((state) => state.todoProgress[orderId]);
}
