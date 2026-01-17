# M2 Phase 1: Provider 인터페이스 + Codex Provider + Git Worktree 구현 계획

> 프로젝트 규칙: `.claude/PROJECT.md`

## 메타데이터

- 작성일: 2026-01-09
- 작성자: Context Builder Agent
- 브랜치: main (작업 시 feature/m2-phase1 생성 권장)
- 복잡도: complex
- 관련 문서: `.claude/docs/agreements/m2-features-agreement.md`

## 작업 개요

- 목적: M2 기능 확장의 기반 구조를 확립하여 다중 Provider 지원 및 Git Worktree 기반 병렬 실행 환경 구축
- 범위:
  - **포함**: Provider 인터페이스 표준화, Codex Provider 구현, Git Worktree 패키지 구현, Recipe 스키마 확장
  - **제외**: Recipe Studio UI, 실행 엔진 고도화 (Phase 2/3), DAG 시각화
- 영향: Provider 계층 전체, Core types/schema, CLI doctor 명령, 신규 패키지 추가

## 변경 대상 파일

### 신규 (총 10개)

#### 1. Provider 인터페이스 패키지
- `packages/providers/common/package.json` - Provider 공통 패키지 설정
- `packages/providers/common/src/provider-interface.ts` - IProvider 인터페이스 정의
- `packages/providers/common/src/index.ts` - Export 정의
- `packages/providers/common/tsconfig.json` - TypeScript 설정

#### 2. Codex Provider 패키지
- `packages/providers/codex/package.json` - Codex Provider 패키지 설정
- `packages/providers/codex/src/provider.ts` - CodexProvider 클래스 구현 (node-pty 사용)
- `packages/providers/codex/src/index.ts` - Export 정의
- `packages/providers/codex/tsconfig.json` - TypeScript 설정

#### 3. Git Worktree 패키지
- `packages/git-worktree/package.json` - Worktree 관리 패키지 설정
- `packages/git-worktree/src/worktree-manager.ts` - WorktreeManager 클래스 구현
- `packages/git-worktree/src/types.ts` - Worktree 관련 타입 정의
- `packages/git-worktree/src/index.ts` - Export 정의
- `packages/git-worktree/tsconfig.json` - TypeScript 설정

#### 4. 테스트 파일 (선택적)
- `packages/providers/common/src/__tests__/provider-interface.test.ts`
- `packages/providers/codex/src/__tests__/provider.test.ts`
- `packages/git-worktree/src/__tests__/worktree-manager.test.ts`

### 수정 (총 7개)

#### 1. Core 타입 확장
- `packages/core/src/types.ts` - Order 인터페이스에 worktreeInfo 필드 추가

#### 2. Schema 확장
- `packages/schema/src/recipe-schema.ts` - parallel/retry/timeout 스키마 추가 (기존 구조 확인 시 이미 존재)

#### 3. Claude Code Provider 리팩토링
- `packages/providers/claude-code/package.json` - @codecafe/providers-common 의존성 추가
- `packages/providers/claude-code/src/provider.ts` - IProvider 인터페이스 구현으로 리팩토링

#### 4. CLI Doctor 명령 확장
- `packages/cli/src/commands/doctor.ts` - Codex CLI 점검 로직 추가

#### 5. 워크스페이스 설정
- `package.json` (루트) - 워크스페이스에 신규 패키지 추가
- `pnpm-workspace.yaml` - 워크스페이스 패키지 경로 확인

## 현재 상태/유사 기능

### 유사 기능 (재사용 패턴)

1. **Claude Code Provider** (`packages/providers/claude-code/src/provider.ts`)
   - PTY 기반 프로세스 실행
   - EventEmitter 기반 로그 스트리밍
   - validateEnv, getAuthHint 정적 메서드
   - Codex Provider 구현 시 동일한 패턴 재사용

2. **Recipe Schema** (`packages/schema/src/recipe-schema.ts`)
   - Zod 기반 검증
   - Recursive step schema (parallel steps 이미 지원)
   - retry/timeout 필드 이미 정의됨 (확인 완료)

3. **Barista Manager** (`packages/core/src/barista.ts`)
   - findIdleBarista 메서드 - 병렬 실행 시 바리스타 풀 관리 참고

