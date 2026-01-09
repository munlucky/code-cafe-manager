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

// Step 타입
export type StepType =
  | 'ai.interactive'
  | 'ai.prompt'
  | 'shell'
  | 'parallel'
  | 'conditional'
  | 'context.collect'
  | 'data.passthrough';

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
 * Order (주문 = 레시피 실행 인스턴스)
 */
export interface Order {
  id: string;
  recipeId: string;
  recipeName: string;
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
}

/**
 * Recipe (워크플로우 정의)
 */
export interface Recipe {
  name: string;
  version: string;
  defaults: RecipeDefaults;
  inputs: RecipeInputs;
  vars: Record<string, string>;
  steps: RecipeStep[];
}

export interface RecipeDefaults {
  provider: ProviderType;
  workspace: WorkspaceConfig;
}

export interface RecipeInputs {
  counter: string;
}

export interface WorkspaceConfig {
  mode: WorkspaceMode;
  baseBranch?: string;
  clean?: boolean;
}

/**
 * Recipe Step
 */
export interface RecipeStep {
  id: string;
  type: StepType;
  provider?: ProviderType;
  depends_on?: string[];
  timeout_sec?: number;
  retry?: number;

  // Data flow
  inputs?: Record<string, any>;
  outputs?: string[];

  // ai.interactive / ai.prompt 전용
  agent_ref?: AgentReference;
  prompt?: string;

  // shell 전용
  command?: string;

  // parallel 전용
  steps?: RecipeStep[];

  // conditional 전용
  condition?: string;
  when_true?: RecipeStep[];
  when_false?: RecipeStep[];

  // context.collect 전용
  collect?: string[];
}

export interface AgentReference {
  type: 'github' | 'local' | 'url';
  url?: string;
  path?: string;
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
