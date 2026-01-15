/**
 * Order Terminals View
 * 실행 중인 오더들의 터미널 출력을 탭 방식으로 표시
 */

import { useState, useEffect } from 'react';
import { TerminalOutputPanel } from './TerminalOutputPanel';
import { EmptyState } from '../ui/EmptyState';
import { cn } from '../../utils/cn';
import { OrderStatus } from '@codecafe/core';
import type { Order } from '../../types/models';

export function OrderTerminals(): JSX.Element {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const result = await window.codecafe.order.getAll();
        if (result.success && result.data) {
          // RUNNING 상태 오더만 필터링
          const runningOrders = result.data.filter(
            (o: Order) => o.status === OrderStatus.RUNNING
          );
          setOrders(runningOrders);

          // 첫 번째 오더를 기본으로 선택
          if (runningOrders.length > 0 && !activeOrderId) {
            setActiveOrderId(runningOrders[0].id);
          }

          // 활성 오더가 더 이상 RUNNING이 아니면 첫 번째로 변경
          if (activeOrderId && !runningOrders.find((o: Order) => o.id === activeOrderId)) {
            setActiveOrderId(runningOrders.length > 0 ? runningOrders[0].id : null);
          }
        }
      } catch (error) {
        console.error('[OrderTerminals] Failed to fetch orders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
    const interval = setInterval(fetchOrders, 3000); // 3초마다 오더 목록 갱신

    return () => clearInterval(interval);
  }, [activeOrderId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading orders...</div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState
          message="No running orders"
          description="터미널 출력을 확인하려면 먼저 오더를 생성하세요."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-border bg-bone/5 overflow-x-auto">
        {orders.map((order) => (
          <button
            key={order.id}
            onClick={() => setActiveOrderId(order.id)}
            className={cn(
              'px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors relative',
              activeOrderId === order.id
                ? 'text-coffee bg-background border-b-2 border-coffee'
                : 'text-gray-500 hover:text-bone hover:bg-background/50'
            )}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>Order #{order.id}</span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {order.workflowName}
            </div>
          </button>
        ))}
      </div>

      {/* Terminal Output */}
      <div className="flex-1 overflow-hidden p-4">
        {activeOrderId && <TerminalOutputPanel orderId={activeOrderId} />}
      </div>
    </div>
  );
}
