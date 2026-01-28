/**
 * Events Module - 세션 이벤트 전파
 */

export { SessionEventPropagator } from './event-propagator';
export type { SessionEventType } from './event-propagator';

// Typed event definitions
export type {
  // Session events
  SessionStartedData,
  SessionCompletedData,
  SessionFailedData,
  SessionCancelledData,
  SessionAwaitingData,
  SessionResumedData,
  SessionEvents,
  // Stage events
  StageStartedData,
  StageCompletedData,
  StageFailedData,
  StageProgressData,
  StageEvents,
  // Followup events
  FollowupStartedData,
  FollowupCompletedData,
  FollowupFailedData,
  FollowupEvents,
  // Output events
  OutputData,
  OutputEvents,
  // Combined event map
  OrderSessionEvents,
} from './session-events';
