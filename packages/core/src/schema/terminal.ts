/**
 * Terminal Pool Zod Schemas
 * Runtime validation for Terminal-related types
 */

import { z } from 'zod';

// ProviderType schema
export const ProviderTypeSchema = z.enum(['claude-code', 'codex', 'gemini', 'grok']);

// TerminalStatus schema
export const TerminalStatusSchema = z.enum(['idle', 'busy', 'crashed']);

// LeaseToken schema
export const LeaseTokenSchema = z.object({
  id: z.string(),
  terminalId: z.string(),
  baristaId: z.string(),
  provider: ProviderTypeSchema,
  leasedAt: z.date(),
  expiresAt: z.date(),
  released: z.boolean(),
  releasedAt: z.date().optional(),
});

// Terminal schema (without process field - main process only)
export const TerminalSchema = z.object({
  id: z.string(),
  provider: ProviderTypeSchema,
  status: TerminalStatusSchema,
  currentBarista: z.string().optional(),
  leaseToken: LeaseTokenSchema.optional(),
  createdAt: z.date(),
  lastUsed: z.date(),
});

// ProviderTerminalConfig schema
export const ProviderTerminalConfigSchema = z.object({
  size: z.number().int().positive().default(8),
  timeout: z.number().int().positive().default(30000),
  maxRetries: z.number().int().nonnegative().default(3),
});

// TerminalPoolConfig schema
export const TerminalPoolConfigSchema = z.object({
  perProvider: z.record(ProviderTypeSchema, ProviderTerminalConfigSchema),
});

// PoolStatus schema
export const PoolStatusSchema = z.record(
  z.string(),
  z.object({
    total: z.number().int().nonnegative(),
    idle: z.number().int().nonnegative(),
    busy: z.number().int().nonnegative(),
    crashed: z.number().int().nonnegative(),
  })
);

// PoolMetrics schema
export const PoolMetricsSchema = z.object({
  providers: z.record(
    z.string(),
    z.object({
      totalTerminals: z.number().int().nonnegative(),
      idleTerminals: z.number().int().nonnegative(),
      busyTerminals: z.number().int().nonnegative(),
      crashedTerminals: z.number().int().nonnegative(),
      activeLeases: z.number().int().nonnegative(),
      p99WaitTime: z.number().nonnegative(),
    })
  ),
});

// Type inference from schemas (optional, for convenience)
export type ProviderTypeInferred = z.infer<typeof ProviderTypeSchema>;
export type TerminalStatusInferred = z.infer<typeof TerminalStatusSchema>;
export type LeaseTokenInferred = z.infer<typeof LeaseTokenSchema>;
export type TerminalInferred = z.infer<typeof TerminalSchema>;
export type ProviderTerminalConfigInferred = z.infer<typeof ProviderTerminalConfigSchema>;
export type TerminalPoolConfigInferred = z.infer<typeof TerminalPoolConfigSchema>;
export type PoolStatusInferred = z.infer<typeof PoolStatusSchema>;
export type PoolMetricsInferred = z.infer<typeof PoolMetricsSchema>;
