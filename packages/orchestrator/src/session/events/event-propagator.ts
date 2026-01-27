/**
 * SessionEventPropagator - 이벤트 전파 및 리스너 관리
 */

import { EventEmitter } from 'events';
import type { FailedState, AwaitingState } from '../order-session';

export type SessionEventType =
  | 'session:started'
  | 'session:completed'
  | 'session:failed'
  | 'session:cancelled'
  | 'session:awaiting'
  | 'session:resumed'
  | 'session:followup'
  | 'session:followup-started'
  | 'session:followup-completed'
  | 'session:followup-failed'
  | 'session:followup-finished'
  | 'stage:started'
  | 'stage:completed'
  | 'stage:failed'
  | 'output';

/**
 * 세션 이벤트 전파 클래스
 * EventEmitter를 상속하여 타입 안전한 이벤트 발생 헬퍼 제공
 */
export class SessionEventPropagator extends EventEmitter {
  constructor(
    private readonly orderId: string,
    private readonly cafeId: string
  ) {
    super();
  }

  /**
   * 세션 시작 이벤트 발생
   */
  emitSessionStarted(): void {
    this.emit('session:started', {
      orderId: this.orderId,
      cafeId: this.cafeId,
    });
  }

  /**
   * 세션 완료 이벤트 발생
   */
  emitSessionCompleted(context?: unknown): void {
    this.emit('session:completed', {
      orderId: this.orderId,
      context,
    });
  }

  /**
   * 세션 실패 이벤트 발생
   */
  emitSessionFailed(
    error: string,
    failedState?: FailedState | null,
    canRetry?: boolean
  ): void {
    this.emit('session:failed', {
      orderId: this.orderId,
      error,
      failedState,
      canRetry: canRetry ?? failedState !== null,
    });
  }

  /**
   * 세션 취소 이벤트 발생
   */
  emitSessionCancelled(): void {
    this.emit('session:cancelled', {
      orderId: this.orderId,
    });
  }

  /**
   * 대기 상태 이벤트 발생
   */
  emitAwaiting(
    stageId: string,
    questions?: string[],
    message?: string
  ): void {
    this.emit('session:awaiting', {
      orderId: this.orderId,
      stageId,
      questions,
      message,
    });
  }

  /**
   * 재개 이벤트 발생
   */
  emitResumed(options: {
    userInput?: string;
    fromStageId?: string;
    retryType?: 'stage' | 'beginning';
    attemptNumber?: number;
    preserveContext?: boolean;
  }): void {
    this.emit('session:resumed', {
      orderId: this.orderId,
      ...options,
    });
  }

  /**
   * 출력 이벤트 발생
   */
  emitOutput(data: string, stageId?: string): void {
    this.emit('output', {
      orderId: this.orderId,
      stageId,
      data,
    });
  }

  /**
   * Followup 모드 진입 이벤트
   */
  emitFollowup(): void {
    this.emit('session:followup', {
      orderId: this.orderId,
    });
  }

  /**
   * Followup 시작 이벤트
   */
  emitFollowupStarted(prompt: string): void {
    this.emit('session:followup-started', {
      orderId: this.orderId,
      prompt,
    });
  }

  /**
   * Followup 완료 이벤트
   */
  emitFollowupCompleted(stageId: string, output?: string): void {
    this.emit('session:followup-completed', {
      orderId: this.orderId,
      stageId,
      output,
    });
  }

  /**
   * Followup 실패 이벤트
   */
  emitFollowupFailed(error: string, stageId?: string): void {
    this.emit('session:followup-failed', {
      orderId: this.orderId,
      stageId,
      error,
    });
  }

  /**
   * Followup 종료 이벤트
   */
  emitFollowupFinished(): void {
    this.emit('session:followup-finished', {
      orderId: this.orderId,
    });
  }

  /**
   * 자식 EventEmitter로부터 이벤트 전파
   */
  propagateFrom(source: EventEmitter, events: string[]): void {
    for (const event of events) {
      source.on(event, (data) => this.emit(event, data));
    }
  }
}
