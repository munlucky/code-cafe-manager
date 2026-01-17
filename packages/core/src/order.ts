import { Order, OrderStatus, ProviderType, EventType, OrderEvent } from './types.js';
import { EventEmitter } from 'events';

/**
 * Order Manager
 * 주문(레시피 실행 인스턴스) 큐를 관리합니다.
 */
export class OrderManager extends EventEmitter {
  private orders: Map<string, Order> = new Map();
  private pendingQueue: string[] = [];

  /**
   * 새 주문 생성
   */
  createOrder(
    workflowId: string,
    workflowName: string,
    counter: string,
    provider: ProviderType,
    vars: Record<string, string> = {}
  ): Order {
    const order: Order = {
      id: this.generateId(),
      workflowId,
      workflowName,
      baristaId: null,
      status: OrderStatus.PENDING,
      counter,
      provider,
      vars,
      createdAt: new Date(),
      startedAt: null,
      endedAt: null,
    };

    this.orders.set(order.id, order);
    this.pendingQueue.push(order.id);
    this.emitEvent(EventType.ORDER_CREATED, order.id, order);

    return order;
  }

  /**
   * 주문에 바리스타 할당
   */
  assignBarista(orderId: string, baristaId: string): void {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new Error(`Order ${orderId} is not pending`);
    }

    order.baristaId = baristaId;
    this.pendingQueue = this.pendingQueue.filter((id) => id !== orderId);
    this.emitEvent(EventType.ORDER_ASSIGNED, orderId, { baristaId });
  }

  /**
   * 주문 시작
   */
  startOrder(orderId: string): void {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    order.status = OrderStatus.RUNNING;
    order.startedAt = new Date();
    this.emitEvent(EventType.ORDER_STATUS_CHANGED, orderId, {
      status: OrderStatus.RUNNING,
    });
  }

  /**
   * 주문 완료
   */
  completeOrder(orderId: string, success: boolean, error?: string): void {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    order.status = success ? OrderStatus.COMPLETED : OrderStatus.FAILED;
    order.endedAt = new Date();
    if (error) {
      order.error = error;
    }

    this.emitEvent(EventType.ORDER_COMPLETED, orderId, {
      status: order.status,
      error,
    });
  }

  /**
   * 주문 취소
   */
  cancelOrder(orderId: string): void {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.FAILED) {
      throw new Error(`Cannot cancel ${order.status.toLowerCase()} order ${orderId}`);
    }

    order.status = OrderStatus.CANCELLED;
    order.endedAt = new Date();

    // 대기 중인 경우 큐에서 제거
    this.pendingQueue = this.pendingQueue.filter((id) => id !== orderId);

    this.emitEvent(EventType.ORDER_STATUS_CHANGED, orderId, {
      status: OrderStatus.CANCELLED,
    });
  }

  /**
   * 로그 추가
   */
  appendLog(orderId: string, log: string): void {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    this.emitEvent(EventType.ORDER_LOG, orderId, { log });
  }

  /**
   * 주문 프롬프트 및 변수 업데이트
   */
  updateOrderPrompt(orderId: string, prompt: string, vars: Record<string, string> = {}): void {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    order.prompt = prompt;
    // 기존 vars와 병합
    order.vars = { ...order.vars, ...vars };
  }

  /**
   * 주문 조회
   */
  getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  /**
   * 모든 주문 조회
   */
  getAllOrders(): Order[] {
    return Array.from(this.orders.values());
  }

  /**
   * 주문 삭제 (완료/실패/취소된 주문만)
   */
  deleteOrder(orderId: string): boolean {
    const order = this.orders.get(orderId);
    if (!order) {
      return false;
    }

    // RUNNING/PENDING 상태 주문은 삭제할 수 없음
    if (order.status === OrderStatus.RUNNING || order.status === OrderStatus.PENDING) {
      throw new Error(`Cannot delete ${order.status.toLowerCase()} order ${orderId}. Cancel it first.`);
    }

    this.orders.delete(orderId);
    this.emitEvent(EventType.ORDER_STATUS_CHANGED, orderId, { deleted: true });
    return true;
  }

  /**
   * 여러 주문 삭제 (완료/실패/취소된 주문만)
   */
  deleteOrders(orderIds: string[]): { deleted: string[]; failed: string[] } {
    const deleted: string[] = [];
    const failed: string[] = [];

    for (const orderId of orderIds) {
      try {
        if (this.deleteOrder(orderId)) {
          deleted.push(orderId);
        } else {
          failed.push(orderId);
        }
      } catch {
        failed.push(orderId);
      }
    }

    return { deleted, failed };
  }

  /**
   * 저장된 주문 복원 (앱 시작 시 호출)
   */
  restoreOrders(orders: Order[]): void {
    this.orders.clear();
    this.pendingQueue = [];

    for (const order of orders) {
      this.orders.set(order.id, order);
      // PENDING 상태인 주문은 대기 큐에 추가
      if (order.status === OrderStatus.PENDING) {
        this.pendingQueue.push(order.id);
      }
    }
  }

  /**
   * 대기 중인 주문 조회
   */
  getPendingOrders(): Order[] {
    return this.pendingQueue
      .map((id) => this.orders.get(id))
      .filter((order): order is Order => order !== undefined);
  }

  /**
   * 다음 대기 주문 가져오기
   */
  getNextPendingOrder(provider?: ProviderType): Order | null {
    for (const orderId of this.pendingQueue) {
      const order = this.orders.get(orderId);
      if (order && (!provider || order.provider === provider)) {
        return order;
      }
    }
    return null;
  }

  private generateId(): string {
    return `order-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  private emitEvent(type: EventType, orderId: string, data: any): void {
    const event: OrderEvent = {
      type,
      timestamp: new Date(),
      orderId,
      data,
    };
    this.emit('event', event);
  }
}
