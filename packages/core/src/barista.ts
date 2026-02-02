import { Barista, BaristaStatus, ProviderType, EventType, BaristaEvent, BaristaEventPayloads } from './types.js';
import { EventEmitter } from 'events';
import { NotFoundError, ValidationError } from './errors/specific-errors.js';
import { ErrorCode } from './errors/error-codes.js';
import { BARISTA_DEFAULTS } from './constants/barista.js';

/**
 * Barista Manager
 * 바리스타(실행 유닛) 풀을 관리합니다.
 */
export class BaristaManager extends EventEmitter {
  private baristas: Map<string, Barista> = new Map();
  private maxBaristas: number;

  /**
   * Valid state transitions for BaristaStatus
   * STOPPED is a terminal state - no transitions allowed from it
   */
  private static readonly VALID_TRANSITIONS: Record<BaristaStatus, BaristaStatus[]> = {
    [BaristaStatus.IDLE]: [BaristaStatus.RUNNING, BaristaStatus.BUSY, BaristaStatus.STOPPED],
    [BaristaStatus.RUNNING]: [BaristaStatus.IDLE, BaristaStatus.ERROR, BaristaStatus.STOPPED],
    [BaristaStatus.BUSY]: [BaristaStatus.IDLE, BaristaStatus.ERROR, BaristaStatus.STOPPED],
    [BaristaStatus.ERROR]: [BaristaStatus.IDLE, BaristaStatus.STOPPED],
    [BaristaStatus.STOPPED]: [],
  };

  constructor(maxBaristas: number = BARISTA_DEFAULTS.MAX_POOL_SIZE) {
    super();
    this.maxBaristas = maxBaristas;
  }

  /**
   * 새 바리스타 생성
   */
  createBarista(provider: ProviderType): Barista {
    if (this.baristas.size >= this.maxBaristas) {
      throw new ValidationError(ErrorCode.MAX_BARISTAS_REACHED, {
        message: `Maximum baristas (${this.maxBaristas}) reached`,
        details: { maxBaristas: this.maxBaristas, currentCount: this.baristas.size },
      });
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
      throw new NotFoundError(ErrorCode.BARISTA_NOT_FOUND, {
        message: `Barista ${baristaId} not found`,
        resourceType: 'barista',
        resourceId: baristaId,
      });
    }

    // Validate state transition
    this.validateStateTransition(barista.status, status, baristaId);

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
      throw new NotFoundError(ErrorCode.BARISTA_NOT_FOUND, {
        message: `Barista ${baristaId} not found`,
        resourceType: 'barista',
        resourceId: baristaId,
      });
    }

    if (barista.status === BaristaStatus.RUNNING) {
      throw new ValidationError(ErrorCode.BARISTA_RUNNING, {
        message: `Cannot remove running barista ${baristaId}`,
        details: { baristaId, status: barista.status },
      });
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

  /**
   * Validates that a state transition is allowed
   * @throws ValidationError if the transition is invalid
   */
  private validateStateTransition(
    currentStatus: BaristaStatus,
    newStatus: BaristaStatus,
    baristaId: string
  ): void {
    // Same status is always allowed (no-op)
    if (currentStatus === newStatus) {
      return;
    }

    const validTransitions = BaristaManager.VALID_TRANSITIONS[currentStatus];
    if (!validTransitions.includes(newStatus)) {
      throw new ValidationError(ErrorCode.INVALID_STATE_TRANSITION, {
        message: `Invalid state transition from ${currentStatus} to ${newStatus} for barista ${baristaId}`,
        details: {
          baristaId,
          currentStatus,
          newStatus,
          allowedTransitions: validTransitions,
        },
      });
    }
  }

  private emitEvent<T extends keyof BaristaEventPayloads>(
    type: T,
    baristaId: string,
    data: BaristaEventPayloads[T]
  ): void {
    const event: BaristaEvent<BaristaEventPayloads[T]> = {
      type,
      timestamp: new Date(),
      baristaId,
      data,
    };
    this.emit('event', event);
  }
}
