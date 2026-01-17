# Implementation Sequence

## 3. Implementation Sequence

### Step 1: Core Types & Interfaces (Day 1)

**목표**: Terminal Pool과 Role System의 기반 타입 정의

#### 파일 생성 순서:

1. **`packages/core/src/types/terminal.ts`** (NEW)
   ```typescript
   export type TerminalStatus = 'idle' | 'busy' | 'crashed';

   export interface Terminal {
     id: string;
     provider: ProviderType;
     process: any; // IPty (node-pty), main process에서만 사용
     status: TerminalStatus;
     currentBarista?: string;
     leaseToken?: LeaseToken; // NEW (Gap 2)
     createdAt: Date;
     lastUsed: Date;
   }

   export interface TerminalPoolConfig {
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
   ```

2. **`packages/core/src/types/role.ts`** (NEW)
   ```typescript
   export interface Role {
     id: string; // 'planner' | 'coder' | 'tester' | 'reviewer' | custom
     name: string;
     systemPrompt: string; // Handlebars template
     skills: string[]; // Tool names
     recommendedProvider: ProviderType;
     variables: RoleVariable[];
     isDefault: boolean; // true for packages/roles/*.md
     source: string; // File path
   }

   export interface RoleVariable {
     name: string;
     type: 'string' | 'number' | 'boolean';
     required: boolean;
     default?: string | number | boolean;
     description?: string;
   }

   export interface RoleFrontmatter {
     id: string;
     name: string;
     recommended_provider: ProviderType;
     skills: string[];
     variables?: RoleVariable[];
   }
   ```

3. **`packages/core/src/types/index.ts`** (UPDATE)
   ```typescript
   // 기존 exports
   export * from './cafe.js';
   // 신규 exports
   export * from './terminal.js';
   export * from './role.js';
   ```

4. **`packages/core/src/schema/terminal.ts`** (NEW)
   ```typescript
   import { z } from 'zod';

   export const TerminalPoolConfigSchema = z.object({
     perProvider: z.record(z.object({
       size: z.number().int().min(1).max(16).default(8),
       timeout: z.number().int().min(1000).default(30000),
       maxRetries: z.number().int().min(0).max(10).default(3),
     })),
   });
   ```

5. **`packages/core/src/schema/role.ts`** (NEW)
   ```typescript
   import { z } from 'zod';

   export const RoleVariableSchema = z.object({
     name: z.string(),
     type: z.enum(['string', 'number', 'boolean']),
     required: z.boolean().default(false),
     default: z.union([z.string(), z.number(), z.boolean()]).optional(),
     description: z.string().optional(),
   });

   export const RoleFrontmatterSchema = z.object({
     id: z.string(),
     name: z.string(),
     recommended_provider: z.string(),
     skills: z.array(z.string()),
     variables: z.array(RoleVariableSchema).optional(),
   });
   ```

**Dependencies:**
- None (기반 타입)

**Verification:**
```bash
cd packages/core
pnpm typecheck
```

---

### Step 2: Terminal Pool Implementation (Day 2-3)

**목표**: Terminal 생성/대여/반환 로직 구현 + Provider Adapter + Crash Recovery

#### 파일 생성 순서:

1. **`packages/orchestrator/src/terminal/errors.ts`** (NEW)
   ```typescript
   export class TerminalPoolError extends Error {
     constructor(message: string) {
       super(message);
       this.name = 'TerminalPoolError';
     }
   }

   export class TerminalLeaseTimeoutError extends TerminalPoolError {
     constructor(provider: string, timeout: number) {
       super(`Failed to lease terminal for ${provider} within ${timeout}ms`);
       this.name = 'TerminalLeaseTimeoutError';
     }
   }

   export class TerminalCrashedError extends TerminalPoolError {
     constructor(terminalId: string) {
       super(`Terminal ${terminalId} crashed`);
       this.name = 'TerminalCrashedError';
     }
   }
   ```

2. **`packages/orchestrator/src/terminal/lease-token.ts`** (NEW - Gap 2)
   - See Section 2.4.1 for complete implementation

