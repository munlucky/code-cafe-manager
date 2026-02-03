# Providers & CLI 패키지 리팩토링 계획

> 작성일: 2026-02-02
> 대상 패키지:
> - `packages/providers/common/`
> - `packages/providers/claude-code/`
> - `packages/providers/codex/`
> - `packages/cli/`
> - `packages/git-worktree/`

---

## 1. 개요

이 문서는 Provider 어댑터 패키지들과 CLI, git-worktree 유틸리티 패키지의 리팩토링 계획을 다룹니다. Provider 패키지들은 외부 AI CLI 도구(Claude Code, Codex)와의 인터페이스를 담당하며, CLI는 사용자 진입점입니다.

### 핵심 문제 요약

| 우선순위 | 이슈 | 패키지 | 예상 공수 |
|---------|------|-------|----------|
| **P0** | Provider 간 코드 중복 | claude-code, codex | 4-6시간 |
| **P1** | Timeout 정리 누락 | providers | 1시간 |
| **P1** | CLI 설정 헬퍼 중복 | cli | 1시간 |
| **P2** | 에러 리포팅 불일치 | cli | 1시간 |
| **P2** | 긴 함수 | doctor.ts, worktree-manager.ts | 2시간 |
| **P3** | 플랫폼 감지 중복 | 여러 패키지 | 30분 |

---

## 2. Provider 패키지 리팩토링

### 2.1 BaseProvider 추상 클래스 추출 (P0)

**현황**: claude-code와 codex 프로바이더에 거의 동일한 코드 존재

**중복 영역**:
| 메서드/로직 | claude-code | codex | 중복 줄 수 |
|------------|-------------|-------|-----------|
| `run()` Interactive mode | 35-83줄 | 30-78줄 | ~50줄 |
| `validateEnv()` | 117-161줄 | 111-155줄 | ~45줄 |
| `executeCommand()` | 253-314줄 | 249-310줄 | ~60줄 |
| `executeWithSchema()` | 174-248줄 | 168-244줄 | ~70줄 |

**총 중복**: ~225줄 (각 프로바이더의 약 70%)

**After**: BaseProvider 추상 클래스
```typescript
// packages/providers/common/src/base-provider.ts (신규)
import pty from 'node-pty';
import { EventEmitter } from 'events';
import type { IProvider, ProviderConfig, SchemaExecutionConfig, ValidationResult } from './types';

export abstract class BaseProvider extends EventEmitter implements IProvider {
  protected ptyProcess: pty.IPty | null = null;
  protected isRunning: boolean = false;
  private timeoutId: NodeJS.Timeout | null = null;

  // 추상 메서드 - 각 프로바이더에서 구현
  protected abstract getCommandName(): string;
  protected abstract buildInteractiveArgs(config: ProviderConfig): string[];
  protected abstract buildHeadlessArgs(config: ProviderConfig): string[];
  protected abstract buildSchemaArgs(config: SchemaExecutionConfig): string[];

  // 공통 구현
  async run(config: ProviderConfig): Promise<void> {
    const command = this.getCommandName();
    const args = config.headless
      ? this.buildHeadlessArgs(config)
      : this.buildInteractiveArgs(config);

    const shell = this.getShell();
    const env = this.buildEnv(config.env);

    this.ptyProcess = pty.spawn(shell, ['-c', `${command} ${args.join(' ')}`], {
      name: 'xterm-color',
      cols: 200,
      rows: 50,
      cwd: config.cwd || process.cwd(),
      env,
    });

    this.setupEventHandlers();
    this.setupTimeout(config.timeout);

    this.isRunning = true;
  }

  stop(): void {
    this.clearTimeout();
    if (this.ptyProcess) {
      this.ptyProcess.kill();
      this.ptyProcess = null;
    }
    this.isRunning = false;
  }

  write(data: string): void {
    if (this.ptyProcess && this.isRunning) {
      const lineEnding = this.getLineEnding();
      this.ptyProcess.write(data + lineEnding);
    }
  }

  isActive(): boolean {
    return this.isRunning;
  }

  static async validateEnv(commandName: string): Promise<ValidationResult> {
    const checkCommand = Platform.isWindows() ? 'where' : 'which';

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ valid: false, error: `${commandName} check timed out` });
      }, 5000);

      const proc = spawn(checkCommand, [commandName], { shell: true });

      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve({ valid: true });
        } else {
          resolve({ valid: false, error: `${commandName} not found in PATH` });
        }
      });

      proc.on('error', () => {
        clearTimeout(timeout);
        resolve({ valid: false, error: `Failed to check ${commandName}` });
      });
    });
  }

  // 공통 유틸리티
  private setupEventHandlers(): void {
    this.ptyProcess!.onData((data) => this.emit('data', data));
    this.ptyProcess!.onExit(({ exitCode, signal }) => {
      this.clearTimeout();
      this.isRunning = false;
      this.emit('exit', { exitCode, signal });
    });
  }

  private setupTimeout(timeoutSec?: number): void {
    if (timeoutSec) {
      this.timeoutId = setTimeout(() => {
        if (this.isRunning) {
          this.stop();
          this.emit('error', new Error('Execution timeout'));
        }
      }, timeoutSec * 1000);
    }
  }

  private clearTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  private getShell(): string {
    return Platform.isWindows() ? 'powershell.exe' : 'bash';
  }

  private getLineEnding(): string {
    return Platform.isWindows() ? '\r' : '\n';
  }

  private buildEnv(configEnv?: Record<string, string>): Record<string, string> {
    return {
      ...process.env,
      ...configEnv,
    } as Record<string, string>;
  }
}
```