4. **Orchestrator** (`packages/core/src/orchestrator.ts`)
   - createOrder 메서드 - Worktree 생성 로직 통합 지점

## 구현 계획

### Phase 1.1: Provider 인터페이스 표준화 (1일)

#### 작업 순서

1. **Provider 공통 패키지 생성**
   - 파일: `packages/providers/common/package.json`
   - 내용:
     ```json
     {
       "name": "@codecafe/providers-common",
       "version": "0.1.0",
       "main": "./dist/index.js",
       "types": "./dist/index.d.ts",
       "scripts": {
         "build": "tsc",
         "clean": "rm -rf dist"
       },
       "devDependencies": {
         "typescript": "^5.0.0"
       }
     }
     ```

2. **IProvider 인터페이스 정의**
   - 파일: `packages/providers/common/src/provider-interface.ts`
   - 구현 상세:
     ```typescript
     import { EventEmitter } from 'events';

     /**
      * Provider 설정
      */
     export interface ProviderConfig {
       workingDirectory: string;
       prompt?: string;
       timeout?: number;
     }

     /**
      * Provider 공통 인터페이스
      */
     export interface IProvider extends EventEmitter {
       /**
        * Provider 실행
        * @emits 'data' - 로그 데이터 스트리밍
        * @emits 'exit' - 프로세스 종료
        * @emits 'error' - 에러 발생
        */
       run(config: ProviderConfig): Promise<void>;

       /**
        * 입력 전송 (인터랙티브 모드)
        */
       write(data: string): void;

       /**
        * 프로세스 중지
        */
       stop(): void;

       /**
        * 실행 상태 확인
        */
       isActive(): boolean;
     }

     /**
      * Provider 환경 검증 결과
      */
     export interface ValidationResult {
       valid: boolean;
       message?: string;
     }

     /**
      * Provider 정적 메서드 인터페이스 (TypeScript 한계로 인해 별도 정의)
      */
     export interface IProviderStatic {
       /**
        * 환경 검증 (CLI 설치 여부)
        */
       validateEnv(): Promise<ValidationResult>;

       /**
        * 인증 힌트 제공
        */
       getAuthHint(): string;
     }
     ```

3. **Export 파일 작성**
   - 파일: `packages/providers/common/src/index.ts`
   ```typescript
   export * from './provider-interface.js';
   ```

4. **TypeScript 설정**
   - 파일: `packages/providers/common/tsconfig.json`
   ```json
   {
     "extends": "../../../tsconfig.base.json",
     "compilerOptions": {
       "outDir": "./dist",
       "rootDir": "./src"
     },
     "include": ["src/**/*"]
   }
   ```

5. **빌드 및 검증**
   ```bash
   cd packages/providers/common
   pnpm install
   pnpm build
   ```

---

### Phase 1.2: Codex Provider 구현 (1일)

#### 작업 순서

1. **Codex Provider 패키지 생성**
   - 파일: `packages/providers/codex/package.json`
   - 내용:
     ```json
     {
       "name": "@codecafe/providers-codex",
       "version": "0.1.0",
       "main": "./dist/index.js",
       "types": "./dist/index.d.ts",
       "scripts": {
         "build": "tsc",
         "clean": "rm -rf dist"
       },
       "dependencies": {
         "@codecafe/providers-common": "workspace:*",
         "node-pty": "^1.0.0"
       },
       "devDependencies": {
         "@types/node": "^20.0.0",
         "typescript": "^5.0.0"
       }
     }
     ```