3. **`packages/orchestrator/src/terminal/provider-adapter.ts`** (NEW - Gap 1)
   - See Section 2.3.1 for complete implementation

4. **`packages/orchestrator/src/terminal/adapters/claude-code-adapter.ts`** (NEW - Gap 1)
   - See Section 2.3.2 for complete implementation

5. **`packages/orchestrator/src/terminal/adapters/codex-adapter.ts`** (NEW - Gap 1)
   - See Section 2.3.2 for complete implementation

6. **`packages/orchestrator/src/terminal/adapter-registry.ts`** (NEW - Gap 1)
   - See Section 2.3.3 for complete implementation

7. **`packages/orchestrator/src/terminal/terminal-pool.ts`** (NEW - CORE, Gap 2 & 5 applied)
   ```typescript
   import { Terminal, TerminalPoolConfig, ProviderType, PoolStatus, PoolMetrics, LeaseToken } from '@codecafe/core/types';
   import { EventEmitter } from 'events';
   import { IPty } from 'node-pty';
   import pLimit from 'p-limit';
   import { LeaseManager } from './lease-token.js';
   import { AdapterRegistry } from './adapter-registry.js';
   import { TerminalPoolError, TerminalLeaseTimeoutError, TerminalCrashedError } from './errors.js';

   export class TerminalPool extends EventEmitter {
     private terminals: Map<string, Terminal> = new Map();
     private config: TerminalPoolConfig;
     private semaphores: Map<string, ReturnType<typeof pLimit>> = new Map();
     private leaseManager: LeaseManager = new LeaseManager();
     private adapters: AdapterRegistry = new AdapterRegistry();
     private shutdownFlag = false;

     constructor(config: TerminalPoolConfig) {
       super();
       this.config = config;
       this.initializeSemaphores();
     }

     private initializeSemaphores(): void {
       for (const [provider, providerConfig] of Object.entries(this.config.perProvider)) {
         this.semaphores.set(provider, pLimit(providerConfig.size));
       }
     }

     /**
      * Terminal 생성 (내부용, spawn 시도)
      */
     async spawn(provider: ProviderType): Promise<Terminal> {
       const providerConfig = this.config.perProvider[provider];
       if (!providerConfig) {
         throw new TerminalPoolError(`Provider ${provider} not configured`);
       }

       const adapter = this.adapters.get(provider);

       let lastError: Error | null = null;
       for (let attempt = 0; attempt < providerConfig.maxRetries; attempt++) {
         try {
           const process = await adapter.spawn();

           const terminal: Terminal = {
             id: this.generateId(),
             provider,
             process,
             status: 'idle',
             createdAt: new Date(),
             lastUsed: new Date(),
           };

           this.terminals.set(terminal.id, terminal);
           this.setupProcessHandlers(terminal);
           this.emit('terminal:spawned', terminal.id);
           return terminal;
         } catch (error) {
           lastError = error as Error;
           console.error(`Terminal spawn attempt ${attempt + 1} failed:`, error);
         }
       }

       throw new TerminalPoolError(
         `Failed to spawn terminal for ${provider} after ${providerConfig.maxRetries} attempts: ${lastError?.message}`
       );
     }

     /**
      * Terminal 대여 (Semaphore + LeaseToken)
      */
     async lease(provider: ProviderType): Promise<{ terminal: Terminal; token: LeaseToken }> {
       if (this.shutdownFlag) {
         throw new TerminalPoolError('TerminalPool is shutting down');
       }

       const leaseStartTime = Date.now();
       const semaphore = this.semaphores.get(provider);
       if (!semaphore) {
         throw new TerminalPoolError(`Provider ${provider} not configured`);
       }

       const providerConfig = this.config.perProvider[provider];
       const timeoutPromise = new Promise<never>((_, reject) =>
         setTimeout(() => reject(new TerminalLeaseTimeoutError(provider, providerConfig.timeout)), providerConfig.timeout)
       );

       try {
         const result = await Promise.race([
           semaphore(() => this.acquireIdleTerminal(provider)),
           timeoutPromise,
         ]);

         // Record wait time for p99
         const waitTime = Date.now() - leaseStartTime;
         this.leaseManager.recordWaitTime(waitTime);

         return result;
       } catch (error) {
         if (error instanceof TerminalLeaseTimeoutError) {
           this.emit('terminal:lease-timeout', provider);
         }
         throw error;
       }
     }

     private async acquireIdleTerminal(provider: ProviderType): Promise<{ terminal: Terminal; token: LeaseToken }> {
       // 기존 idle Terminal 찾기
       let terminal = this.findIdleTerminal(provider);

       // 없으면 새로 생성
       if (!terminal) {
         terminal = await this.spawn(provider);
       }

       // Create lease token (BEFORE changing status)
       const token = this.leaseManager.createToken(terminal.id, 'unknown-barista', provider, this.config.perProvider[provider].timeout);

       // Status 변경
       terminal.status = 'busy';
       terminal.lastUsed = new Date();
       terminal.leaseToken = token;

       this.emit('terminal:leased', terminal.id, token.id);

       return { terminal, token };
     }

     private findIdleTerminal(provider: ProviderType): Terminal | undefined {
       for (const terminal of this.terminals.values()) {
         if (terminal.provider === provider && terminal.status === 'idle') {
           return terminal;
         }
       }
       return undefined;
     }

     /**
      * Terminal 반환 (LeaseToken 검증)
      */
     async release(terminal: Terminal, token: LeaseToken): Promise<void> {
       const existingTerminal = this.terminals.get(terminal.id);
       if (!existingTerminal) {
         throw new TerminalPoolError(`Terminal ${terminal.id} not found`);
       }

       // Validate token
       if (existingTerminal.leaseToken?.id !== token.id) {
         throw new TerminalPoolError(`Invalid lease token for terminal ${terminal.id}`);
       }

       // Release token FIRST (리스 완료 시점)
       this.leaseManager.releaseToken(token.id);

       if (existingTerminal.status === 'crashed') {
         // Crashed terminal은 이미 정리됨
         this.emit('terminal:released', terminal.id, 'crashed');
         return;
       }

       existingTerminal.status = 'idle';
       existingTerminal.leaseToken = undefined;
       existingTerminal.currentBarista = undefined;
       existingTerminal.lastUsed = new Date();
       this.emit('terminal:released', terminal.id, 'idle');

       // Cleanup old tokens periodically
       if (Math.random() < 0.01) {
         this.leaseManager.cleanup();
       }
     }

     /**
      * Terminal 정리 (삭제)
      */
     async cleanup(terminal: Terminal): Promise<void> {
       const existingTerminal = this.terminals.get(terminal.id);
       if (!existingTerminal) {
         return;
       }

       try {
         if (existingTerminal.process) {
           (existingTerminal.process as IPty).kill();
         }
       } catch (error) {
         console.error(`Error killing terminal ${terminal.id}:`, error);
       }

       this.terminals.delete(terminal.id);
       this.emit('terminal:cleaned', terminal.id);
     }

     /**
      * Pool 전체 종료
      */
     async shutdown(): Promise<void> {
       this.shutdownFlag = true;
       const cleanupPromises = Array.from(this.terminals.values()).map((t) => this.cleanup(t));
       await Promise.all(cleanupPromises);
       this.emit('pool:shutdown');
     }

     /**
      * Pool 상태 조회
      */
     getStatus(): PoolStatus {
       const status: PoolStatus = {};

       for (const provider of Object.keys(this.config.perProvider)) {
         status[provider] = {
           total: 0,
           idle: 0,
           busy: 0,
           crashed: 0,
         };
       }

       for (const terminal of this.terminals.values()) {
         const providerStatus = status[terminal.provider];
         if (providerStatus) {
           providerStatus.total++;
           if (terminal.status === 'idle') providerStatus.idle++;
           if (terminal.status === 'busy') providerStatus.busy++;
           if (terminal.status === 'crashed') providerStatus.crashed++;
         }
       }

       return status;
     }

     /**
      * Pool metrics (Gap 2 - p99 wait time)
      */
     getMetrics(): PoolMetrics {
       const metrics: PoolMetrics = {
         providers: {},
       };

       for (const provider of Object.keys(this.config.perProvider)) {
         const terminals = Array.from(this.terminals.values()).filter((t) => t.provider === provider);

         metrics.providers[provider] = {
           totalTerminals: terminals.length,
           idleTerminals: terminals.filter((t) => t.status === 'idle').length,
           busyTerminals: terminals.filter((t) => t.status === 'busy').length,
           crashedTerminals: terminals.filter((t) => t.status === 'crashed').length,
           activeLeases: this.leaseManager.getActiveCount(provider as ProviderType),
           p99WaitTime: this.leaseManager.getP99WaitTime(),
         };
       }

       return metrics;
     }

     getTerminal(id: string): Terminal | undefined {
       return this.terminals.get(id);
     }

     /**
      * Crash recovery (Gap 5)
      */
     private setupProcessHandlers(terminal: Terminal): void {
       const process = terminal.process as IPty;

       process.onExit(({ exitCode }) => {
         console.log(`Terminal ${terminal.id} exited with code ${exitCode}`);

         if (exitCode !== 0) {
           terminal.status = 'crashed';
           this.emit('terminal:crashed', terminal.id, exitCode);

           // If terminal had an active lease, attempt recovery
           if (terminal.leaseToken && !terminal.leaseToken.released) {
             this.handleCrashDuringLease(terminal).catch((error) => {
               console.error(`Crash recovery failed for terminal ${terminal.id}:`, error);
             });
           }
         } else {
           // Normal exit
           terminal.status = 'idle';
           this.emit('terminal:exit', terminal.id);
         }
       });

       process.onData((data) => {
         this.emit('terminal:data', terminal.id, data);
       });
     }

     private async handleCrashDuringLease(crashedTerminal: Terminal): Promise<void> {
       const provider = crashedTerminal.provider;
       const providerConfig = this.config.perProvider[provider];

       console.warn(`Attempting auto-restart for crashed terminal ${crashedTerminal.id}`);

       try {
         // Attempt restart (within maxRetries)
         for (let attempt = 0; attempt < providerConfig.maxRetries; attempt++) {
           try {
             const newTerminal = await this.spawn(provider);

             // Transfer lease to new terminal
             newTerminal.leaseToken = crashedTerminal.leaseToken;
             newTerminal.currentBarista = crashedTerminal.currentBarista;
             newTerminal.status = 'busy';

             // Cleanup crashed terminal
             this.terminals.delete(crashedTerminal.id);

             this.emit('terminal:crash-recovered', crashedTerminal.id, newTerminal.id);

             console.log(`Crash recovery succeeded: ${crashedTerminal.id} → ${newTerminal.id}`);
             return;
           } catch (error) {
             console.error(`Restart attempt ${attempt + 1} failed:`, error);
             await new Promise((r) => setTimeout(r, 1000)); // Backoff
           }
         }

         // All restart attempts failed
         throw new TerminalCrashedError(crashedTerminal.id);
       } catch (error) {
         // Crash recovery failed, release semaphore and notify caller
         this.terminals.delete(crashedTerminal.id);
         this.emit('terminal:crash-recovery-failed', crashedTerminal.id);

         throw error;
       }
     }

     private generateId(): string {
       return `term-${Date.now()}-${Math.random().toString(36).substring(7)}`;
     }
   }
   ```

