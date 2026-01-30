/**
 * PluginSessionManager - 플러그인 세션 관리
 *
 * 세션 생성, 조회, 삭제 및 채팅 세션과의 매핑을 담당합니다.
 */

import { EventEmitter } from 'events';
import { createLogger } from '@codecafe/core';
import {
  PluginSession,
  PluginSessionStatus,
  ExecutionMode,
  PluginEvent,
  PluginEventType,
  PluginConfig,
} from './types';

const logger = createLogger({ context: 'PluginSessionManager' });

/**
 * 세션 생성 옵션
 */
export interface CreateSessionOptions {
  userId: string;
  channelId?: string;
  workingDirectory: string;
  executionMode: ExecutionMode;
  timeout?: number;
  env?: Record<string, string>;
  nodeId?: string;
}

/**
 * 기본 설정
 */
const DEFAULT_CONFIG: Required<PluginConfig> = {
  defaultTimeout: 1800, // 30분
  maxConcurrentSessions: 10,
  pollInterval: 1000, // 1초
  screenshotFormat: 'png',
  screenshotQuality: 80,
};

/**
 * PluginSessionManager - 플러그인 세션 관리자
 */
export class PluginSessionManager extends EventEmitter {
  private readonly sessions = new Map<string, PluginSession>();
  private readonly userSessions = new Map<string, Set<string>>(); // userId -> sessionIds
  private readonly channelSessions = new Map<string, string>(); // channelId -> sessionId
  private readonly config: Required<PluginConfig>;
  private sessionCounter = 0;

  constructor(config?: PluginConfig) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 새 세션 생성
   */
  createSession(options: CreateSessionOptions): PluginSession {
    // 동시 세션 수 제한 확인
    if (this.sessions.size >= this.config.maxConcurrentSessions) {
      throw new Error(
        `Maximum concurrent sessions (${this.config.maxConcurrentSessions}) reached`
      );
    }

    // 세션 ID 생성
    const sessionId = this.generateSessionId();

    const session: PluginSession = {
      sessionId,
      userId: options.userId,
      channelId: options.channelId,
      workingDirectory: options.workingDirectory,
      executionMode: options.executionMode,
      status: 'created',
      createdAt: new Date(),
      lastActivityAt: new Date(),
      timeout: options.timeout ?? this.config.defaultTimeout,
      env: options.env,
      nodeId: options.nodeId,
    };

    // 세션 저장
    this.sessions.set(sessionId, session);

    // 사용자별 세션 매핑
    const userSessionSet = this.userSessions.get(options.userId) ?? new Set();
    userSessionSet.add(sessionId);
    this.userSessions.set(options.userId, userSessionSet);

    // 채널별 세션 매핑 (있는 경우)
    if (options.channelId) {
      // 기존 채널 세션이 있으면 종료
      const existingSessionId = this.channelSessions.get(options.channelId);
      if (existingSessionId && existingSessionId !== sessionId) {
        logger.debug(`Replacing existing session ${existingSessionId} in channel ${options.channelId}`);
        this.updateSessionStatus(existingSessionId, 'cancelled');
      }
      this.channelSessions.set(options.channelId, sessionId);
    }

    logger.debug(`Created session ${sessionId}`, {
      userId: options.userId,
      channelId: options.channelId,
      executionMode: options.executionMode,
    });

    this.emitEvent('session:created', sessionId, { session });

    return session;
  }

  /**
   * 세션 조회
   */
  getSession(sessionId: string): PluginSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 채널로 세션 조회
   */
  getSessionByChannel(channelId: string): PluginSession | undefined {
    const sessionId = this.channelSessions.get(channelId);
    return sessionId ? this.sessions.get(sessionId) : undefined;
  }