2. **CodexProvider 클래스 구현**
   - 파일: `packages/providers/codex/src/provider.ts`
   - 구현 상세:
     ```typescript
     import * as pty from 'node-pty';
     import { EventEmitter } from 'events';
     import { platform } from 'os';
     import {
       IProvider,
       IProviderStatic,
       ProviderConfig,
       ValidationResult,
     } from '@codecafe/providers-common';

     /**
      * Codex Provider
      * PTY를 사용해 Codex CLI를 실행하고 로그를 스트리밍합니다.
      */
     export class CodexProvider extends EventEmitter implements IProvider {
       private ptyProcess: pty.IPty | null = null;
       private isRunning: boolean = false;

       constructor() {
         super();
       }

       /**
        * Codex CLI 실행
        */
       async run(config: ProviderConfig): Promise<void> {
         if (this.isRunning) {
           throw new Error('Provider is already running');
         }

         // Windows와 Unix 계열 OS에 따라 shell 선택
         const shell = platform() === 'win32' ? 'powershell.exe' : 'bash';

         // Codex CLI 명령 (사전 합의서 확인: codex <prompt>)
         const command = config.prompt ? `codex "${config.prompt}"` : 'codex';

         this.ptyProcess = pty.spawn(shell, [], {
           name: 'xterm-color',
           cols: 80,
           rows: 30,
           cwd: config.workingDirectory,
           env: process.env as { [key: string]: string },
         });

         this.isRunning = true;

         // 데이터 이벤트 처리
         this.ptyProcess.onData((data: string) => {
           this.emit('data', data);
         });

         // 종료 이벤트 처리
         this.ptyProcess.onExit(({ exitCode, signal }) => {
           this.isRunning = false;
           this.emit('exit', { exitCode, signal });
         });

         // Codex 명령 실행
         if (platform() === 'win32') {
           this.ptyProcess.write(`${command}\r`);
         } else {
           this.ptyProcess.write(`${command}\n`);
         }

         // Timeout 설정
         if (config.timeout) {
           setTimeout(() => {
             if (this.isRunning) {
               this.stop();
               this.emit('error', new Error('Execution timeout'));
             }
           }, config.timeout * 1000);
         }
       }

       /**
        * 입력 전송 (인터랙티브 모드)
        */
       write(data: string): void {
         if (!this.ptyProcess || !this.isRunning) {
           throw new Error('Provider is not running');
         }

         this.ptyProcess.write(data);
       }

       /**
        * 프로세스 중지
        */
       stop(): void {
         if (this.ptyProcess && this.isRunning) {
           this.ptyProcess.kill();
           this.isRunning = false;
         }
       }

       /**
        * 실행 상태 확인
        */
       isActive(): boolean {
         return this.isRunning;
       }

       /**
        * 환경 검증 (Codex CLI 설치 여부)
        */
       static async validateEnv(): Promise<ValidationResult> {
         return new Promise((resolve) => {
           const { spawn } = require('child_process');
           const command = platform() === 'win32' ? 'where' : 'which';
           const args = platform() === 'win32' ? ['codex.exe'] : ['codex'];

           const proc = spawn(command, args, {
             timeout: 5000,
             stdio: 'pipe',
           });

           let timedOut = false;
           const timeout = setTimeout(() => {
             timedOut = true;
             proc.kill();
             resolve({
               valid: false,
               message: 'Codex CLI check timed out',
             });
           }, 5000);

           proc.on('error', () => {
             if (!timedOut) {
               clearTimeout(timeout);
               resolve({
                 valid: false,
                 message: 'Codex CLI is not installed or not in PATH',
               });
             }
           });

           proc.on('exit', (code: number | null) => {
             if (!timedOut) {
               clearTimeout(timeout);
               if (code === 0) {
                 resolve({ valid: true });
               } else {
                 resolve({
                   valid: false,
                   message: 'Codex CLI is not installed or not in PATH',
                 });
               }
             }
           });
         });
       }

       /**
        * 인증 힌트 제공
        */
       static getAuthHint(): string {
         return 'Run "codex login" or configure Codex authentication to proceed';
       }
     }
     ```

3. **Export 파일 작성**
   - 파일: `packages/providers/codex/src/index.ts`
   ```typescript
   export * from './provider.js';
   ```

4. **TypeScript 설정**
   - 파일: `packages/providers/codex/tsconfig.json`
   ```json
   {
     "extends": "../../../tsconfig.base.json",
     "compilerOptions": {
       "outDir": "./dist",
       "rootDir": "./src"
     },
     "include": ["src/**/*"]
   }
   ```

5. **빌드 및 검증**
   ```bash
   cd packages/providers/codex
   pnpm install
   pnpm build
   ```

---

### Phase 1.3: Claude Code Provider 리팩토링 (0.5일)

#### 작업 순서

