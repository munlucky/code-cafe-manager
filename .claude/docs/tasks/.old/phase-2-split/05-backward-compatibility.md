# Backward Compatibility & Migration (NEW - Gap 4 해결)

#### 2.6.1 Migration Strategy

**목표**: Phase 1의 기존 Barista/Order 플로우를 깨지 않고 Phase 2를 도입

**3단계 Migration Plan:**

| Phase | Description | Coexistence | Status |
|-------|-------------|-------------|--------|
| **Phase 2a** | Add TerminalPool + RoleRegistry, keep old Barista | Old Barista still works | Week 1-2 |
| **Phase 2b** | Introduce BaristaEngineV2, run in parallel | Both engines available | Week 2-3 |
| **Phase 2c** | Migrate existing Orders to use Roles | Legacy adapter for old Orders | Week 3-4 |

#### 2.6.2 Default Fallback Role

**Problem**: 기존 Order가 Role을 지정하지 않음

**Solution**: Default `generic-agent` Role 생성

**파일**: `packages/roles/generic-agent.md`

```markdown
---
id: generic-agent
name: Generic Agent
recommended_provider: claude-code
skills:
  - read_file
  - write_file
  - edit_file
  - run_command
  - search_code
variables:
  - name: task
    type: string
    required: true
    description: "Task to execute"
---

# Generic Agent Role

You are a versatile AI agent capable of performing various development tasks.

## System Prompt Template

Your task is: {{task}}

Use available tools to complete the task efficiently.
```

**Default Role Assignment:**

```typescript
// packages/orchestrator/src/barista/barista-manager.ts
export class BaristaManager {
  private roleRegistry: RoleRegistry;

  constructor(roleRegistry: RoleRegistry) {
    this.roleRegistry = roleRegistry;
  }

  createBarista(roleId?: string): Barista {
    // If roleId not provided, use default
    const role = roleId
      ? this.roleRegistry.get(roleId)
      : this.roleRegistry.get('generic-agent');

    if (!role) {
      throw new Error(`Role '${roleId || 'generic-agent'}' not found`);
    }

    const barista: Barista = {
      id: this.generateId(),
      role,
      status: BaristaStatus.IDLE,
      currentOrderId: null,
      terminalId: null,
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };

    this.baristas.set(barista.id, barista);
    this.emit('barista:created', barista);
    return barista;
  }
}
```

#### 2.6.3 BaristaEngineV2

**Purpose**: 새로운 Terminal Pool 기반 실행 엔진, 기존 Barista와 병행

**파일**: `packages/orchestrator/src/barista/barista-engine-v2.ts`

```typescript
import { Barista, Role, Order, Step } from '@codecafe/core/types';
import { TerminalPool } from '../terminal/terminal-pool.js';
import { LeaseToken } from '../terminal/lease-token.js';
import { AdapterRegistry } from '../terminal/adapter-registry.js';
import Handlebars from 'handlebars';

export interface StepResult {
  status: 'success' | 'failure';
  output: string;
  error?: string;
}

export class BaristaEngineV2 {
  private pool: TerminalPool;
  private adapters: AdapterRegistry;

  constructor(pool: TerminalPool, adapters: AdapterRegistry) {
    this.pool = pool;
    this.adapters = adapters;
  }

  /**
   * Execute step using Terminal Pool + Provider Adapter
   */
  async executeStep(barista: Barista, order: Order, step: Step, variables: Record<string, any>): Promise<StepResult> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const { terminal, token } = await this.pool.lease(barista.role.recommendedProvider);
        barista.terminalId = terminal.id;
        terminal.currentBarista = barista.id;

        try {
          const adapter = this.adapters.get(barista.role.recommendedProvider);
          const prompt = this.renderPrompt(barista.role, variables);

          // Use adapter protocol
          await adapter.sendPrompt(terminal.process, prompt);
          const output = await adapter.readOutput(terminal.process, 60000); // 60s timeout

          return {
            status: 'success',
            output,
          };
        } finally {
          await this.pool.release(terminal, token);
          barista.terminalId = null;
        }
      } catch (error) {
        lastError = error as Error;

        if (error instanceof TerminalLeaseTimeoutError) {
          console.warn(`Lease timeout on attempt ${attempt + 1}, retrying...`);
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }

        if (error instanceof TerminalCrashedError) {
          console.error(`Terminal crashed on attempt ${attempt + 1}, retrying...`);
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }

        // Non-retryable error
        throw error;
      }
    }

    return {
      status: 'failure',
      output: '',
      error: `Failed after ${maxRetries} attempts: ${lastError?.message}`,
    };
  }

  private renderPrompt(role: Role, variables: Record<string, any>): string {
    const template = Handlebars.compile(role.systemPrompt);
    return template(variables);
  }
}
```

#### 2.6.4 Legacy Barista Adapter

**Purpose**: 기존 Order를 새 시스템에서 실행하기 위한 어댑터

**파일**: `packages/orchestrator/src/barista/legacy-barista-adapter.ts`

```typescript
import { Barista, Order, Step } from '@codecafe/core/types';
import { BaristaEngineV2, StepResult } from './barista-engine-v2.js';

export class LegacyBaristaAdapter {
  private engineV2: BaristaEngineV2;

  constructor(engineV2: BaristaEngineV2) {
    this.engineV2 = engineV2;
  }

  /**
   * Execute legacy Order that doesn't have Role information
   */
  async executeLegacyStep(barista: Barista, order: Order, step: Step): Promise<StepResult> {
    // Extract task from old Order format
    const task = (step as any).task || (step as any).description || 'Execute step';

    // Use generic-agent role with task variable
    const variables = {
      task,
      ...((step as any).context || {}),
    };

    return this.engineV2.executeStep(barista, order, step, variables);
  }
}
```

#### 2.6.5 Rollback Plan

**If Phase 2 causes regressions:**

1. **Feature Flag**: Disable BaristaEngineV2 via environment variable
   ```bash
   USE_V2_ENGINE=false pnpm start
   ```

2. **Database Rollback**: Revert to Phase 1 schema if needed
   - No database in Phase 2, so N/A

3. **Code Rollback**: Git revert to Phase 1 tag
   ```bash
   git revert <phase-2-merge-commit>
   ```

4. **Communication**: Document breaking changes and provide migration guide

---

**다음 문서:** [06-crash-recovery.md](06-crash-recovery.md) - Crash Recovery Behavior