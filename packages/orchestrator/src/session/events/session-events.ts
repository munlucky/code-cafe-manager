/**
 * Session Event Types - 세션 관련 이벤트 타입 정의
 *
 * TypedEventEmitter와 함께 사용하여 타입 안전한 이벤트 처리를 제공합니다.
 */

// ============================================================================
// Session Event Data Types
// ============================================================================

/**
 * 세션 시작 이벤트 데이터
 */
export interface SessionStartedData {
  sessionId: string;
  orderId: string;
  workflowId: string;
  timestamp: Date;
}

/**
 * 세션 완료 이벤트 데이터
 */
export interface SessionCompletedData {
  sessionId: string;
  orderId: string;
  duration: number;
  status: 'completed' | 'failed' | 'cancelled';
  timestamp: Date;
}

/**
 * 세션 실패 이벤트 데이터
 */
export interface SessionFailedData {
  sessionId: string;
  orderId: string;
  error: Error;
  canRetry: boolean;
  timestamp: Date;
}

/**
 * 세션 취소 이벤트 데이터
 */
export interface SessionCancelledData {
  sessionId: string;
  orderId: string;
  reason?: string;
  timestamp: Date;
}

/**
 * 세션 대기 이벤트 데이터
 */
export interface SessionAwaitingData {
  sessionId: string;
  orderId: string;
  stageId: string;
  questions?: string[];
  message?: string;
  timestamp: Date;
}

/**
 * 세션 재개 이벤트 데이터
 */
export interface SessionResumedData {
  sessionId: string;
  orderId: string;
  userInput?: string;
  fromStageId?: string;
  retryType?: 'stage' | 'beginning';
  attemptNumber?: number;
  timestamp: Date;
}

// ============================================================================
// Stage Event Data Types
// ============================================================================

/**
 * 스테이지 시작 이벤트 데이터
 */
export interface StageStartedData {
  sessionId: string;
  stageId: string;
  stageName: string;
  stageIndex: number;
  timestamp: Date;
}

/**
 * 스테이지 완료 이벤트 데이터
 */
export interface StageCompletedData {
  sessionId: string;
  stageId: string;
  stageName: string;
  status: 'completed' | 'failed' | 'skipped';
  duration: number;
  output?: unknown;
  timestamp: Date;
}

/**
 * 스테이지 실패 이벤트 데이터
 */
export interface StageFailedData {
  sessionId: string;
  stageId: string;
  stageName: string;
  error: Error;
  canRetry: boolean;
  timestamp: Date;
}

/**
 * 스테이지 진행 이벤트 데이터
 */
export interface StageProgressData {
  sessionId: string;
  stageId: string;
  stageName: string;
  progress: number; // 0-100
  message?: string;
  timestamp: Date;
}

// ============================================================================
// Output Event Data Types
// ============================================================================

/**
 * 출력 이벤트 데이터
 */
export interface OutputData {
  sessionId: string;
  orderId: string;
  stageId?: string;
  data: string;
  timestamp: Date;
}

// ============================================================================
// Followup Event Data Types
// ============================================================================

/**
 * Followup 시작 이벤트 데이터
 */
export interface FollowupStartedData {
  sessionId: string;
  orderId: string;
  prompt: string;
  timestamp: Date;
}

/**
 * Followup 완료 이벤트 데이터
 */
export interface FollowupCompletedData {
  sessionId: string;
  orderId: string;
  stageId: string;
  output?: string;
  timestamp: Date;
}

/**
 * Followup 실패 이벤트 데이터
 */
export interface FollowupFailedData {
  sessionId: string;
  orderId: string;
  stageId?: string;
  error: string;
  timestamp: Date;
}

// ============================================================================
// Event Maps
// ============================================================================

/**
 * 세션 이벤트 맵 - 세션 레벨 이벤트
 */
export interface SessionEvents {
  'session:started': (data: SessionStartedData) => void;
  'session:completed': (data: SessionCompletedData) => void;
  'session:failed': (data: SessionFailedData) => void;
  'session:cancelled': (data: SessionCancelledData) => void;
  'session:awaiting': (data: SessionAwaitingData) => void;
  'session:resumed': (data: SessionResumedData) => void;
}

/**
 * 스테이지 이벤트 맵 - 스테이지 레벨 이벤트
 */
export interface StageEvents {
  'stage:started': (data: StageStartedData) => void;
  'stage:completed': (data: StageCompletedData) => void;
  'stage:failed': (data: StageFailedData) => void;
  'stage:progress': (data: StageProgressData) => void;
}

/**
 * Followup 이벤트 맵
 */
export interface FollowupEvents {
  'followup:started': (data: FollowupStartedData) => void;
  'followup:completed': (data: FollowupCompletedData) => void;
  'followup:failed': (data: FollowupFailedData) => void;
  'followup:finished': (data: { sessionId: string; orderId: string; timestamp: Date }) => void;
}

/**
 * 출력 이벤트 맵
 */
export interface OutputEvents {
  output: (data: OutputData) => void;
}

/**
 * 통합 주문 세션 이벤트 맵 - 모든 이벤트 포함
 */
export interface OrderSessionEvents
  extends SessionEvents,
    StageEvents,
    FollowupEvents,
    OutputEvents {}
