import { Barista, BaristaStatus, ProviderType, EventType, BaristaEvent } from './types.js';
import { EventEmitter } from 'events';

/**
 * Barista Manager
 * 바리스타(실행 유닛) 풀을 관리합니다.
 */
export class BaristaManager extends EventEmitter {
  private baristas: Map<string, Barista> = new Map();
  private maxBaristas: number;

  constructor(maxBaristas: number = 4) {
    super();
    this.maxBaristas = maxBaristas;
  }

  /**
   * 새 바리스타 생성
   */
  createBarista(provider: ProviderType): Barista {
    if (this.baristas.size >= this.maxBaristas) {
      throw new Error(`Maximum baristas (${this.maxBaristas}) reached`);
    }

    const barista: Barista = {
      id: this.generateId(),
      status: BaristaStatus.IDLE,
      currentOrderId: null,
      provider,
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };

    this.baristas.set(barista.id, barista);
    this.emitEvent(EventType.BARISTA_CREATED, barista.id, barista);

    return barista;
  }

  /**
   * 바리스타 상태 변경
   */
  updateBaristaStatus(baristaId: string, status: BaristaStatus, orderId?: string | null): void {
    const barista = this.baristas.get(baristaId);
    if (!barista) {
      throw new Error(`Barista ${baristaId} not found`);
    }

    barista.status = status;
    barista.lastActivityAt = new Date();

    if (orderId !== undefined) {
      barista.currentOrderId = orderId;
    }

    this.emitEvent(EventType.BARISTA_STATUS_CHANGED, baristaId, {
      status,
      orderId: barista.currentOrderId,
    });
  }

  /**
   * 사용 가능한(IDLE) 바리스타 찾기
   */
  findIdleBarista(provider?: ProviderType): Barista | null {
    for (const barista of this.baristas.values()) {
      if (barista.status === BaristaStatus.IDLE) {
        if (!provider || barista.provider === provider) {
          return barista;
        }
      }
    }
    return null;
  }

  /**
   * 바리스타 조회
   */
  getBarista(baristaId: string): Barista | undefined {
    return this.baristas.get(baristaId);
  }

  /**
   * 모든 바리스타 조회
   */
  getAllBaristas(): Barista[] {
    return Array.from(this.baristas.values());
  }

  /**
   * 바리스타 삭제
   */
  removeBarista(baristaId: string): void {
    const barista = this.baristas.get(baristaId);
    if (!barista) {
      throw new Error(`Barista ${baristaId} not found`);
    }

    if (barista.status === BaristaStatus.RUNNING) {
      throw new Error(`Cannot remove running barista ${baristaId}`);
    }

    this.baristas.delete(baristaId);
  }

  /**
   * 모든 바리스타 중지
   */
  stopAll(): void {
    for (const barista of this.baristas.values()) {
      if (barista.status === BaristaStatus.RUNNING || barista.status === BaristaStatus.IDLE) {
        this.updateBaristaStatus(barista.id, BaristaStatus.STOPPED);
      }
    }
  }


  private generateId(): string {
    return `barista-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  private emitEvent(type: EventType, baristaId: string, data: any): void {
    const event: BaristaEvent = {
      type,
      timestamp: new Date(),
      baristaId,
      data,
    };
    this.emit('event', event);
  }
}
