import { useOrderStore } from '../store/useOrderStore';
import type { CreateOrderParams } from '../types/window';

export function useOrders() {
  const { orders, setOrders, addOrder, updateOrder } = useOrderStore();

  const fetchOrders = async () => {
    try {
      const data = await window.codecafe.getAllOrders();
      setOrders(data);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  };

  const createOrder = async (params: CreateOrderParams) => {
    try {
      const order = await window.codecafe.createOrder(params);
      addOrder(order);
      return order;
    } catch (error) {
      console.error('Failed to create order:', error);
      throw error;
    }
  };

  const getOrderLog = async (orderId: string) => {
    try {
      return await window.codecafe.getOrderLog(orderId);
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