8. **`packages/orchestrator/src/terminal/index.ts`** (NEW)
   ```typescript
   export * from './terminal-pool.js';
   export * from './errors.js';
   export * from './lease-token.js';
   export * from './provider-adapter.js';
   export * from './adapter-registry.js';
   ```

9. **`packages/orchestrator/package.json`** (UPDATE)
   ```json
   {
     "dependencies": {
       "node-pty": "^1.0.0",
       "p-limit": "^5.0.0"
     }
   }
   ```

**Dependencies:**
- Step 1 완료 (타입 정의)
- `node-pty`, `p-limit` 패키지 설치

**Verification:**
```bash
cd packages/orchestrator
pnpm install
pnpm typecheck
pnpm test src/terminal
```

---

### Step 3: Role Registry Implementation (Day 4-5)

(원본 계획과 동일, 변경 없음)

---

### Step 4: Barista Refactoring (Day 6-7)

**목표**: Barista를 논리적 Worker로 리팩토링, Terminal 통합, Migration 준비

#### 파일 수정/생성 순서:

1. **`packages/core/src/types.ts`** (UPDATE)
   ```typescript
   // Barista 타입 업데이트
   export interface Barista {
     id: string;
     role: Role; // NEW
     status: BaristaStatus;
     currentOrderId: string | null;
     terminalId: string | null; // NEW
     createdAt: Date;
     lastActivityAt: Date;
   }
   ```

