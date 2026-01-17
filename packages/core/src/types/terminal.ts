/**
 * Terminal Pool 관련 타입 정의
 */

export type TerminalStatus = 'idle' | 'busy' | 'crashed';

export interface Terminal {
  id: string;
  provider: ProviderType;
  process: any; // IPty (node-pty), main process에서만 사용
  status: TerminalStatus;
  currentBarista?: string;
  leaseToken?: LeaseToken; // NEW (Gap 2)
  cwd?: string; // Working directory for this terminal
  createdAt: Date;
  lastUsed: Date;
}

export interface TerminalPoolConfig {
  cwd?: string; // Global working directory for terminals (e.g. project root)
  perProvider: {
    [provider: string]: ProviderTerminalConfig;
  };
}

export interface ProviderTerminalConfig {
  size: number; // Default: 8 (사용자 결정)
  timeout: number; // Lease timeout (ms), Default: 30000
  maxRetries: number; // Spawn retry count, Default: 3
}

export interface PoolStatus {
  [provider: string]: {
    total: number;
    idle: number;
    busy: number;
    crashed: number;
  };
}

// NEW (Gap 2)
export interface LeaseToken {
  id: string;
  terminalId: string;
  baristaId: string;
  provider: ProviderType;
  leasedAt: Date;
  expiresAt: Date;
  released: boolean;
  releasedAt?: Date;
}

// NEW (Gap 2)
export interface PoolMetrics {
  providers: {
    [provider: string]: {
      totalTerminals: number;
      idleTerminals: number;
      busyTerminals: number;
      crashedTerminals: number;
      activeLeases: number;
      p99WaitTime: number; // milliseconds
    };
  };
}

// ProviderType은 packages/core/src/types.ts에서 import
import { ProviderType } from '../types.js';