**Claude Code Provider 리팩토링**:
```typescript
// packages/providers/claude-code/src/provider.ts (리팩토링 후)
import { BaseProvider } from '@codecafe/providers-common';
import type { ProviderConfig, SchemaExecutionConfig } from '@codecafe/providers-common';

export class ClaudeCodeProvider extends BaseProvider {
  protected getCommandName(): string {
    return 'claude';
  }

  protected buildInteractiveArgs(config: ProviderConfig): string[] {
    return [JSON.stringify(config.prompt)];
  }

  protected buildHeadlessArgs(config: ProviderConfig): string[] {
    return ['-p', `@${config.promptFile}`, '--output-format', 'json'];
  }

  protected buildSchemaArgs(config: SchemaExecutionConfig): string[] {
    return [
      '-p', `@${config.inputFile}`,
      '--output-format', 'json',
      '--output-schema', config.schemaFile,
    ];
  }

  static validateEnv(): Promise<ValidationResult> {
    return BaseProvider.validateEnv('claude');
  }
}
```

**Codex Provider 리팩토링**:
```typescript
// packages/providers/codex/src/provider.ts (리팩토링 후)
import { BaseProvider } from '@codecafe/providers-common';

export class CodexProvider extends BaseProvider {
  protected getCommandName(): string {
    return 'codex';
  }

  protected buildInteractiveArgs(config: ProviderConfig): string[] {
    return [JSON.stringify(config.prompt)];
  }

  protected buildHeadlessArgs(config: ProviderConfig): string[] {
    return ['exec', '--json', '-i', config.promptFile];
  }

  protected buildSchemaArgs(config: SchemaExecutionConfig): string[] {
    return [
      'exec', '--json',
      '--output-schema', config.schemaFile,
      '-i', config.inputFile,
    ];
  }

  static validateEnv(): Promise<ValidationResult> {
    return BaseProvider.validateEnv('codex');
  }
}
```

**예상 결과**:
- 중복 코드: 225줄 → 0줄
- 각 프로바이더 LOC: ~300줄 → ~50줄

---

### 2.2 Timeout 정리 로직 수정 (P1)

**위치**: `packages/providers/claude-code/src/provider.ts:75-82`

**문제**: Timeout이 프로세스 종료 후에도 남아있을 수 있음

**Before**:
```typescript
if (config.timeout) {
  setTimeout(() => {
    if (this.isRunning) {
      this.stop();
      this.emit('error', new Error('Execution timeout'));
    }
  }, config.timeout * 1000);
}
```

**After**: BaseProvider에서 처리 (위 코드 참조)
- `timeoutId` 저장
- `stop()` 및 `onExit`에서 `clearTimeout()` 호출

---

### 2.3 process.env 타입 안전성 (P2)

**위치**: `packages/providers/claude-code/src/provider.ts:51, 206`

**Before**:
```typescript
const env = {
  ...process.env,
  ...config.env,
} as Record<string, string>;  // 잘못된 캐스팅
```

**After**:
```typescript
// packages/providers/common/src/utils/env.ts (신규)
export function buildSafeEnv(
  configEnv?: Record<string, string>
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };

  if (configEnv) {
    for (const [key, value] of Object.entries(configEnv)) {
      env[key] = value;
    }
  }

  return env;
}
```

---

## 3. CLI 패키지 리팩토링

### 3.1 설정 헬퍼 통합 (P1)

**현황**: 동일한 설정 로직이 4개 파일에 분산