2. **`packages/orchestrator/src/barista/barista-engine-v2.ts`** (NEW - Gap 4)
   - See Section 2.6.3 for complete implementation

3. **`packages/orchestrator/src/barista/legacy-barista-adapter.ts`** (NEW - Gap 4)
   - See Section 2.6.4 for complete implementation

4. **`packages/orchestrator/src/barista/barista-manager.ts`** (UPDATE - Gap 4)
   ```typescript
   import { Barista, Role, BaristaStatus } from '@codecafe/core/types';
   import { RoleRegistry } from '../role/role-registry.js';
   import { EventEmitter } from 'events';

   export class BaristaManager extends EventEmitter {
     private baristas: Map<string, Barista> = new Map();
     private maxBaristas: number;
     private roleRegistry: RoleRegistry;

     constructor(maxBaristas: number = 10, roleRegistry: RoleRegistry) {
       super();
       this.maxBaristas = maxBaristas;
       this.roleRegistry = roleRegistry;
     }

     createBarista(roleId?: string): Barista {
       if (this.baristas.size >= this.maxBaristas) {
         throw new Error(`Maximum baristas (${this.maxBaristas}) reached`);
       }

       // Use default role if not provided (Gap 4 - backward compatibility)
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

     updateBaristaStatus(baristaId: string, status: BaristaStatus, orderId?: string | null): void {
       const barista = this.baristas.get(baristaId);
       if (!barista) {
         throw new Error(`Barista ${baristaId} not found`);
       }

       barista.status = status;
       barista.lastActivityAt = new Date();

       if (orderId !== undefined) {
         barista.currentOrderId = orderId;
       }

       this.emit('barista:status-changed', baristaId, status, orderId);
     }

     findIdleBarista(roleId?: string): Barista | null {
       for (const barista of this.baristas.values()) {
         if (barista.status === BaristaStatus.IDLE) {
           if (!roleId || barista.role.id === roleId) {
             return barista;
           }
         }
       }
       return null;
     }

     getBarista(baristaId: string): Barista | undefined {
       return this.baristas.get(baristaId);
     }

     getAllBaristas(): Barista[] {
       return Array.from(this.baristas.values());
     }

     removeBarista(baristaId: string): void {
       const barista = this.baristas.get(baristaId);
       if (!barista) {
         throw new Error(`Barista ${baristaId} not found`);
       }

       if (barista.status === BaristaStatus.RUNNING) {
         throw new Error(`Cannot remove running barista ${baristaId}`);
       }

       this.baristas.delete(baristaId);
       this.emit('barista:removed', baristaId);
     }

     private generateId(): string {
       return `barista-${Date.now()}-${Math.random().toString(36).substring(7)}`;
     }
   }
   ```

