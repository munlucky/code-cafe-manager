/**
 * Step 타입 정의
 * Phase 2: Role-based execution steps
 */

export interface Step {
  id: string;
  task: string;
  parameters?: Record<string, any>;
  roleId?: string; // Optional role ID for this step
  timeout?: number; // Step timeout in milliseconds
  retryCount?: number; // Number of retry attempts
  dependsOn?: string[]; // Step dependencies
}