**위치**:
- `src/commands/init.ts:12-21`
- `src/commands/doctor.ts:15-17`
- `src/commands/status.ts:10-26`
- `src/commands/run.ts:10-12`

**Before**:
```typescript
// init.ts
const getConfigDir = () =>
  process.env.CODECAFE_CONFIG_DIR || join(homedir(), '.codecafe');

// doctor.ts
const configDir = process.env.CODECAFE_CONFIG_DIR || join(homedir(), '.codecafe');

// status.ts
const getConfigDir = () =>
  process.env.CODECAFE_CONFIG_DIR || join(homedir(), '.codecafe');
const getDataDir = () => join(getConfigDir(), 'data');
```

**After**:
```typescript
// packages/cli/src/config.ts (신규)
import { homedir } from 'os';
import { join } from 'path';

export const CONFIG = {
  get dir(): string {
    return process.env.CODECAFE_CONFIG_DIR || join(homedir(), '.codecafe');
  },

  get dataDir(): string {
    return join(this.dir, 'data');
  },

  get logsDir(): string {
    return join(this.dir, 'logs');
  },

  get defaultProvider(): string {
    return process.env.CODECAFE_DEFAULT_PROVIDER || 'claude-code';
  },

  get orchDir(): string {
    return '.orch';
  },
} as const;

// 사용 예시
import { CONFIG } from '../config';

const cafeStorage = new CafeStorage(CONFIG.dataDir);
```

---

### 3.2 에러 핸들러 유틸리티 (P2)

**현황**: 에러 리포팅 방식 불일치

**위치**:
- `run.ts`: spinner.fail()
- `status.ts`: console.error()
- `ui.ts`: console.error()
- `doctor.ts`: spinner methods

**After**:
```typescript
// packages/cli/src/utils/error-handler.ts (신규)
import chalk from 'chalk';
import type { Ora } from 'ora';

export interface ErrorContext {
  command: string;
  operation?: string;
}

export function handleError(
  error: unknown,
  context: ErrorContext,
  spinner?: Ora
): void {
  const message = error instanceof Error ? error.message : String(error);
  const fullMessage = context.operation
    ? `${context.operation}: ${message}`
    : message;

  if (spinner) {
    spinner.fail(fullMessage);
  } else {
    console.error(chalk.red(`[${context.command}] Error:`), fullMessage);
  }

  // 개발 모드에서 스택 트레이스 출력
  if (process.env.DEBUG && error instanceof Error && error.stack) {
    console.error(chalk.gray(error.stack));
  }
}

// 사용 예시
import { handleError } from '../utils/error-handler';

try {
  await execute();
} catch (error) {
  handleError(error, { command: 'run', operation: 'Workflow execution' }, spinner);
  process.exit(1);
}
```

---

### 3.3 긴 함수 분할 (P2)

#### A. `doctor.ts` action handler (96줄)

**위치**: `src/commands/doctor.ts:34-129`

**After**:
```typescript
// packages/cli/src/commands/doctor/checks/git-check.ts (신규)
import ora from 'ora';

export async function checkGit(): Promise<boolean> {
  const spinner = ora('Checking Git...').start();

  try {
    const result = await executeCommand('git', ['--version']);
    spinner.succeed(`Git ${result.version}`);
    return true;
  } catch {
    spinner.fail('Git not found');
    return false;
  }
}

// packages/cli/src/commands/doctor/checks/claude-check.ts
export async function checkClaudeCli(): Promise<boolean> { /* ... */ }

// packages/cli/src/commands/doctor/checks/codex-check.ts
export async function checkCodexCli(): Promise<boolean> { /* ... */ }

// packages/cli/src/commands/doctor/checks/node-check.ts
export async function checkNodeVersion(): Promise<boolean> { /* ... */ }

// packages/cli/src/commands/doctor.ts (리팩토링 후)
import { checkGit } from './doctor/checks/git-check';
import { checkClaudeCli } from './doctor/checks/claude-check';
import { checkCodexCli } from './doctor/checks/codex-check';
import { checkNodeVersion } from './doctor/checks/node-check';

export const doctorCommand = new Command('doctor')
  .description('Verify provider environment')
  .action(async () => {
    console.log(chalk.blue('Running environment checks...\n'));

    const checks = [
      checkGit(),
      checkClaudeCli(),
      checkCodexCli(),
      checkNodeVersion(),
    ];

    const results = await Promise.all(checks);
    const hasErrors = results.some(r => !r);

    if (hasErrors) {
      console.log(chalk.yellow('\nSome checks failed. Please fix the issues above.'));
      process.exit(1);
    }

    console.log(chalk.green('\nAll checks passed!'));
  });
```