5. **`packages/orchestrator/src/barista/index.ts`** (UPDATE)
   ```typescript
   export * from './barista-manager.js';
   export * from './barista-engine-v2.js';
   export * from './legacy-barista-adapter.js';
   ```

6. **`packages/roles/generic-agent.md`** (NEW - Gap 4)
   - See Section 2.6.2 for complete implementation

**Dependencies:**
- Step 2 완료 (Terminal Pool)
- Step 3 완료 (Role Registry)
- `handlebars` 패키지 설치

**Verification:**
```bash
cd packages/orchestrator
pnpm typecheck
pnpm test src/barista

# Integration test (manual)
# 1. Create TerminalPool
# 2. Load RoleRegistry
# 3. Create Barista with Role
# 4. Execute step → should lease terminal, execute, release
```

---

### Step 5: UI Components (Day 8-10)

**목표**: Role Manager, Order Creation Kiosk UI 구현, IPC 계약 완성

#### 파일 생성 순서:

1. **`packages/desktop/src/main/ipc/role.ts`** (NEW - Gap 3)
   - See Section 2.5.1 for complete implementation

2. **`packages/desktop/src/main/ipc/terminal.ts`** (NEW - Gap 3)
   - See Section 2.5.1 for complete implementation

3. **`packages/desktop/src/main/index.ts`** (UPDATE)
   ```typescript
   import { registerRoleHandlers } from './ipc/role.js';
   import { registerTerminalHandlers } from './ipc/terminal.js';

   // ... 기존 코드

   app.whenReady().then(() => {
     // ... 기존 handlers
     registerRoleHandlers();
     registerTerminalHandlers();
   });
   ```

