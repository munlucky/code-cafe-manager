// 도메인 모델 타입 정의
export type ProviderType = 'claude-code' | 'codex' | 'gemini' | 'grok';
export type BaristaStatus = 'IDLE' | 'RUNNING' | 'ERROR' | 'STOPPED';
export type OrderStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type WorkspaceMode = 'in-place' | 'worktree' | 'temp';
export type StepType = 'ai.interactive' | 'ai.prompt' | 'shell' | 'parallel';

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
  recipeId: string;
  recipeName: string;
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

export interface Recipe {
  name: string;
  version: string;
  defaults: {
    provider: ProviderType;
    workspace: {
      mode: WorkspaceMode;
      baseBranch?: string;
      clean?: boolean;
    };
  };
  inputs: {
    counter: string;
  };
  vars: Record<string, string>;
  steps: RecipeStep[];
}

export interface RecipeStep {
  id: string;
  type: StepType;
  provider?: ProviderType;
  depends_on?: string[];
  timeout_sec?: number;
  retry?: number;
  agent_ref?: {
    type: 'github' | 'local' | 'url';
    url?: string;
    path?: string;
  };
  prompt?: string;
  command?: string;
  steps?: RecipeStep[];
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
