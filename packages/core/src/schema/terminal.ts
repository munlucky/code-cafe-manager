/**
 * Terminal Pool Zod Schemas
 * Runtime validation for Terminal-related types
 */

import { z } from 'zod';
import type { ProviderType } from '../types.js';
import type {
  LeaseToken,
  PoolMetrics,
  PoolStatus,
  ProviderTerminalConfig,
  Terminal,
  TerminalPoolConfig,
  TerminalStatus,
} from '../types/terminal.js';

export const ProviderTypeSchema: z.ZodType<ProviderType> = z.enum([
  'claude-code',
  'codex',
  'gemini',
  'grok',
]);

export const TerminalStatusSchema: z.ZodType<TerminalStatus> = z.enum([
  'idle',
  'busy',
  'crashed',
]);

export const LeaseTokenSchema: z.ZodType<LeaseToken> = z.object({
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
export const TerminalSchema: z.ZodType<Omit<Terminal, 'process'>> = z.object({
  id: z.string(),
  provider: ProviderTypeSchema,
  status: TerminalStatusSchema,
  currentBarista: z.string().optional(),
  leaseToken: LeaseTokenSchema.optional(),
  createdAt: z.date(),
  lastUsed: z.date(),
});

export const ProviderTerminalConfigSchema: z.ZodType<ProviderTerminalConfig> = z.object(
  {
    size: z.number().int().positive().default(8),
    timeout: z.number().int().positive().default(30000),
    maxRetries: z.number().int().nonnegative().default(3),
  }
);

export const TerminalPoolConfigSchema: z.ZodType<TerminalPoolConfig> = z.object({
  perProvider: z.record(ProviderTypeSchema, ProviderTerminalConfigSchema),
});

export const PoolStatusSchema: z.ZodType<PoolStatus> = z.record(
  z.string(),
  z.object({
    total: z.number().int().nonnegative(),
    idle: z.number().int().nonnegative(),
    busy: z.number().int().nonnegative(),
    crashed: z.number().int().nonnegative(),
  })
);

export const PoolMetricsSchema: z.ZodType<PoolMetrics> = z.object({
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