4. **`packages/desktop/src/preload/index.ts`** (UPDATE - Gap 3)
   - See Section 2.5.2 for complete implementation

5. **`packages/desktop/src/renderer/types/window.d.ts`** (UPDATE - Gap 3)
   - See Section 2.5.3 for complete implementation

6. **`packages/desktop/src/renderer/store/useRoleStore.ts`** (NEW - Gap 3)
   - See Section 2.5.4 for example implementation

7. **`packages/desktop/src/renderer/components/role/RoleCard.tsx`** (NEW)
   ```tsx
   import React from 'react';
   import { Role } from '@codecafe/core/types';
   import { Card } from '../ui/Card';
   import { Badge } from '../ui/Badge';

   interface RoleCardProps {
     role: Role;
     onClick?: () => void;
   }

   export function RoleCard({ role, onClick }: RoleCardProps) {
     return (
       <Card className="p-4 cursor-pointer hover:shadow-lg transition-shadow" onClick={onClick}>
         <div className="flex justify-between items-start mb-2">
           <h3 className="text-lg font-semibold">{role.name}</h3>
           {role.isDefault && <Badge variant="secondary">Default</Badge>}
         </div>
         <p className="text-sm text-gray-600 mb-3">Provider: {role.recommendedProvider}</p>
         <div className="flex flex-wrap gap-1">
           {role.skills.map((skill) => (
             <Badge key={skill} variant="outline" className="text-xs">
               {skill}
             </Badge>
           ))}
         </div>
       </Card>
     );
   }
   ```

8. **`packages/desktop/src/renderer/components/role/RoleManager.tsx`** (NEW)
   ```tsx
   import React, { useEffect } from 'react';
   import { useRoleStore } from '../../store/useRoleStore';
   import { RoleCard } from './RoleCard';
   import { Button } from '../ui/Button';
   import { EmptyState } from '../ui/EmptyState';

   export function RoleManager() {
     const { roles, loading, error, loadRoles } = useRoleStore();

     useEffect(() => {
       loadRoles();
     }, []);

     if (loading) {
       return <div className="p-8 text-center">Loading roles...</div>;
     }

     if (error) {
       return <div className="p-8 text-center text-red-600">{error}</div>;
     }

     const defaultRoles = roles.filter((r) => r.isDefault);
     const userRoles = roles.filter((r) => !r.isDefault);

     return (
       <div className="p-8">
         <div className="flex justify-between items-center mb-6">
           <h1 className="text-3xl font-bold">Role Manager</h1>
           <Button onClick={() => alert('Create role - TODO')}>Create Role</Button>
         </div>

         <section className="mb-8">
           <h2 className="text-xl font-semibold mb-4">Default Roles</h2>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {defaultRoles.map((role) => (
               <RoleCard key={role.id} role={role} onClick={() => alert(`View ${role.id} - TODO`)} />
             ))}
           </div>
         </section>

         <section>
           <h2 className="text-xl font-semibold mb-4">User Roles</h2>
           {userRoles.length === 0 ? (
             <EmptyState message="No user-defined roles yet" />
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {userRoles.map((role) => (
                 <RoleCard key={role.id} role={role} onClick={() => alert(`Edit ${role.id} - TODO`)} />
               ))}
             </div>
           )}
         </section>
       </div>
     );
   }
   ```

