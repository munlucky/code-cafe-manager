/**
 * Event type definitions for IPC communication
 * Provides type safety for order/stage events
 */

/**
 * Output event types from order execution
 */
export type OutputEventType =
  | 'stage_start'
  | 'stage_end'
  | 'output'
  | 'error'
  | 'tool'
  | 'tool_result'
  | 'todo_progress'
  | 'result'
  | 'json'
  | 'user-input'
  | 'system'
  | 'stdout'
  | 'stderr';

/**
 * Stage information in events
 */
export interface StageInfo {
  stageId: string;
  stageName?: string;
  status?: 'running' | 'completed' | 'failed';
}

/**
 * Order output event from IPC
 */
export interface OrderOutputEvent {
  orderId: string;
  timestamp: string;
  type: OutputEventType;
  content?: string;
  stageInfo?: StageInfo;
}

/**
 * Order stage started event
 */
export interface OrderStageStartedEvent {
  orderId: string;
  stageId: string;
  stageName: string;
  provider: string;
  skills: string[];
}

/**
 * Order session status event
 */
export interface SessionStatusEvent {
  orderId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  awaitingInput: boolean;
  awaitingPrompt?: string;
}

/**
 * Todo progress event
 */
export interface TodoProgressEvent {
  orderId: string;
  timestamp: string;
  completed: number;
  inProgress: number;
  total: number;
  todos?: Array<{
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
    activeForm?: string;
  }>;
}
