import { EventEmitter } from 'events';
import { BaristaManager } from './barista.js';
import { OrderManager } from './order.js';
import { Storage } from './storage.js';
import { LogManager } from './log-manager.js';
import {
  Order,
  Barista,
  ProviderType,
  BaristaStatus,
  OrderStatus,
  Receipt,
  EventType,
} from './types.js';

/**
 * Orchestrator
 * Barista Pool + Order Queue + Storage + Logging을 통합 관리
 */
export class Orchestrator extends EventEmitter {
  private baristaManager: BaristaManager;
  private orderManager: OrderManager;
  private storage: Storage;
  private logManager: LogManager;
  private isRunning: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(dataDir: string, logsDir: string, maxBaristas: number = 4) {
    super();
    this.baristaManager = new BaristaManager(maxBaristas);
    this.orderManager = new OrderManager();
    this.storage = new Storage(dataDir);
    this.logManager = new LogManager(logsDir);

    // 이벤트 전파
    this.baristaManager.on('event', (event) => this.emit('barista:event', event));
    this.orderManager.on('event', (event) => this.emit('order:event', event));
  }

  /**
   * 초기화
   */
  async init(): Promise<void> {
    await this.storage.init();
    await this.logManager.init();

    // 저장된 상태 복원
    const savedBaristas = await this.storage.loadBaristas();
    const savedOrders = await this.storage.loadOrders();

    // Orders 복원
    if (savedOrders.length > 0) {
      this.orderManager.restoreOrders(savedOrders);
      console.log(`[Orchestrator] Restored ${savedOrders.length} orders`);
    }

    // Baristas는 현재 복원하지 않음 (프로세스 연결이 필요하므로 신규 시작)
    if (savedBaristas.length > 0) {
      console.log(`[Orchestrator] Found ${savedBaristas.length} saved baristas (not restoring)`);
    }
  }

  /**
   * 바리스타 생성
   */
  createBarista(provider: ProviderType): Barista {
    const barista = this.baristaManager.createBarista(provider);
    this.saveState(); // 비동기 저장
    return barista;
  }

  /**
   * 주문 생성
   * @param provider Provider는 이제 workflow의 stageConfigs에서 결정됨
   *                 backward compatibility를 위해 선택적으로 허용
   */
  createOrder(
    workflowId: string,
    workflowName: string,
    counter: string,
    provider?: ProviderType,
    vars: Record<string, string> = {}
  ): Order {
    // Provider가 지정되지 않으면 기본값 사용 (workflow의 stageConfigs가 우선)
    const defaultProvider: ProviderType = provider || 'claude-code';
    const order = this.orderManager.createOrder(workflowId, workflowName, counter, defaultProvider, vars);

    // 첫 번째 stage의 provider를 사용하여 barista 생성 시도
    const idleBarista = this.baristaManager.findIdleBarista(defaultProvider);
    if (!idleBarista) {
      try {
        this.baristaManager.createBarista(defaultProvider);
      } catch (error) {
        console.error('Failed to auto-create barista:', error);
      }
    }
    this.saveState(); // 비동기 저장
    this.tryAssignOrders(); // 즉시 할당 시도
    return order;
  }

  /**
   * Orchestrator 시작 (주기적 주문 할당)
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // 2초마다 pending 주문을 idle 바리스타에 할당
    this.checkInterval = setInterval(() => {
      this.tryAssignOrders();
    }, 2000);
  }

  /**
   * Orchestrator 중지
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.baristaManager.stopAll();
    await this.saveState();
  }

  /**
   * 대기 중인 주문을 idle 바리스타에 할당
   */
  private tryAssignOrders(): void {
    const pendingOrders = this.orderManager.getPendingOrders();

    for (const order of pendingOrders) {
      const barista = this.baristaManager.findIdleBarista(order.provider);
      if (barista) {
        this.assignOrderToBarista(order.id, barista.id);
      }
    }
  }

  /**
   * 주문을 바리스타에 할당
   */
  assignOrderToBarista(orderId: string, baristaId: string): void {
    const order = this.orderManager.getOrder(orderId);
    const barista = this.baristaManager.getBarista(baristaId);

    if (!order || !barista) {
      throw new Error('Order or Barista not found');
    }

    // 주문에 바리스타 할당
    this.orderManager.assignBarista(orderId, baristaId);

    // 바리스타 상태 변경
    this.baristaManager.updateBaristaStatus(baristaId, BaristaStatus.RUNNING, orderId);

    this.saveState();

    // 실제 실행은 외부(CLI/UI)에서 Provider를 통해 수행
    this.emit('order:assigned', { orderId, baristaId });
  }