9. **`packages/desktop/src/renderer/components/order/OrderCreationKiosk.tsx`** (NEW)
   ```tsx
   import React, { useState, useEffect } from 'react';
   import { useRoleStore } from '../../store/useRoleStore';
   import { Role } from '@codecafe/core/types';
   import { Button } from '../ui/Button';
   import { Card } from '../ui/Card';

   interface StageConfig {
     stageName: string;
     roleId: string;
     baristaCount: number;
     variables: Record<string, string>;
   }

   export function OrderCreationKiosk() {
     const { roles, loadRoles } = useRoleStore();
     const [stages, setStages] = useState<StageConfig[]>([
       { stageName: 'Planning', roleId: '', baristaCount: 1, variables: {} },
     ]);

     useEffect(() => {
       loadRoles();
     }, []);

     const addStage = () => {
       setStages([...stages, { stageName: '', roleId: '', baristaCount: 1, variables: {} }]);
     };

     const updateStage = (index: number, field: keyof StageConfig, value: any) => {
       const newStages = [...stages];
       newStages[index] = { ...newStages[index], [field]: value };
       setStages(newStages);
     };

     const createOrder = () => {
       console.log('Creating order with stages:', stages);
       // TODO: Call order:create IPC
       alert('Order creation - TODO');
     };

     return (
       <div className="p-8 max-w-4xl mx-auto">
         <h1 className="text-3xl font-bold mb-6">Create New Order</h1>

         <div className="space-y-4 mb-6">
           {stages.map((stage, index) => (
             <Card key={index} className="p-4">
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-sm font-medium mb-1">Stage Name</label>
                   <input
                     type="text"
                     className="w-full border rounded px-3 py-2"
                     value={stage.stageName}
                     onChange={(e) => updateStage(index, 'stageName', e.target.value)}
                     placeholder="e.g., Planning, Implementation"
                   />
                 </div>

                 <div>
                   <label className="block text-sm font-medium mb-1">Role</label>
                   <select
                     className="w-full border rounded px-3 py-2"
                     value={stage.roleId}
                     onChange={(e) => updateStage(index, 'roleId', e.target.value)}
                   >
                     <option value="">Select Role</option>
                     {roles.map((role) => (
                       <option key={role.id} value={role.id}>
                         {role.name}
                       </option>
                     ))}
                   </select>
                 </div>

                 <div>
                   <label className="block text-sm font-medium mb-1">Barista Count</label>
                   <input
                     type="number"
                     min="1"
                     max="10"
                     className="w-full border rounded px-3 py-2"
                     value={stage.baristaCount}
                     onChange={(e) => updateStage(index, 'baristaCount', parseInt(e.target.value))}
                   />
                 </div>
               </div>
             </Card>
           ))}
         </div>

         <div className="flex gap-4">
           <Button variant="outline" onClick={addStage}>
             Add Stage
           </Button>
           <Button onClick={createOrder}>Create Order</Button>
         </div>
       </div>
     );
   }
   ```

10. **`packages/desktop/src/renderer/App.tsx`** (UPDATE)
    ```tsx
    import { RoleManager } from './components/role/RoleManager';
    import { OrderCreationKiosk } from './components/order/OrderCreationKiosk';

    // Add routes
    <Route path="/roles" element={<RoleManager />} />
    <Route path="/orders/new" element={<OrderCreationKiosk />} />
    ```

**Dependencies:**
- Step 3 완료 (Role Registry)
- Step 2 완료 (Terminal Pool)
- Zustand 설치

**Verification:**
```bash
cd packages/desktop
pnpm dev

# Manual test:
# 1. Navigate to /roles
# 2. Should see 4 default roles + generic-agent (5 total)
# 3. Check error handling: disconnect network, reload roles → see error message
# 4. Navigate to /orders/new
# 5. Should be able to select roles and configure stages
```

---

**다음 문서:** [08-file-creation-summary.md](08-file-creation-summary.md) - File Creation Summary