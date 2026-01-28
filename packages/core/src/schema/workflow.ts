/**
 * Workflow Zod Schemas
 * Validation schemas for workflow configuration data structures
 */

import { z } from 'zod';

/**
 * Schema for stage assignment configuration
 */
export const StageAssignmentSchema = z.object({
  provider: z.string(),
  role: z.string().optional(),
  profile: z.string().optional(),
  /** Execution mode: sequential (default) or parallel */
  mode: z.enum(['sequential', 'parallel']).optional(),
  /** Failure handling strategy */
  on_failure: z.enum(['stop', 'continue', 'retry']).optional(),
  /** Number of retries when on_failure is 'retry' */
  retries: z.number().int().positive().optional(),
  /** Backoff multiplier in seconds for retries */
  retry_backoff: z.number().positive().optional(),
  /** List of skill names to use */
  skills: z.array(z.string()).optional(),
  /** Custom prompt template for this stage */
  prompt: z.string().optional(),
});

export type StageAssignment = z.infer<typeof StageAssignmentSchema>;

/**
 * Schema for workflow metadata (workflow section in YAML)
 */
export const WorkflowMetadataSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  stages: z.array(z.string()).optional(),
  isDefault: z.boolean().optional(),
  protected: z.boolean().optional(),
});

export type WorkflowMetadata = z.infer<typeof WorkflowMetadataSchema>;

/**
 * Schema for the workflow.yml file structure
 * Format:
 * workflow:
 *   name: "..."
 *   description: "..."
 *   stages: [plan, code, test, check]
 * plan:
 *   provider: "claude-code"
 *   role: "planner"
 * code:
 *   provider: "claude-code"
 */
export const WorkflowYamlSchema = z.object({
  workflow: WorkflowMetadataSchema.optional(),
}).passthrough(); // Allow additional stage-specific properties

export type WorkflowYaml = z.infer<typeof WorkflowYamlSchema>;

/**
 * Schema for WorkflowInfo used in UI/API
 */
export const WorkflowInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  stages: z.array(z.string()),
  /** Stage-specific configurations */
  stageConfigs: z.record(z.string(), StageAssignmentSchema).optional(),
  /** Whether this is a default workflow */
  isDefault: z.boolean().optional(),
  /** Whether this workflow is protected from deletion/modification */
  protected: z.boolean().optional(),
});

export type WorkflowInfo = z.infer<typeof WorkflowInfoSchema>;

/**
 * Parse and validate workflow YAML content
 * Returns validated data or throws a validation error
 */
export function parseWorkflowYaml(data: unknown): WorkflowYaml {
  return WorkflowYamlSchema.parse(data);
}

/**
 * Safely parse workflow YAML content
 * Returns a result object with success flag and data or error
 */
export function safeParseWorkflowYaml(data: unknown): z.SafeParseReturnType<unknown, WorkflowYaml> {
  return WorkflowYamlSchema.safeParse(data);
}

/**
 * Parse stage assignment from raw data
 * Handles both object format and string format (legacy)
 */
export function parseStageAssignment(data: unknown): StageAssignment | null {
  if (typeof data === 'string') {
    // Legacy format: stage: profile (string)
    return {
      provider: 'claude-code',
      profile: data,
    };
  }

  if (typeof data === 'object' && data !== null) {
    const result = StageAssignmentSchema.safeParse(data);
    if (result.success) {
      return result.data;
    }
  }

  return null;
}
