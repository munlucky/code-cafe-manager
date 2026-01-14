/**
 * Cafe Zod Schemas
 * Validation schemas for Cafe-related data structures
 */

import { z } from 'zod';
import type {
  Cafe,
  CafeRegistry,
  CafeSettings,
  CreateCafeParams,
  UpdateCafeParams,
} from '../types/cafe.js';

export const CafeSettingsSchema = z.object({
  baseBranch: z.string().min(1),
  worktreeRoot: z.string().min(1),
}) satisfies z.ZodType<CafeSettings>;

export const CafeSchema: z.ZodType<Cafe> = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  path: z.string().min(1),
  currentBranch: z.string().min(1),
  isDirty: z.boolean(),
  activeOrders: z.number().int().min(0),
  createdAt: z.string().datetime(),
  settings: CafeSettingsSchema,
});

export const CafeRegistrySchema: z.ZodType<CafeRegistry> = z.object({
  version: z.literal('1.0'),
  cafes: z.array(CafeSchema),
  lastAccessed: z.string().uuid().optional(),
});

export const CreateCafeParamsSchema: z.ZodType<CreateCafeParams> = z.object({
  path: z.string().min(1),
  baseBranch: z.string().min(1).optional(),
  worktreeRoot: z.string().min(1).optional(),
});

export const UpdateCafeParamsSchema: z.ZodType<UpdateCafeParams> = z.object({
  name: z.string().min(1).optional(),
  currentBranch: z.string().min(1).optional(),
  isDirty: z.boolean().optional(),
  activeOrders: z.number().int().min(0).optional(),
  settings: CafeSettingsSchema.partial().optional(),
});
