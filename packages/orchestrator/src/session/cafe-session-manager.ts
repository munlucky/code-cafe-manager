/**
 * CafeSessionManager - Cafe별 Order 세션 관리
 *
 * 각 Cafe는 N개의 Order를 동시에 실행할 수 있음
 * 이 매니저가 Cafe 레벨에서 Order 세션들을 관리
 */

import { EventEmitter } from 'events';
import { Order, Barista } from '@codecafe/core';
import { TerminalPool } from '../terminal/terminal-pool';
import { OrderSession, WorkflowConfig, SessionStatus } from './order-session';

export interface CafeSessionInfo {
  cafeId: string;
  cafePath: string;
  sessions: Map<string, OrderSession>;
  maxConcurrentOrders: number;
}

export interface SessionManagerConfig {
  terminalPool: TerminalPool;
  maxConcurrentOrdersPerCafe?: number;
}

/** Session 상태 요약 (getStatusSummary 반환 타입) */
export interface SessionStatusSummary {
  totalCafes: number;
  totalSessions: number;
  runningCount: number;
  awaitingInputCount: number;
  completedCount: number;
  failedCount: number;
  cafes: Array<{
    cafeId: string;
    sessionCount: number;
    runningCount: number;
  }>;
  sessions: Array<{
    orderId: string;
    cafeId: string;
    status: SessionStatus;
  }>;
}

/**
 * CafeSessionManager - Cafe별 Order 세션들을 관리
 */
export class CafeSessionManager extends EventEmitter {
  private readonly terminalPool: TerminalPool;
  private readonly maxConcurrentOrdersPerCafe: number;

  // Cafe별 세션 관리
  private readonly cafes = new Map<string, CafeSessionInfo>();

  constructor(config: SessionManagerConfig) {
    super();
    this.terminalPool = config.terminalPool;
    this.maxConcurrentOrdersPerCafe = config.maxConcurrentOrdersPerCafe || 5;
  }

  /**
   * Cafe 등록 (또는 조회)
   */
  private getOrCreateCafe(cafeId: string, cafePath: string): CafeSessionInfo {
    let cafe = this.cafes.get(cafeId);

    if (!cafe) {
      cafe = {
        cafeId,
        cafePath,
        sessions: new Map(),
        maxConcurrentOrders: this.maxConcurrentOrdersPerCafe,
      };
      this.cafes.set(cafeId, cafe);
      console.log(`[CafeSessionManager] Registered cafe: ${cafeId}`);
    }

    return cafe;
  }

  /**
   * Order 세션 생성
   */
  createSession(
    order: Order,
    barista: Barista,
    cafeId: string,
    cafePath: string
  ): OrderSession {
    const cafe = this.getOrCreateCafe(cafeId, cafePath);

    // 동시 실행 제한 확인
    const runningSessions = Array.from(cafe.sessions.values()).filter(
      (s) => s.getStatus().status === 'running'
    );

    if (runningSessions.length >= cafe.maxConcurrentOrders) {
      throw new Error(
        `Cafe ${cafeId} has reached maximum concurrent orders (${cafe.maxConcurrentOrders})`
      );
    }

    // 세션 생성
    const session = new OrderSession(order, barista, cafeId, this.terminalPool);

    // 세션 이벤트 전파
    session.on('session:started', (data) => this.emit('session:started', data));
    session.on('session:completed', (data) => {
      this.emit('session:completed', data);
      this.cleanupSession(cafeId, order.id);
    });
    session.on('session:failed', (data) => {
      this.emit('session:failed', data);
      this.cleanupSession(cafeId, order.id);
    });
    session.on('session:cancelled', (data) => {
      this.emit('session:cancelled', data);
      this.cleanupSession(cafeId, order.id);
    });
    session.on('session:awaiting', (data) => this.emit('session:awaiting', data));
    session.on('session:resumed', (data) => this.emit('session:resumed', data));
    session.on('output', (data) => this.emit('output', data));
    session.on('stage:started', (data) => this.emit('stage:started', data));
    session.on('stage:completed', (data) => this.emit('stage:completed', data));
    session.on('stage:failed', (data) => this.emit('stage:failed', data));

    cafe.sessions.set(order.id, session);

    console.log(
      `[CafeSessionManager] Created session for order ${order.id} in cafe ${cafeId}`
    );

    return session;
  }

  /**
   * 워크플로우와 함께 세션 생성
   */
  createSessionWithWorkflow(
    order: Order,
    barista: Barista,
    cafeId: string,
    cafePath: string,
    workflowConfig: WorkflowConfig
  ): OrderSession {
    const session = this.createSession(order, barista, cafeId, cafePath);
    session.setWorkflow(workflowConfig);
    return session;
  }