1. **의존성 추가**
   - 파일: `packages/providers/claude-code/package.json`
   - 변경:
     ```json
     {
       "dependencies": {
         "@codecafe/providers-common": "workspace:*",
         "node-pty": "^1.0.0"
       }
     }
     ```

2. **ClaudeCodeProvider 리팩토링**
   - 파일: `packages/providers/claude-code/src/provider.ts`
   - 변경 사항:
     - IProvider 인터페이스 구현 추가
     - ValidationResult 타입 사용
     - 기존 로직은 그대로 유지 (호환성 보장)
   - 변경 예시:
     ```typescript
     import {
       IProvider,
       IProviderStatic,
       ProviderConfig,
       ValidationResult,
     } from '@codecafe/providers-common';

     export class ClaudeCodeProvider extends EventEmitter implements IProvider {
       // ... 기존 코드 유지 ...

       // validateEnv 반환 타입 변경
       static async validateEnv(): Promise<ValidationResult> {
         // ... 기존 로직 유지 ...
       }
     }
     ```

3. **빌드 및 검증**
   ```bash
   cd packages/providers/claude-code
   pnpm install
   pnpm build
   ```

---

### Phase 1.4: Git Worktree 패키지 구현 (2일)

#### 작업 순서

1. **Worktree 타입 정의**
   - 파일: `packages/git-worktree/src/types.ts`
   - 내용:
     ```typescript
     /**
      * Worktree 정보
      */
     export interface WorktreeInfo {
       path: string;
       branch: string;
       commit: string;
       bare?: boolean;
       detached?: boolean;
       prunable?: boolean;
     }

     /**
      * Worktree 생성 옵션
      */
     export interface WorktreeCreateOptions {
       repoPath: string;
       baseBranch: string;
       newBranch: string;
       worktreePath?: string; // 기본: {repoPath}/../.codecafe-worktrees/{newBranch}
     }

     /**
      * Patch 내보내기 옵션
      */
     export interface PatchExportOptions {
       worktreePath: string;
       baseBranch: string;
       outputPath?: string; // 기본: {worktreePath}/{branch}.patch
     }

     /**
      * Worktree 삭제 옵션
      */
     export interface WorktreeRemoveOptions {
       worktreePath: string;
       force?: boolean; // 미커밋 변경사항이 있어도 강제 삭제
     }
     ```

