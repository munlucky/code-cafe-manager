import { z } from 'zod';

/**
 * Zod schemas for Recipe validation
 */

export const ProviderTypeSchema = z.enum(['claude-code', 'codex', 'gemini', 'grok']);

export const WorkspaceModeSchema = z.enum(['in-place', 'worktree', 'temp']);

export const StepTypeSchema = z.enum(['ai.interactive', 'ai.prompt', 'shell', 'parallel']);

export const AgentReferenceSchema = z.object({
  type: z.enum(['github', 'local', 'url']),
  url: z.string().optional(),
  path: z.string().optional(),
});

export const WorkspaceConfigSchema = z.object({
  mode: WorkspaceModeSchema,
  baseBranch: z.string().optional(),
  clean: z.boolean().optional(),
});

export const RecipeDefaultsSchema = z.object({
  provider: ProviderTypeSchema,
  workspace: WorkspaceConfigSchema,
});

export const RecipeInputsSchema = z.object({
  counter: z.string(),
});

// Recursive step schema (for parallel steps)
const BaseRecipeStepSchema = z.object({
  id: z.string(),
  type: StepTypeSchema,
  provider: ProviderTypeSchema.optional(),
  depends_on: z.array(z.string()).optional(),
  timeout_sec: z.number().positive().optional(),
  retry: z.number().int().nonnegative().optional(),
  agent_ref: AgentReferenceSchema.optional(),
  prompt: z.string().optional(),
  command: z.string().optional(),
});

export type RecipeStepInput = z.infer<typeof BaseRecipeStepSchema> & {
  steps?: RecipeStepInput[];
};

export const RecipeStepSchema: z.ZodType<RecipeStepInput> = BaseRecipeStepSchema.extend({
  steps: z.lazy(() => RecipeStepSchema.array()).optional(),
});

export const RecipeSchema = z.object({
  name: z.string().min(1, 'Recipe name is required'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be semver format (e.g., 0.1.0)'),
  defaults: RecipeDefaultsSchema,
  inputs: RecipeInputsSchema,
  vars: z.record(z.string()).default({}),
  steps: z.array(RecipeStepSchema).min(1, 'Recipe must have at least one step'),
});

export type RecipeInput = z.infer<typeof RecipeSchema>;

/**
 * Validate recipe YAML
 */
export function validateRecipe(data: unknown): RecipeInput {
  return RecipeSchema.parse(data);
}

/**
 * Safe validate recipe YAML
 */
export function safeValidateRecipe(data: unknown): {
  success: boolean;
  data?: RecipeInput;
  errors?: z.ZodIssue[];
} {
  const result = RecipeSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, errors: result.error.issues };
  }
}