  /**
   * 세션 조회
   */
  getSession(cafeId: string, orderId: string): OrderSession | undefined {
    const cafe = this.cafes.get(cafeId);
    return cafe?.sessions.get(orderId);
  }

  /**
   * Cafe의 모든 세션 조회
   */
  getCafeSessions(cafeId: string): OrderSession[] {
    const cafe = this.cafes.get(cafeId);
    return cafe ? Array.from(cafe.sessions.values()) : [];
  }

  /**
   * 모든 세션 조회
   */
  getAllSessions(): Array<{ cafeId: string; sessions: OrderSession[] }> {
    const result: Array<{ cafeId: string; sessions: OrderSession[] }> = [];

    for (const [cafeId, cafe] of this.cafes) {
      result.push({
        cafeId,
        sessions: Array.from(cafe.sessions.values()),
      });
    }

    return result;
  }

  /**
   * 세션 상태 요약
   */
  getStatusSummary(): SessionStatusSummary {
    let totalSessions = 0;
    let runningCount = 0;
    let awaitingInputCount = 0;
    let completedCount = 0;
    let failedCount = 0;

    const cafes: Array<{
      cafeId: string;
      sessionCount: number;
      runningCount: number;
    }> = [];

    const sessions: Array<{
      orderId: string;
      cafeId: string;
      status: SessionStatus;
    }> = [];

    for (const [cafeId, cafe] of this.cafes) {
      let cafeRunning = 0;

      for (const session of cafe.sessions.values()) {
        totalSessions++;
        const status = session.getStatus().status;

        // Add to sessions array
        sessions.push({
          orderId: session.orderId,
          cafeId,
          status,
        });

        switch (status) {
          case 'running':
            runningCount++;
            cafeRunning++;
            break;
          case 'awaiting_input':
            awaitingInputCount++;
            break;
          case 'completed':
            completedCount++;
            break;
          case 'failed':
          case 'cancelled':
            failedCount++;
            break;
        }
      }

      cafes.push({
        cafeId,
        sessionCount: cafe.sessions.size,
        runningCount: cafeRunning,
      });
    }

    return {
      totalCafes: this.cafes.size,
      totalSessions,
      runningCount,
      awaitingInputCount,
      completedCount,
      failedCount,
      cafes,
      sessions,
    };
  }

  /**
   * 세션 취소
   */
  async cancelSession(cafeId: string, orderId: string): Promise<boolean> {
    const session = this.getSession(cafeId, orderId);
    if (!session) {
      return false;
    }

    await session.cancel();
    return true;
  }

  /**
   * Cafe의 모든 세션 취소
   */
  async cancelCafeSessions(cafeId: string): Promise<number> {
    const cafe = this.cafes.get(cafeId);
    if (!cafe) {
      return 0;
    }

    let cancelledCount = 0;
    for (const session of cafe.sessions.values()) {
      if (session.getStatus().status === 'running') {
        await session.cancel();
        cancelledCount++;
      }
    }

    return cancelledCount;
  }

  /**
   * 세션 정리 (완료/실패 후)
   */
  private async cleanupSession(cafeId: string, orderId: string): Promise<void> {
    const cafe = this.cafes.get(cafeId);
    if (!cafe) {
      return;
    }

    const session = cafe.sessions.get(orderId);
    if (session) {
      await session.dispose();
      // 완료된 세션은 일정 시간 후 제거 (히스토리 유지)
      // 여기서는 바로 제거하지 않고 getStatus()로 조회 가능하게 유지
      // 나중에 TTL 기반 정리 추가 가능
    }
  }

  /**
   * 완료된 세션 정리
   */
  async cleanupCompletedSessions(olderThanMs: number = 3600000): Promise<number> {
    let cleanedCount = 0;
    const now = Date.now();

    for (const cafe of this.cafes.values()) {
      for (const [orderId, session] of cafe.sessions) {
        const status = session.getStatus();
        const isTerminal = ['completed', 'failed', 'cancelled'].includes(status.status);

        if (isTerminal && status.completedAt) {
          const completedTime = new Date(status.completedAt).getTime();
          if (now - completedTime > olderThanMs) {
            await session.dispose();
            cafe.sessions.delete(orderId);
            cleanedCount++;
          }
        }
      }
    }

    console.log(`[CafeSessionManager] Cleaned up ${cleanedCount} completed sessions`);
    return cleanedCount;
  }

  /**
   * 전체 정리
   */
  async dispose(): Promise<void> {
    for (const cafe of this.cafes.values()) {
      for (const session of cafe.sessions.values()) {
        await session.dispose();
      }
      cafe.sessions.clear();
    }

    this.cafes.clear();
    this.removeAllListeners();

    console.log('[CafeSessionManager] Disposed all sessions');
  }
}
