/**
 * Cafe Zod Schemas
 * Validation schemas for Cafe-related data structures
 */

import { z } from 'zod';

/**
 * Cafe Settings Schema
 */
export const CafeSettingsSchema = z.object({
  baseBranch: z.string().min(1),
  worktreeRoot: z.string().min(1),
});

/**
 * Cafe Schema
 */
export const CafeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  path: z.string().min(1),
  currentBranch: z.string().min(1),
  isDirty: z.boolean(),
  activeOrders: z.number().int().min(0),
  createdAt: z.string().datetime(),
  settings: CafeSettingsSchema,
});

/**
 * Cafe Registry Schema
 */
export const CafeRegistrySchema = z.object({
  version: z.literal('1.0'),
  cafes: z.array(CafeSchema),
  lastAccessed: z.string().uuid().optional(),
});

/**
 * Create Cafe Params Schema
 */
export const CreateCafeParamsSchema = z.object({
  path: z.string().min(1),
  baseBranch: z.string().min(1).optional(),
  worktreeRoot: z.string().min(1).optional(),
});

/**
 * Update Cafe Params Schema
 */
export const UpdateCafeParamsSchema = z.object({
  name: z.string().min(1).optional(),
  currentBranch: z.string().min(1).optional(),
  isDirty: z.boolean().optional(),
  activeOrders: z.number().int().min(0).optional(),
  settings: CafeSettingsSchema.partial().optional(),
});