2. **WorktreeManager 클래스 구현**
   - 파일: `packages/git-worktree/src/worktree-manager.ts`
   - 구현 상세:
     ```typescript
     import { execFile } from 'child_process';
     import { promisify } from 'util';
     import * as path from 'path';
     import * as fs from 'fs';
     import {
       WorktreeInfo,
       WorktreeCreateOptions,
       PatchExportOptions,
       WorktreeRemoveOptions,
     } from './types.js';

     const execFileAsync = promisify(execFile);

     /**
      * Git Worktree 관리 클래스
      * 보안: execFile 사용으로 command injection 방지
      */
     export class WorktreeManager {
       /**
        * Worktree 생성
        */
       static async createWorktree(options: WorktreeCreateOptions): Promise<WorktreeInfo> {
         const { repoPath, baseBranch, newBranch, worktreePath } = options;

         // Worktree 경로 결정 (사전 합의서: 프로젝트 외부)
         const finalWorktreePath =
           worktreePath ||
           path.resolve(repoPath, '..', '.codecafe-worktrees', newBranch);

         try {
           // 1. Worktree 디렉터리 생성
           fs.mkdirSync(path.dirname(finalWorktreePath), { recursive: true });

           // 2. Git worktree add 실행 (보안: execFile 사용)
           await execFileAsync(
             'git',
             ['worktree', 'add', '-b', newBranch, finalWorktreePath, baseBranch],
             { cwd: repoPath }
           );

           // 3. Worktree 정보 조회
           const info = await this.getWorktreeInfo(repoPath, finalWorktreePath);

           return info;
         } catch (error: any) {
           throw new Error(`Failed to create worktree: ${error.message}`);
         }
       }

       /**
        * Worktree 목록 조회
        */
       static async listWorktrees(repoPath: string): Promise<WorktreeInfo[]> {
         try {
           const { stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain'], {
             cwd: repoPath,
           });

           return this.parseWorktreeList(stdout);
         } catch (error: any) {
           throw new Error(`Failed to list worktrees: ${error.message}`);
         }
       }

       /**
        * Worktree 정보 조회
        */
       static async getWorktreeInfo(
         repoPath: string,
         worktreePath: string
       ): Promise<WorktreeInfo> {
         const worktrees = await this.listWorktrees(repoPath);
         const info = worktrees.find((wt) => wt.path === worktreePath);

         if (!info) {
           throw new Error(`Worktree not found: ${worktreePath}`);
         }

         return info;
       }

       /**
        * Worktree 삭제
        */
       static async removeWorktree(options: WorktreeRemoveOptions): Promise<void> {
         const { worktreePath, force } = options;

         try {
           // 1. 미커밋 변경사항 확인 (force=false 일 때)
           if (!force) {
             const hasChanges = await this.hasUncommittedChanges(worktreePath);
             if (hasChanges) {
               throw new Error(
                 'Worktree has uncommitted changes. Use force=true to delete anyway.'
               );
             }
           }

           // 2. Git worktree remove 실행 (보안: execFile 사용)
           const args = force
             ? ['worktree', 'remove', '--force', worktreePath]
             : ['worktree', 'remove', worktreePath];

           await execFileAsync('git', args, { cwd: worktreePath });
         } catch (error: any) {
           throw new Error(`Failed to remove worktree: ${error.message}`);
         }
       }

       /**
        * Patch 내보내기
        */
       static async exportPatch(options: PatchExportOptions): Promise<string> {
         const { worktreePath, baseBranch, outputPath } = options;

         try {
           // 1. 현재 브랜치명 조회
           const { stdout: currentBranch } = await execFileAsync(
             'git',
             ['branch', '--show-current'],
             { cwd: worktreePath }
           );

           // 2. Patch 파일 경로 결정
           const patchPath =
             outputPath || path.join(worktreePath, `${currentBranch.trim()}.patch`);

           // 3. git diff 실행 (보안: execFile 사용)
           const { stdout: diffOutput } = await execFileAsync(
             'git',
             ['diff', `${baseBranch}...HEAD`],
             { cwd: worktreePath }
           );

           // 4. Patch 파일 저장
           fs.writeFileSync(patchPath, diffOutput, 'utf-8');

           return patchPath;
         } catch (error: any) {
           throw new Error(`Failed to export patch: ${error.message}`);
         }
       }

       /**
        * 미커밋 변경사항 확인
        */
       private static async hasUncommittedChanges(worktreePath: string): Promise<boolean> {
         try {
           const { stdout } = await execFileAsync('git', ['status', '--porcelain'], {
             cwd: worktreePath,
           });

           return stdout.trim().length > 0;
         } catch (error) {
           return false;
         }
       }

       /**
        * Worktree list 파싱
        */
       private static parseWorktreeList(output: string): WorktreeInfo[] {
         const worktrees: WorktreeInfo[] = [];
         const lines = output.split('\n');
         let current: Partial<WorktreeInfo> = {};

         for (const line of lines) {
           if (line.startsWith('worktree ')) {
             if (current.path) {
               worktrees.push(current as WorktreeInfo);
             }
             current = { path: line.substring(9) };
           } else if (line.startsWith('branch ')) {
             current.branch = line.substring(7).replace('refs/heads/', '');
           } else if (line.startsWith('HEAD ')) {
             current.commit = line.substring(5);
           } else if (line.startsWith('bare')) {
             current.bare = true;
           } else if (line.startsWith('detached')) {
             current.detached = true;
           } else if (line.startsWith('prunable')) {
             current.prunable = true;
           }
         }

         if (current.path) {
           worktrees.push(current as WorktreeInfo);
         }

         return worktrees;
       }
     }
     ```

3. **Package.json 작성**
   - 파일: `packages/git-worktree/package.json`
   ```json
   {
     "name": "@codecafe/git-worktree",
     "version": "0.1.0",
     "main": "./dist/index.js",
     "types": "./dist/index.d.ts",
     "scripts": {
       "build": "tsc",
       "clean": "rm -rf dist"
     },
     "devDependencies": {
       "@types/node": "^20.0.0",
       "typescript": "^5.0.0"
     }
   }
   ```

