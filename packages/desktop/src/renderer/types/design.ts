export enum OrderStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  WAITING_INPUT = 'WAITING_INPUT',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface CafeSettings {
  baseBranch: string;
  worktreeRoot: string;
}

export interface Cafe {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  lastAccessedAt?: string;
  settings: CafeSettings;
  activeOrdersCount: number;
}

export type WorktreeInfo =
  | {
      path: string;
      branch: string;
      baseBranch: string;
      repoPath: string;
      removed?: false;
      merged?: boolean;
      mergedTo?: string;
      mergeCommit?: string;
    }
  | {
      removed: true;
      path?: string;
      branch?: string;
      baseBranch?: string;
      repoPath?: string;
      merged?: boolean;
      mergedTo?: string;
      mergeCommit?: string;
    };

export interface WorkflowLog {
  id: string;
  timestamp: string;
  content: string;
  type: 'info' | 'error' | 'success' | 'system' | 'ai';
}

export interface DesignOrder {
  id: string;
  workflowId: string;
  workflowName: string; // Snapshotted name in case recipe changes
  status: OrderStatus;
  cafeId: string;

  // Variables & Config
  vars: Record<string, string>;

  // Worktree (Optional)
  worktreeInfo?: WorktreeInfo;

  // Runtime State
  currentStage: string;
  logs: WorkflowLog[];

  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

// Legacy alias for backward compatibility
export type Order = DesignOrder;

export type SkillCategory = 'planning' | 'implementation' | 'verification' | 'review';

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  instructions: string; // The prompt/instructions for the AI
  isBuiltIn: boolean;   // Built-in skills cannot be deleted
}

export interface StageConfig {
  skills: string[]; // List of Skill IDs assigned to this stage
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  stages: string[]; // List of stage names (e.g., ['analyze', 'plan', 'code'])
  stageConfigs: Record<string, StageConfig>; // Configuration for each stage mapping to skills
  isDefault?: boolean; // Default recipe flag
  protected?: boolean; // Cannot be deleted or modified
}

// Deprecated alias for backward compatibility if needed, but we use Recipe now
export type WorkflowDefinition = Recipe;