  /**
   * 사용자의 모든 세션 조회
   */
  getUserSessions(userId: string): PluginSession[] {
    const sessionIds = this.userSessions.get(userId);
    if (!sessionIds) return [];

    return Array.from(sessionIds)
      .map((id) => this.sessions.get(id))
      .filter((s): s is PluginSession => s !== undefined);
  }

  /**
   * 세션 상태 업데이트
   */
  updateSessionStatus(sessionId: string, status: PluginSessionStatus): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`Session ${sessionId} not found`);
      return false;
    }

    const previousStatus = session.status;
    session.status = status;
    session.lastActivityAt = new Date();

    logger.debug(`Session ${sessionId} status: ${previousStatus} -> ${status}`);

    // 상태에 따른 이벤트 발생
    if (status === 'completed') {
      this.emitEvent('session:completed', sessionId, { previousStatus });
    } else if (status === 'failed') {
      this.emitEvent('session:failed', sessionId, { previousStatus });
    } else if (status === 'cancelled') {
      this.emitEvent('session:cancelled', sessionId, { previousStatus });
    }

    return true;
  }

  /**
   * 내부 세션 ID 설정 (프로세스 세션 연결)
   */
  setInternalSessionId(sessionId: string, internalId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.internalSessionId = internalId;
    return true;
  }

  /**
   * 세션 활동 시간 업데이트
   */
  touchSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.lastActivityAt = new Date();
    return true;
  }

  /**
   * 세션 삭제
   */
  deleteSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // 매핑 제거
    const userSessionSet = this.userSessions.get(session.userId);
    if (userSessionSet) {
      userSessionSet.delete(sessionId);
      if (userSessionSet.size === 0) {
        this.userSessions.delete(session.userId);
      }
    }

    if (session.channelId) {
      const currentChannelSession = this.channelSessions.get(session.channelId);
      if (currentChannelSession === sessionId) {
        this.channelSessions.delete(session.channelId);
      }
    }

    // 세션 삭제
    this.sessions.delete(sessionId);

    logger.debug(`Deleted session ${sessionId}`);

    return true;
  }

  /**
   * 타임아웃된 세션 정리
   */
  cleanupTimedOutSessions(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions) {
      if (session.status === 'running' || session.status === 'awaiting_input') {
        const elapsedMs = now - session.lastActivityAt.getTime();
        const timeoutMs = session.timeout * 1000;

        if (elapsedMs > timeoutMs) {
          logger.debug(`Session ${sessionId} timed out after ${session.timeout}s`);
          this.updateSessionStatus(sessionId, 'failed');
          cleanedCount++;
        }
      }
    }

    return cleanedCount;
  }

  /**
   * 모든 세션 정보 조회
   */
  getAllSessions(): PluginSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * 활성 세션 수 조회
   */
  getActiveSessionCount(): number {
    let count = 0;
    for (const session of this.sessions.values()) {
      if (session.status === 'running' || session.status === 'awaiting_input') {
        count++;
      }
    }
    return count;
  }

  /**
   * 설정 조회
   */
  getConfig(): Required<PluginConfig> {
    return { ...this.config };
  }

  /**
   * 세션 ID 생성
   */
  private generateSessionId(): string {
    this.sessionCounter++;
    const timestamp = Date.now().toString(36);
    const counter = this.sessionCounter.toString(36).padStart(4, '0');
    const random = Math.random().toString(36).substring(2, 6);
    return `cc-${timestamp}-${counter}-${random}`;
  }

  /**
   * 이벤트 발생
   */
  private emitEvent(
    type: PluginEventType,
    sessionId: string,
    data?: unknown
  ): void {
    const event: PluginEvent = {
      type,
      sessionId,
      timestamp: Date.now(),
      data,
    };
    this.emit(type, event);
    this.emit('event', event);
  }

  /**
   * 정리
   */
  dispose(): void {
    this.sessions.clear();
    this.userSessions.clear();
    this.channelSessions.clear();
    this.removeAllListeners();
    logger.debug('PluginSessionManager disposed');
  }
}
