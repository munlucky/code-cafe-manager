import { useEffect } from 'react';
import { useBaristaStore } from '../store/useBaristaStore';
import { useOrderStore } from '../store/useOrderStore';

export function useIpcEffect() {
  const { updateBarista } = useBaristaStore();
  const { updateOrder } = useOrderStore();

  useEffect(() => {
    // 바리스타 이벤트 리스너
    window.codecafe.onBaristaEvent((event) => {
      console.log('Barista Event:', event);
      if (event.baristaId) {
        updateBarista(event.baristaId, { status: event.status });
      }
    });

    // 주문 이벤트 리스너
    window.codecafe.onOrderEvent((event) => {
      console.log('Order Event:', event);
      if (event.orderId) {
        updateOrder(event.orderId, { status: event.status });
      }
    });

    // 주문 할당 이벤트
    window.codecafe.onOrderAssigned((data) => {
      console.log('Order Assigned:', data);
      if (data.orderId) {
        updateOrder(data.orderId, {
          status: 'RUNNING',
          baristaId: data.baristaId,
        });
      }
    });

    // 주문 완료 이벤트
    window.codecafe.onOrderCompleted((data) => {
      console.log('Order Completed:', data);
      if (data.orderId) {
        updateOrder(data.orderId, { status: 'COMPLETED' });
      }
    });
  }, [updateBarista, updateOrder]);
}
