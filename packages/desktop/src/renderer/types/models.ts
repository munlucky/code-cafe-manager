// 도메인 모델 타입 정의
export type ProviderType = 'claude-code' | 'codex' | 'gemini' | 'grok';
export type BaristaStatus = 'IDLE' | 'RUNNING' | 'ERROR' | 'STOPPED';
export enum OrderStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}
export type WorkspaceMode = 'in-place' | 'worktree' | 'temp';

export interface Barista {
  id: string;
  status: BaristaStatus;
  currentOrderId: string | null;
  provider: ProviderType;
  createdAt: Date | string;
  lastActivityAt: Date | string;
}

export interface Order {
  id: string;
  workflowId: string;
  workflowName: string;
  baristaId: string | null;
  status: OrderStatus;
  counter: string;
  provider: ProviderType;
  vars: Record<string, any>;
  createdAt: Date | string;
  startedAt: Date | string | null;
  endedAt: Date | string | null;
  error?: string;
  worktreeInfo?: {
    path: string;
    branch: string;
    baseBranch: string;
  };
}

export interface WorktreeInfo {
  path: string;
  branch: string | null;
  commit: string | null;
}

export interface Receipt {
  orderId: string;
  status: OrderStatus;
  startedAt: Date | string;
  endedAt: Date | string;
  provider: ProviderType;
  counter: string;
  errorSummary?: string;
  changedFiles?: string[];
  logs?: string;
}
