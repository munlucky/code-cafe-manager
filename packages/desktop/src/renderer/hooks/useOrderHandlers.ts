/**
 * Order CRUD handlers hook
 */

import { useCallback } from 'react';
import { useOrderStore } from '../store/useOrderStore';
import { OrderStatus as BackendOrderStatus } from '../types/models';
import type { Recipe } from '../types/design';

interface UseOrderHandlersOptions {
  recipes: Recipe[];
}

export function useOrderHandlers({ recipes }: UseOrderHandlersOptions) {
  const { addOrder, removeOrder, updateOrder, setAwaitingInput } =
    useOrderStore();

  const handleCreateOrder = useCallback(
    async (
      cafeId: string,
      workflowId: string,
      description: string,
      useWorktree: boolean
    ) => {
      const workflow = recipes.find((r) => r.id === workflowId);
      const res = await window.codecafe.order.createWithWorktree({
        cafeId,
        workflowId,
        workflowName: workflow?.name || 'Unknown',
        vars: { prompt: description },
        createWorktree: useWorktree,
      });
      if (res.success && res.data) {
        const order = res.data.order;
        addOrder(order);

        // Auto-execute if description provided
        if (description.trim()) {
          try {
            await window.codecafe.order.execute(order.id, description, {});
          } catch (err) {
            console.error('[useOrderHandlers] Failed to auto-execute:', err);
          }
        }
      }
    },
    [recipes, addOrder]
  );

  const handleDeleteOrder = useCallback(
    async (orderId: string) => {
      const res = await window.codecafe.order.delete(orderId);
      if (res.success) {
        removeOrder(orderId);
      }
    },
    [removeOrder]
  );

  const handleCancelOrder = useCallback(
    async (orderId: string) => {
      const res = await window.codecafe.order.cancel(orderId);
      if (res.success) {
        updateOrder(orderId, { status: BackendOrderStatus.CANCELLED });
      }
    },
    [updateOrder]
  );

  const handleSendInput = useCallback(
    async (orderId: string, input: string) => {
      const res = await window.codecafe.order.sendInput(orderId, input);
      if (res.success) {
        setAwaitingInput(orderId, false);
      }
    },
    [setAwaitingInput]
  );

  return {
    handleCreateOrder,
    handleDeleteOrder,
    handleCancelOrder,
    handleSendInput,
  };
}
