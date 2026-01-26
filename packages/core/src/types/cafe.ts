/**
 * Cafe Type Definitions
 * Represents a managed local Git repository.
 */

/**
 * Supported languages for AI responses
 */
export type SupportedLanguage = 'ko' | 'en' | 'ja' | 'zh';

/**
 * Cafe Settings
 */
export interface CafeSettings {
  baseBranch: string; // Default: 'main'
  worktreeRoot: string; // Default: '../.codecafe-worktrees'
  systemPrompt?: string; // Custom system prompt for all orders in this cafe
  language?: SupportedLanguage; // AI response language (default: 'en')
}

/**
 * Cafe (Single Repository Info)
 */
export interface Cafe {
  id: string; // UUID v4
  name: string;
  path: string; // Absolute path
  currentBranch: string;
  isDirty: boolean;
  activeOrders: number;
  createdAt: string; // ISO 8601
  settings: CafeSettings;
}

/**
 * Cafe Registry (List of all cafes)
 * Stored in ~/.codecafe/cafes.json
 */
export interface CafeRegistry {
  version: '1.0';
  cafes: Cafe[];
  lastAccessed?: string; // Cafe ID
}

/**
 * Cafe Creation Parameters
 */
export interface CreateCafeParams extends Partial<CafeSettings> {
  path: string;
}

/**
 * Cafe Update Parameters
 */
export type UpdateCafeParams = Partial<
  Omit<Cafe, 'id' | 'path' | 'createdAt' | 'settings'>
> & {
  settings?: Partial<CafeSettings>;
};