4. **Export 파일 작성**
   - 파일: `packages/git-worktree/src/index.ts`
   ```typescript
   export * from './types.js';
   export * from './worktree-manager.js';
   ```

5. **TypeScript 설정**
   - 파일: `packages/git-worktree/tsconfig.json`
   ```json
   {
     "extends": "../../../tsconfig.base.json",
     "compilerOptions": {
       "outDir": "./dist",
       "rootDir": "./src"
     },
     "include": ["src/**/*"]
   }
   ```

6. **빌드 및 검증**
   ```bash
   cd packages/git-worktree
   pnpm install
   pnpm build
   ```

---

### Phase 1.5: Core 타입 확장 (0.5일)

#### 작업 순서

1. **Order 타입에 Worktree 정보 추가**
   - 파일: `packages/core/src/types.ts`
   - 변경 (Order 인터페이스):
     ```typescript
     /**
      * Order (주문 = 레시피 실행 인스턴스)
      */
     export interface Order {
       id: string;
       recipeId: string;
       recipeName: string;
       baristaId: string | null;
       status: OrderStatus;
       counter: string; // 실행 대상 프로젝트 경로 (worktree 모드 시 worktree 경로)
       provider: ProviderType;
       vars: Record<string, string>;
       createdAt: Date;
       startedAt: Date | null;
       endedAt: Date | null;
       error?: string;
       // M2 추가: Worktree 정보
       worktreeInfo?: {
         path: string;
         branch: string;
         baseBranch: string;
       };
     }
     ```

2. **빌드 검증**
   ```bash
   cd packages/core
   pnpm build
   ```

---

### Phase 1.6: CLI Doctor 확장 (0.5일)

#### 작업 순서

1. **Doctor 명령에 Codex 점검 추가**
   - 파일: `packages/cli/src/commands/doctor.ts`
   - 변경 (Codex 점검 로직 추가):
     ```typescript
     import { CodexProvider } from '@codecafe/providers-codex';
     import { ClaudeCodeProvider } from '@codecafe/providers-claude-code';

     // ... 기존 코드 ...

     export async function runDoctor() {
       console.log('🔍 CodeCafe Environment Check\n');

       // Claude Code 점검
       const claudeResult = await ClaudeCodeProvider.validateEnv();
       console.log(`Claude Code: ${claudeResult.valid ? '✅ OK' : '❌ Not Found'}`);
       if (!claudeResult.valid && claudeResult.message) {
         console.log(`  ${claudeResult.message}`);
         console.log(`  Hint: ${ClaudeCodeProvider.getAuthHint()}`);
       }

       // Codex 점검 (M2 추가)
       const codexResult = await CodexProvider.validateEnv();
       console.log(`Codex CLI: ${codexResult.valid ? '✅ OK' : '❌ Not Found'}`);
       if (!codexResult.valid && codexResult.message) {
         console.log(`  ${codexResult.message}`);
         console.log(`  Hint: ${CodexProvider.getAuthHint()}`);
       }

       // Git 점검
       const gitResult = await checkGitInstalled();
       console.log(`Git: ${gitResult.version || '❌ Not Found'}`);
       if (gitResult.version) {
         // Git 버전 체크 (2.20+ 필요)
         const versionMatch = gitResult.version.match(/(\d+)\.(\d+)/);
         if (versionMatch) {
           const major = parseInt(versionMatch[1]);
           const minor = parseInt(versionMatch[2]);
           if (major < 2 || (major === 2 && minor < 20)) {
             console.log(`  ⚠️  Git 2.20+ required for worktree support`);
           }
         }
       }

       // Node.js 점검
       console.log(`Node.js: ✅ ${process.version}`);
     }

     async function checkGitInstalled(): Promise<{ version?: string }> {
       try {
         const { execFile } = require('child_process');
         const { promisify } = require('util');
         const execFileAsync = promisify(execFile);

         const { stdout } = await execFileAsync('git', ['--version']);
         return { version: stdout.trim() };
       } catch {
         return {};
       }
     }
     ```

