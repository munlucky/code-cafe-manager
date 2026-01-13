/**
 * Role System Zod Schemas
 * Runtime validation for Role-related types
 */

import { z } from 'zod';
import { ProviderTypeSchema } from './terminal.js';

// RoleVariable schema
export const RoleVariableSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean']),
  required: z.boolean(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  description: z.string().optional(),
});

// RoleFrontmatter schema
export const RoleFrontmatterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  recommended_provider: ProviderTypeSchema,
  skills: z.array(z.string()),
  variables: z.array(RoleVariableSchema).optional(),
});

// Role schema
export const RoleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  systemPrompt: z.string(),
  skills: z.array(z.string()),
  recommendedProvider: ProviderTypeSchema,
  variables: z.array(RoleVariableSchema),
  isDefault: z.boolean(),
  source: z.string(),
});

// Type inference from schemas (optional, for convenience)
export type RoleVariableInferred = z.infer<typeof RoleVariableSchema>;
export type RoleFrontmatterInferred = z.infer<typeof RoleFrontmatterSchema>;
export type RoleInferred = z.infer<typeof RoleSchema>;
