/**
 * Role System Zod Schemas
 * Runtime validation for Role-related types
 */

import { z } from 'zod';
import type { Role, RoleFrontmatter, RoleVariable } from '../types/role.js';
import { ProviderTypeSchema } from './terminal.js';

export const RoleVariableSchema: z.ZodType<RoleVariable> = z.object({
  name: z.string().min(1, 'Variable name is required'),
  type: z.enum(['string', 'number', 'boolean']),
  required: z.boolean(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  description: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.default !== undefined) {
    if (typeof data.default !== data.type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Default value must be of type '${data.type}'`,
        path: ['default'],
      });
    }
  }
});

export const RoleFrontmatterSchema: z.ZodType<RoleFrontmatter> = z.object({
  id: z.string().min(1, 'Role ID is required'),
  name: z.string().min(1, 'Role name is required'),
  recommended_provider: ProviderTypeSchema,
  skills: z.array(z.string()),
  variables: z.array(RoleVariableSchema).optional(),
});

export const RoleSchema: z.ZodType<Role> = z.object({
  id: z.string().min(1, 'Role ID is required'),
  name: z.string().min(1, 'Role name is required'),
  systemPrompt: z.string(),
  skills: z.array(z.string()),
  recommendedProvider: ProviderTypeSchema,
  variables: z.array(RoleVariableSchema),
  isDefault: z.boolean(),
  source: z.string(),
});
