/**
 * Session Module - Multi-terminal orchestration
 *
 * 구조:
 * - CafeSessionManager: Cafe별 Order 세션들을 관리
 * - OrderSession: Order 실행 라이프사이클 관리
 * - TerminalGroup: Order당 N개의 터미널 관리
 * - SharedContext: 터미널 간 결과 동기화
 */

// 내부 사용용 클래스 타입 (이름 충돌 방지를 위해 별칭 사용)
export { SharedContext } from './shared-context';
export type { ContextSnapshot } from './shared-context';

export { TerminalGroup } from './terminal-group';
export type {
  TerminalInfo as SessionTerminalInfo,
  TerminalGroupConfig
} from './terminal-group';

export { OrderSession } from './order-session';
export type {
  WorkflowConfig,
  SessionStatus,
  AwaitingState,
  FailedState
} from './order-session';

// Session 내부 StageConfig (외부 StageConfig와 이름 충돌 방지)
export type { StageConfig as SessionStageConfig } from './order-session';

// Stage Orchestrator
export { StageOrchestrator, createOrchestrator } from './stage-orchestrator';
export type { OrchestratorConfig } from './stage-orchestrator';

// Stage Signals
export type {
  StageSignals,
  OrchestratorDecision,
  NextAction,
  ComplexityLevel
} from './stage-signals';
export { DEFAULT_SIGNALS, isValidSignals } from './stage-signals';

// Signal Parser
export { SignalParser, signalParser } from './signal-parser';
export type { ParseResult } from './signal-parser';

export { CafeSessionManager } from './cafe-session-manager';
export type {
  CafeSessionInfo,
  SessionManagerConfig,
  SessionStatusSummary
} from './cafe-session-manager';

// SharedContext의 StageResult (별칭으로 내보내기)
export type { StageResult as SessionStageResult } from './shared-context';

/**
 * Session Event Payload Types
 * BaristaEngine/CafeSessionManager에서 발생하는 이벤트의 페이로드 타입
 */

/** order:started 이벤트 페이로드 */
export interface OrderStartedEvent {
  orderId: string;
  cafeId: string;
}

/** order:completed 이벤트 페이로드 */
export interface OrderCompletedEvent {
  orderId: string;
  cafeId: string;
  output?: string;
  context?: unknown;
}

/** order:failed 이벤트 페이로드 */
export interface OrderFailedEvent {
  orderId: string;
  cafeId: string;
  error: string;
  /** 재시도 가능 여부 */
  canRetry?: boolean;
  /** 실패 상태 정보 (재시도용) */
  failedState?: {
    failedStageId: string;
    completedStages: string[];
    retryOptions: Array<{ stageId: string; stageName: string; batchIndex: number }>;
  };
}

/** stage:started 이벤트 페이로드 */
export interface StageStartedEvent {
  orderId: string;
  stageId: string;
  provider: string;
}

/** stage:completed 이벤트 페이로드 */
export interface StageCompletedEvent {
  orderId: string;
  stageId: string;
  output: string;
  duration: number;
}

/** stage:failed 이벤트 페이로드 */
export interface StageFailedEvent {
  orderId: string;
  stageId: string;
  error: string;
}

/** session:awaiting 이벤트 페이로드 */
export interface SessionAwaitingEvent {
  orderId: string;
  stageId: string;
  questions?: string[];
  message?: string;
}

/** session:resumed 이벤트 페이로드 */
export interface SessionResumedEvent {
  orderId: string;
  userInput: string;
}
