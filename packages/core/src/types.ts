/**
 * Core domain types for CodeCafe
 */

// Barista (실행 유닛) 상태
export enum BaristaStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  ERROR = 'ERROR',
  STOPPED = 'STOPPED',
}

// Order (실행 인스턴스) 상태
export enum OrderStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

// Provider (원두) 타입
export type ProviderType = 'claude-code' | 'codex' | 'gemini' | 'grok';

// Workspace 모드
export type WorkspaceMode = 'in-place' | 'worktree' | 'temp';

/**
 * Barista (실행 유닛)
 */
export interface Barista {
  id: string;
  status: BaristaStatus;
  currentOrderId: string | null;
  provider: ProviderType;
  createdAt: Date;
  lastActivityAt: Date;
}

/**
 * Order (주문 = 워크플로우 실행 인스턴스)
 */
export interface Order {
  id: string;
  workflowId: string;
  workflowName: string;
  baristaId: string | null;
  status: OrderStatus;
  counter: string; // 실행 대상 프로젝트 경로 (worktree 모드 시 worktree 경로)
  provider: ProviderType;
  vars: Record<string, string>;
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  error?: string;
  // M2 추가: Worktree 정보
  worktreeInfo?: {
    path: string;
    branch: string;
    baseBranch: string;
  };
  // @deprecated Legacy fields for backward compatibility (Recipe → Workflow)
  recipeId?: string;
  recipeName?: string;
}

/**
 * Receipt (영수증 = 실행 결과 요약)
 */
export interface Receipt {
  orderId: string;
  status: OrderStatus;
  startedAt: Date;
  endedAt: Date;
  provider: ProviderType;
  counter: string;
  errorSummary?: string;
  changedFiles?: string[];
  logs?: string;
}

/**
 * Event types
 */
export enum EventType {
  BARISTA_CREATED = 'barista:created',
  BARISTA_STATUS_CHANGED = 'barista:status-changed',
  ORDER_CREATED = 'order:created',
  ORDER_ASSIGNED = 'order:assigned',
  ORDER_STATUS_CHANGED = 'order:status-changed',
  ORDER_LOG = 'order:log',
  ORDER_COMPLETED = 'order:completed',
}

export interface BaristaEvent {
  type: EventType;
  timestamp: Date;
  baristaId: string;
  data: any;
}

export interface OrderEvent {
  type: EventType;
  timestamp: Date;
  orderId: string;
  data: any;
}
