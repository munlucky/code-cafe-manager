/**
 * Cafe Type Definitions
 * Cafe = 관리되는 로컬 Git Repository
 */

/**
 * Cafe Registry (전체 Cafe 목록)
 * Location:
 * - Windows: %USERPROFILE%/.codecafe/cafes.json
 * - macOS/Linux: ~/.codecafe/cafes.json
 */
export interface CafeRegistry {
  version: '1.0';
  cafes: Cafe[];
  lastAccessed?: string; // Cafe ID
}

/**
 * Cafe (단일 Repository 정보)
 */
export interface Cafe {
  id: string; // UUID v4
  name: string; // Repository name
  path: string; // Absolute path to repository
  currentBranch: string;
  isDirty: boolean; // Has uncommitted changes
  activeOrders: number; // Number of running orders
  createdAt: string; // ISO 8601
  settings: CafeSettings;
}

/**
 * Cafe Settings
 */
export interface CafeSettings {
  baseBranch: string; // Default: 'main'
  worktreeRoot: string; // Default: '../.codecafe-worktrees'
}

/**
 * Cafe Creation Parameters
 */
export interface CreateCafeParams {
  path: string; // Absolute path to repository
  baseBranch?: string; // Optional, defaults to 'main'
  worktreeRoot?: string; // Optional, defaults to '../.codecafe-worktrees'
}

/**
 * Cafe Update Parameters (partial update)
 */
export interface UpdateCafeParams {
  name?: string;
  currentBranch?: string;
  isDirty?: boolean;
  activeOrders?: number;
  settings?: Partial<CafeSettings>;
}