#### B. `--counter` 옵션 이름 수정

**위치**: `src/commands/run.ts:18`

**Before**:
```typescript
.option('--counter <path>', 'Project directory', '.')
```

**After**:
```typescript
.option('--cwd <path>', 'Working directory', '.')
// 또는
.option('-C, --cwd <path>', 'Working directory', '.')
```

---

## 4. git-worktree 패키지 리팩토링

### 4.1 긴 함수 분할 (P2)

#### A. `merge()` 메서드 (114줄)

**위치**: `src/worktree-manager.ts:225-339`

**After**:
```typescript
// src/worktree-manager.ts
export class WorktreeManager {
  static async merge(
    worktreePath: string,
    targetBranch: string,
    options: MergeOptions = {}
  ): Promise<MergeResult> {
    const repoPath = await this.getRepositoryPath(worktreePath);
    const branchToMerge = await this.getCurrentBranch(worktreePath);

    // Phase 1: Prepare
    await this.prepareForMerge(worktreePath, options.autoCommit);

    // Phase 2: Switch to target
    await this.switchBranch(repoPath, targetBranch);

    // Phase 3: Perform merge
    const mergeCommit = await this.performMerge(
      repoPath,
      branchToMerge,
      options.strategy
    );

    // Phase 4: Cleanup
    if (options.deleteAfterMerge) {
      await this.cleanupAfterMerge(repoPath, branchToMerge, worktreePath);
    }

    return { success: true, mergeCommit, strategy: options.strategy };
  }

  private static async prepareForMerge(
    worktreePath: string,
    autoCommit?: boolean
  ): Promise<void> {
    const status = await this.getStatus(worktreePath);

    if (status.hasUncommittedChanges) {
      if (autoCommit) {
        await this.commitAll(worktreePath, 'WIP: Auto-commit before merge');
      } else {
        throw new Error('Uncommitted changes. Use autoCommit option or commit manually.');
      }
    }
  }

  private static async performMerge(
    repoPath: string,
    branchToMerge: string,
    strategy: 'squash' | 'no-ff' = 'squash'
  ): Promise<string> {
    const args = strategy === 'squash'
      ? ['merge', '--squash', branchToMerge]
      : ['merge', '--no-ff', branchToMerge];

    await execGit(repoPath, args);

    if (strategy === 'squash') {
      await execGit(repoPath, ['commit', '-m', `Merge ${branchToMerge}`]);
    }

    return await this.getHeadCommit(repoPath);
  }

  private static async cleanupAfterMerge(
    repoPath: string,
    branchToMerge: string,
    worktreePath: string
  ): Promise<void> {
    await this.remove(worktreePath);
    await execGit(repoPath, ['branch', '-D', branchToMerge]);
  }
}
```

### 4.2 Retry 유틸리티 추출

**위치**: `src/worktree-manager.ts:171-213`

**After**:
```typescript
// packages/git-worktree/src/utils/retry.ts (신규)
export interface RetryOptions {
  maxRetries: number;
  delayMs: number;
  shouldRetry?: (error: unknown) => boolean;
}

export async function retryAsync<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      const shouldRetry = options.shouldRetry?.(error) ?? true;
      if (!shouldRetry || attempt === options.maxRetries) {
        throw error;
      }

      await sleep(options.delayMs);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// worktree-manager.ts에서 사용
import { retryAsync } from './utils/retry';

static async remove(worktreePath: string): Promise<void> {
  await retryAsync(
    () => this.doRemove(worktreePath),
    {
      maxRetries: 3,
      delayMs: 500,
      shouldRetry: (error) => this.isRetryableError(error),
    }
  );
}
```

### 4.3 타입 가드 추가

**위치**: `src/worktree-manager.ts:424-450`

**Before**:
```typescript
let current: Partial<WorktreeInfo> = {};
// ... loop ...
worktrees.push(current as WorktreeInfo);  // 안전하지 않은 캐스팅
```

**After**:
```typescript
function isValidWorktreeInfo(obj: Partial<WorktreeInfo>): obj is WorktreeInfo {
  return (
    typeof obj.path === 'string' &&
    typeof obj.branch === 'string' &&
    typeof obj.commit === 'string'
  );
}

// 사용
if (isValidWorktreeInfo(current)) {
  worktrees.push(current);
} else {
  console.warn('Invalid worktree info:', current);
}
```

---

## 5. 플랫폼 유틸리티 통합 (P3)

