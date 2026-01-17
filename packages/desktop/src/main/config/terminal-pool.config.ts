/**
 * Terminal Pool Configuration
 * Externalized configuration for maintainability
 */

import type { TerminalPoolConfig } from '@codecafe/orchestrator';

export const DEFAULT_TERMINAL_POOL_CONFIG: TerminalPoolConfig = {
  perProvider: {
    'claude-code': {
      size: 4,
      timeout: 300000, // 5 minutes
      maxRetries: 3,
    },
    codex: {
      size: 2,
      timeout: 300000,
      maxRetries: 3,
    },
  },
};