2. **의존성 추가**
   - 파일: `packages/cli/package.json`
   ```json
   {
     "dependencies": {
       "@codecafe/providers-codex": "workspace:*",
       "@codecafe/providers-claude-code": "workspace:*"
     }
   }
   ```

3. **빌드 및 검증**
   ```bash
   cd packages/cli
   pnpm install
   pnpm build
   codecafe doctor  # 실제 실행 테스트
   ```

---

### Phase 1.7: 워크스페이스 설정 (0.5일)

#### 작업 순서

1. **루트 package.json 확인**
   - 파일: `package.json`
   - 확인 사항: pnpm workspaces 설정에 신규 패키지 포함 여부
   - 예상 내용:
     ```json
     {
       "workspaces": [
         "packages/*",
         "packages/providers/*"
       ]
     }
     ```

2. **pnpm-workspace.yaml 확인**
   - 파일: `pnpm-workspace.yaml`
   - 예상 내용:
     ```yaml
     packages:
       - 'packages/*'
       - 'packages/providers/*'
     ```

3. **전체 빌드 검증**
   ```bash
   pnpm install
   pnpm -r build  # 모든 패키지 빌드
   ```

---

### Phase 1.8: 통합 검증 (1일)

#### 검증 항목

1. **Provider 인터페이스 검증**
   - Claude Code Provider와 Codex Provider가 동일한 IProvider 인터페이스 구현
   - 타입 체크 통과 확인

2. **Worktree 기능 검증**
   - 수동 테스트 스크립트 작성 (`.claude/docs/tasks/m2-phase1/test-worktree.sh`)
     ```bash
     #!/bin/bash
     # Worktree 생성 테스트
     cd /tmp
     git clone https://github.com/example/test-repo
     cd test-repo
     node -e "
     const { WorktreeManager } = require('@codecafe/git-worktree');
     WorktreeManager.createWorktree({
       repoPath: process.cwd(),
       baseBranch: 'main',
       newBranch: 'test-worktree'
     }).then(info => console.log(info));
     "
     ```

3. **Doctor 명령 검증**
   ```bash
   codecafe doctor
   # 출력 확인:
   # - Claude Code 점검
   # - Codex CLI 점검
   # - Git 점검 (버전 체크 포함)
   # - Node.js 점검
   ```

4. **타입 체크 + 빌드**
   ```bash
   pnpm -r exec tsc --noEmit  # 모든 패키지 타입 체크
   pnpm -r build              # 전체 빌드
   ```

---

## 의존성

### 필수 선행 작업
- 없음 (Phase 1은 독립적으로 진행 가능)

### 확인 필요 사항
1. **Codex CLI 설치 확인** (사용자 환경)
   - 사전 합의서에서 로컬 테스트 가능 확인됨
   - `codex --version` 실행 가능 여부

2. **tsconfig.base.json 존재 여부**
   - 각 패키지에서 상속하는 기본 TypeScript 설정
   - 없을 경우 개별 tsconfig.json에 전체 설정 포함 필요

3. **pnpm 버전**
   - Workspace protocol 지원 버전 (>=7.0.0)

### 외부 의존성
- node-pty: ^1.0.0
- TypeScript: ^5.0.0
- Git: 2.20+ (worktree 명령 지원)

---

## 위험 및 대응 전략

### 1. Codex CLI 실행 방식 차이
**위험**: Codex CLI가 Claude Code와 다른 인터랙티브 모드를 사용할 수 있음
**영향**: Provider 구현 수정 필요
**대응**:
- 우선순위 1: 로컬 환경에서 `codex` 명령 직접 테스트
- 백업: Codex 문서 확인 후 명령어 형식 조정
- 최악: M2 범위에서 Codex Provider는 선택적 기능으로 전환

### 2. Worktree 경로 이슈
**위험**: Windows/macOS/Linux에서 경로 처리 차이로 worktree 생성 실패
**영향**: 병렬 실행 불가능
**대응**:
- `path.resolve` 사용으로 크로스플랫폼 경로 처리
- Git porcelain 명령 사용 (플랫폼 독립적)
- Phase 1.8 검증 단계에서 Windows 환경 테스트 필수