**현황**: `platform() === 'win32'` 체크가 여러 파일에 분산

**위치**:
- `providers/claude-code/src/provider.ts:41, 68`
- `providers/codex/src/provider.ts:36, 63`
- `git-worktree/src/worktree-manager.ts:119-120, 114`

**After**:
```typescript
// packages/core/src/utils/platform.ts (신규)
import { platform } from 'os';

export const Platform = {
  isWindows(): boolean {
    return platform() === 'win32';
  },

  isMac(): boolean {
    return platform() === 'darwin';
  },

  isLinux(): boolean {
    return platform() === 'linux';
  },

  getShell(): string {
    return this.isWindows() ? 'powershell.exe' : 'bash';
  },

  getLineEnding(): string {
    return this.isWindows() ? '\r\n' : '\n';
  },

  getCommandCheck(): string {
    return this.isWindows() ? 'where' : 'which';
  },
} as const;
```

---

## 6. 리팩토링 실행 순서

```
┌─────────────────────────────────────────────────────────────┐
│  Phase 1: Foundation (Day 1-2)                              │
│  ├─ 1.1 Platform 유틸리티 생성 (@codecafe/core)              │
│  ├─ 1.2 BaseProvider 추상 클래스 생성 (providers/common)     │
│  ├─ 1.3 ClaudeCodeProvider 리팩토링                         │
│  └─ 1.4 CodexProvider 리팩토링                              │
├─────────────────────────────────────────────────────────────┤
│  Phase 2: CLI Consolidation (Day 3)                         │
│  ├─ 2.1 config.ts 생성                                      │
│  ├─ 2.2 error-handler.ts 생성                               │
│  ├─ 2.3 각 command 파일 설정 헬퍼 교체                       │
│  └─ 2.4 --counter → --cwd 옵션 변경                         │
├─────────────────────────────────────────────────────────────┤
│  Phase 3: Function Decomposition (Day 4)                    │
│  ├─ 3.1 doctor.ts 체크 함수 분리                             │
│  ├─ 3.2 worktree-manager.ts merge() 분할                    │
│  └─ 3.3 retry 유틸리티 추출                                  │
├─────────────────────────────────────────────────────────────┤
│  Phase 4: Type Safety (Day 5)                               │
│  ├─ 4.1 process.env 타입 안전성 개선                         │
│  ├─ 4.2 WorktreeInfo 타입 가드 추가                          │
│  └─ 4.3 전체 빌드 및 통합 테스트                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. 검증 체크리스트

```bash
# Provider 중복 코드 검사
diff packages/providers/claude-code/src/provider.ts packages/providers/codex/src/provider.ts | wc -l
# 목표: 대부분 다름 (공통 로직은 BaseProvider로 이동)

# CLI 설정 중복 검사
grep -r "CODECAFE_CONFIG_DIR" packages/cli/src --include="*.ts" | wc -l
# 목표: 1 (config.ts에만 존재)

# 타입 체크
pnpm --filter @codecafe/providers-common typecheck
pnpm --filter @codecafe/provider-claude-code typecheck
pnpm --filter @codecafe/providers-codex typecheck
pnpm --filter @codecafe/cli typecheck
pnpm --filter @codecafe/git-worktree typecheck

# 전체 빌드
pnpm build

# CLI 실행 테스트
pnpm --filter @codecafe/cli dev doctor
```

---

## 8. 주요 메트릭 추적

| 메트릭 | 현재 | 목표 |
|--------|------|------|
| Provider 중복 코드 | ~225줄 | 0줄 |
| CLI 설정 헬퍼 중복 | 4곳 | 1곳 |
| 50줄+ 함수 | 4개 | 0개 |
| 플랫폼 감지 중복 | 6곳 | 1곳 |
| Unsafe type cast | 3곳 | 0곳 |

---

## 9. 의존성 다이어그램 (리팩토링 후)

```
┌─────────────────────────────────────────────────────────┐
│                    @codecafe/core                       │
│  ├─ Platform utility                                    │
│  └─ Error types                                         │
└────────────────────────┬────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  providers  │  │    cli      │  │ git-worktree│
│   /common   │  │             │  │             │
│ BaseProvider│  │  config.ts  │  │ retry.ts    │
└──────┬──────┘  │  error.ts   │  │             │
       │         └─────────────┘  └─────────────┘
   ┌───┴───┐
   │       │
   ▼       ▼
┌─────┐ ┌─────┐
│claude│ │codex│
│ code │ │     │
└─────┘ └─────┘
```

---

*마지막 업데이트: 2026-02-02*
