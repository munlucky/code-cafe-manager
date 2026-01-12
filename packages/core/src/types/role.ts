/**
 * Role System 관련 타입 정의
 */

export interface Role {
  id: string; // 'planner' | 'coder' | 'tester' | 'reviewer' | custom
  name: string;
  systemPrompt: string; // Handlebars template
  skills: string[]; // Tool names
  recommendedProvider: ProviderType;
  variables: RoleVariable[];
  isDefault: boolean; // true for packages/roles/*.md
  source: string; // File path
}

export interface RoleVariable {
  name: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  default?: string | number | boolean;
  description?: string;
}

export interface RoleFrontmatter {
  id: string;
  name: string;
  recommended_provider: ProviderType;
  skills: string[];
  variables?: RoleVariable[];
}

// ProviderType은 packages/core/src/types.ts에서 import
import { ProviderType } from '../types.js';