### 3. Git 버전 호환성
**위험**: 구버전 Git에서 worktree 명령 미지원
**영향**: Worktree 기능 사용 불가
**대응**:
- Doctor 명령에 Git 버전 체크 추가 (2.20+ 필요)
- 에러 메시지에 Git 업그레이드 안내 포함

### 4. TypeScript 순환 참조
**위험**: 패키지 간 의존성 순환 참조 발생 가능
**영향**: 빌드 실패
**대응**:
- 의존성 방향 명확히 정의 (common → providers, core → providers)
- 빌드 순서 제어 (`pnpm -r build` 대신 개별 빌드)

### 5. Command Injection 보안
**위험**: execSync 사용 시 명령어 인젝션 취약점
**영향**: 보안 위협
**대응**: (✅ 적용 완료)
- WorktreeManager에서 execFile 사용으로 변경
- 모든 Git 명령을 인자 배열로 전달 (shell escape 불필요)

---

## 체크포인트

### Phase 1.1 완료 기준
- [ ] `@codecafe/providers-common` 패키지 빌드 성공
- [ ] IProvider 인터페이스 타입 체크 통과

### Phase 1.2 완료 기준
- [ ] `@codecafe/providers-codex` 패키지 빌드 성공
- [ ] CodexProvider가 IProvider 구현

### Phase 1.3 완료 기준
- [ ] ClaudeCodeProvider가 IProvider 구현으로 리팩토링 완료
- [ ] 기존 기능 정상 동작 (후방 호환성 유지)

### Phase 1.4 완료 기준
- [ ] `@codecafe/git-worktree` 패키지 빌드 성공
- [ ] Worktree 생성/삭제/목록 조회 기능 구현
- [ ] Patch 내보내기 기능 구현
- [ ] execFile 사용으로 보안 강화 확인

### Phase 1.5 완료 기준
- [ ] Order 타입에 worktreeInfo 필드 추가
- [ ] Core 패키지 빌드 성공

### Phase 1.6 완료 기준
- [ ] `codecafe doctor` 명령에서 Codex CLI 점검 가능
- [ ] Git 버전 체크 기능 추가 (2.20+)
- [ ] 모든 Provider 점검 결과 출력

### Phase 1.7 완료 기준
- [ ] pnpm install 성공 (모든 패키지 의존성 해결)
- [ ] pnpm -r build 성공 (전체 빌드)

### Phase 1.8 완료 기준
- [ ] 모든 패키지 타입 체크 통과
- [ ] Worktree 기능 수동 테스트 성공
- [ ] Doctor 명령 실행 검증 완료

---

## 남은 질문

### 확인 필요
1. **tsconfig.base.json 존재 여부**
   - 루트에 공통 TypeScript 설정 파일이 있는지?
   - 없으면 각 패키지 tsconfig.json에 전체 설정 포함 필요

2. **현재 pnpm 버전**
   - Workspace protocol 지원 여부 확인

3. **Codex CLI 로컬 테스트 결과**
   - `codex` 명령 실행 시 정확한 출력 형태는?
   - 인터랙티브 모드 진입 방법은?

### 향후 Phase 2/3 고려 사항
1. **Orchestrator에 Worktree 생성 로직 통합**
   - Order 생성 시 workspace.mode=worktree일 때 자동 생성
   - Phase 2에서 구현 예정

2. **Barista Manager의 병렬 실행 제어**
   - Parallel step 실행 시 바리스타 풀 관리
   - Phase 2에서 구현 예정

3. **UI Provider 선택 드롭다운**
   - Desktop 패키지에서 Provider 목록 표시
   - Phase 3에서 구현 예정

---

## 예상 소요 시간

- Phase 1.1: 1일
- Phase 1.2: 1일
- Phase 1.3: 0.5일
- Phase 1.4: 2일
- Phase 1.5: 0.5일
- Phase 1.6: 0.5일
- Phase 1.7: 0.5일
- Phase 1.8: 1일

**총 예상 시간**: 7일 (1주일)

---

## 참고 자료

- M2 사전 합의서: `.claude/docs/agreements/m2-features-agreement.md`
- 현재 Provider 구현: `packages/providers/claude-code/src/provider.ts`
- Recipe 스키마: `packages/schema/src/recipe-schema.ts`
- Orchestrator: `packages/core/src/orchestrator.ts`
