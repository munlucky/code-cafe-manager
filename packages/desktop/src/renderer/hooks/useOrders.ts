import { useOrderStore } from '../store/useOrderStore';
import type { CreateOrderParams } from '../types/window';

export function useOrders() {
  const { orders, setOrders, addOrder, updateOrder } = useOrderStore();

  const fetchOrders = async () => {
    try {
      const response = await window.codecafe.getAllOrders();
      if (response.success && response.data) {
        setOrders(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  };

  const createOrder = async (params: CreateOrderParams) => {
    try {
      const response = await window.codecafe.createOrder(params);
      if (response.success && response.data) {
        addOrder(response.data);
        return response.data;
      }
      throw new Error(response.error?.message || 'Failed to create order');
    } catch (error) {
      console.error('Failed to create order:', error);
      throw error;
    }
  };

  const getOrderLog = async (orderId: string) => {
    try {
      const response = await window.codecafe.getOrderLog(orderId);
      return response.data || '';
    } catch (error) {
      console.error('Failed to get order log:', error);
      return '';
    }
  };

  const cancelOrder = async (orderId: string) => {
    try {
      await window.codecafe.cancelOrder(orderId);
      await fetchOrders();
    } catch (error) {
      console.error('Failed to cancel order:', error);
      throw error;
    }
  };

  return { orders, fetchOrders, createOrder, getOrderLog, cancelOrder, updateOrder };
}