  /**
   * 주문 시작 (Provider 실행 시작 시 호출)
   */
  async startOrder(orderId: string): Promise<void> {
    this.orderManager.startOrder(orderId);
    await this.logManager.appendLog(orderId, 'Order started');
    await this.saveState();
  }

  /**
   * 주문 로그 추가
   */
  async appendOrderLog(orderId: string, log: string): Promise<void> {
    this.orderManager.appendLog(orderId, log);
    await this.logManager.appendLog(orderId, log);
  }

  /**
   * 주문 완료
   */
  async completeOrder(orderId: string, success: boolean, error?: string): Promise<void> {
    const order = this.orderManager.getOrder(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    this.orderManager.completeOrder(orderId, success, error);
    await this.logManager.appendLog(orderId, success ? 'Order completed' : `Order failed: ${error}`);

    // 바리스타를 IDLE로 변경
    if (order.baristaId) {
      this.baristaManager.updateBaristaStatus(order.baristaId, BaristaStatus.IDLE, null);
    }

    // Receipt 생성
    const receipt: Receipt = {
      orderId: order.id,
      status: order.status,
      startedAt: order.startedAt!,
      endedAt: order.endedAt!,
      provider: order.provider,
      counter: order.counter,
      errorSummary: error,
      logs: await this.logManager.tailLog(orderId, 50),
    };

    await this.storage.addReceipt(receipt);
    await this.saveState();

    this.emit('order:completed', { orderId, success });
  }

  /**
   * 주문 취소
   */
  async cancelOrder(orderId: string): Promise<void> {
    const order = this.orderManager.getOrder(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    this.orderManager.cancelOrder(orderId);
    await this.logManager.appendLog(orderId, 'Order cancelled');

    // 바리스타를 IDLE로 변경
    if (order.baristaId) {
      this.baristaManager.updateBaristaStatus(order.baristaId, BaristaStatus.IDLE, null);
    }

    await this.saveState();
  }

  /**
   * 주문 실행 (프롬프트와 함께)
   */
  async executeOrder(orderId: string, prompt: string, vars: Record<string, string> = {}): Promise<void> {
    const order = this.orderManager.getOrder(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new Error(`Order ${orderId} is not in PENDING status (current: ${order.status})`);
    }

    // 프롬프트와 vars 저장
    this.orderManager.updateOrderPrompt(orderId, prompt, vars);
    await this.logManager.appendLog(orderId, `Execution requested with prompt: ${prompt.substring(0, 100)}...`);

    // 바리스타 찾기 또는 생성
    let barista = this.baristaManager.findIdleBarista(order.provider);
    if (!barista) {
      try {
        barista = this.baristaManager.createBarista(order.provider);
      } catch (error) {
        throw new Error(`Failed to create barista for order ${orderId}: ${error}`);
      }
    }

    // 주문 할당 및 시작
    this.assignOrderToBarista(orderId, barista.id);
    await this.startOrder(orderId);

    await this.saveState();

    // 실행 시작 이벤트 발생
    this.emit('order:execution-started', { orderId, baristaId: barista.id, prompt });
  }

  /**
   * 실행 중인 주문에 사용자 입력 전달
   */
  async sendInput(orderId: string, message: string): Promise<void> {
    const order = this.orderManager.getOrder(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (order.status !== OrderStatus.RUNNING) {
      throw new Error(`Order ${orderId} is not running (current: ${order.status})`);
    }

    await this.logManager.appendLog(orderId, `User input: ${message}`);

    // 사용자 입력 이벤트 발생 (BaristaEngine에서 처리)
    this.emit('order:input', { orderId, message });
  }

  /**
   * 상태 조회
   */
  getAllBaristas(): Barista[] {
    return this.baristaManager.getAllBaristas();
  }

  getAllOrders(): Order[] {
    return this.orderManager.getAllOrders();
  }

  getOrder(orderId: string): Order | undefined {
    return this.orderManager.getOrder(orderId);
  }

  getBarista(baristaId: string): Barista | undefined {
    return this.baristaManager.getBarista(baristaId);
  }

  async getOrderLog(orderId: string): Promise<string> {
    return await this.logManager.readLog(orderId);
  }

  async getReceipts(): Promise<Receipt[]> {
    return await this.storage.loadReceipts();
  }

  /**
   * 상태 저장 (비동기)
   */
  private async saveState(): Promise<void> {
    try {
      await this.storage.saveBaristas(this.baristaManager.getAllBaristas());
      await this.storage.saveOrders(this.orderManager.getAllOrders());
    } catch (error) {
      console.error('Failed to save state:', error);
    }
  }
}
