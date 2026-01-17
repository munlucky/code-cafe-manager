# Phase 2 Missing Items Implementation Plan

> Project rules: `.claude/PROJECT.md`

## Metadata

- Author: Context Builder Agent
- Created: 2026-01-12
- Branch: main
- Complexity: medium
- Related doc: `.claude/docs/tasks/phase-2-implementation-status.md`
- Reference: `.claude/docs/tasks/phase-2-split/` (14 detailed documents)

## Task Overview

- **Goal**: Phase 2 누락 항목 구현 완료 (P0 우선순위 + Provider 실제 연동)
- **Scope**:
  - ✅ Included: 기본 Role 4종, Vitest 설정, Claude Code/Codex Provider 실제 연동
  - ❌ Excluded: UI Components (P2), Zod schemas (P2), 부하 테스트 (P2)
- **Impact**: Phase 2 핵심 기능 완성 (현재 65% → 90%), 실제 Provider 연동으로 Mock 의존성 제거

## Current State

### 이미 구현된 것 (재사용)

1. **Terminal Pool 핵심**:
   - `packages/orchestrator/src/terminal/terminal-pool.ts` - Pool 로직, Crash Recovery
   - `packages/orchestrator/src/terminal/pool-semaphore.ts` - 동시성 제어
   - `packages/orchestrator/src/terminal/provider-adapter.ts` - IProviderAdapter interface, MockProviderAdapter

2. **Role System 기반**:
   - `packages/core/src/types/role.ts` - Role 타입 정의
   - `packages/orchestrator/src/role/role-manager.ts` - Role CRUD 관리
   - `packages/orchestrator/src/role/template.ts` - Handlebars 렌더링
   - `packages/roles/generic-agent.md` - Fallback role (Gap 4 해결)

3. **Barista Integration**:
   - `packages/orchestrator/src/barista/barista-engine-v2.ts` - Terminal Pool 기반 실행
   - `packages/orchestrator/src/barista/barista-manager.ts` - Role 통합

### 누락된 것 (이번 구현 대상)

1. **기본 Role 4종** (P0):
   - `packages/orchestrator/templates/roles/`에는 존재하나 `packages/roles/`로 이동 필요
   - planner.md, coder.md, tester.md, reviewer.md

2. **Provider 실제 연동** (P1 → P0로 승격):
   - Claude Code CLI Adapter (`claude-code-adapter.ts`)
   - Codex API Adapter (`codex-adapter.ts`)
   - ProviderAdapterFactory 확장 (`create()`, `initialize()` methods)

3. **Vitest 설정** (P0):
   - 기존 테스트 파일들 실행 가능하도록 구성
   - Coverage 측정 설정

### Similar Features

- **기존 Role 템플릿**: `packages/orchestrator/templates/roles/*.md` 참고
- **MockProviderAdapter**: `packages/orchestrator/src/terminal/provider-adapter.ts` 참고

## Target Files

### New

#### 1. Provider Adapters (Gap 1 해결)

- `packages/orchestrator/src/terminal/adapters/claude-code-adapter.ts`
  - Claude Code CLI 실제 연동 (node-pty 사용)
  - stdin/stdout 프로토콜 구현 (text-based, `\r\n` 종료, idle 500ms 감지)

- `packages/orchestrator/src/terminal/adapters/codex-adapter.ts`
  - Codex API 실제 연동 (node-pty 사용)
  - JSON-based 프로토콜 구현 (`{"type":"prompt"}` → `{"type":"done"}`)

#### 2. 기본 Role 4종 (Gap 4 보완)

- `packages/roles/planner.md`
  - ID: planner, Provider: claude-code
  - 기능: Implementation plan 작성
  - 소스: `templates/roles/planner.md` 기반 수정

- `packages/roles/coder.md`
  - ID: coder, Provider: claude-code
  - 기능: Code 작성/수정
  - 소스: `templates/roles/coder.md` 기반 수정

- `packages/roles/tester.md`
  - ID: tester, Provider: claude-code
  - 기능: Test 작성/실행
  - 소스: `templates/roles/tester.md` 기반 수정

- `packages/roles/reviewer.md`
  - ID: reviewer, Provider: claude-code
  - 기능: Code review 수행
  - 소스: `templates/roles/reviewer.md` 기반 수정

#### 3. Vitest 설정

- `packages/orchestrator/vitest.config.ts`
  - Vitest 설정 파일
  - Coverage 설정
  - Test 경로 지정

### Modified

- `packages/orchestrator/src/terminal/provider-adapter.ts`
  - ProviderAdapterFactory 확장: `create()`, `initialize()` static methods 추가
  - Mock/실제 전환 로직 추가 (환경 변수 기반: `NODE_ENV=test`)

- `packages/orchestrator/src/terminal/terminal-pool.ts`
  - Constructor에서 `ProviderAdapterFactory.initialize()` 호출 추가
  - 기존 `Factory.get()` 사용 로직 유지

- `packages/orchestrator/src/terminal/index.ts`
  - 새 Adapter 모듈 export 추가

- `packages/orchestrator/package.json`
  - `node-pty` 의존성 추가 (실제 PTY 사용)
  - Vitest 의존성 추가
  - Test 스크립트 추가

- `packages/roles/README.md` (NEW)
  - Role 작성 가이드
  - Frontmatter 규칙 설명

## Implementation Plan

### Phase 1: Provider Adapters 구현 (Day 1-2)

**목표**: 실제 Provider 연동으로 Mock 의존성 제거

**Architecture Decision** (Codex feedback #1):
- **기존**: `ProviderAdapterFactory` (static methods) 사용
- **변경**: Factory 확장하여 Mock/실제 전환 로직 추가
- **Adapter 선택 흐름**:
  1. TerminalPool 초기화 시 Factory에 adapters 등록
  2. `ProviderAdapterFactory.create(providerType, useMock)` 호출
  3. `useMock = process.env.NODE_ENV === 'test'` (기본값)
  4. TerminalPool.getOrCreateTerminal()에서 `Factory.get(provider)` 사용

#### Step 1.1: Claude Code Adapter 구현
- **파일**: `packages/orchestrator/src/terminal/adapters/claude-code-adapter.ts`
- **내용**:
  1. `IProviderAdapter` 구현
  2. `node-pty`로 `claude` CLI spawn
  3. **Text-based 프로토콜 상세** (Codex feedback #2):
     - `sendPrompt()`:
       - Escape special chars: `prompt.replace(/\r/g, '\\r').replace(/\n/g, '\\n')`
       - Send: `process.write(escapedPrompt + '\r\n')`
       - Wait for echo confirmation (first 20 chars match)
     - `readOutput()`:
       - Accumulate stdout chunks in buffer
       - **Idle detection**: No data for 500ms (configurable via param)
       - **Boundary detection**: Look for newline patterns (`\n\n` or prompt marker)
       - Return accumulated output, trim whitespace
     - `waitForExit()`: 프로세스 종료 대기, timeout handling
  4. **Error handling**:
     - spawn failure: throw ProviderSpawnError
     - timeout: throw ProviderTimeoutError (after 3 retries)
     - protocol error: log warning, return partial output

- **참고**: `.claude/docs/tasks/phase-2-split/02-terminal-execution-contract.md` (Line 149-272)

#### Step 1.2: Codex Adapter 구현
- **파일**: `packages/orchestrator/src/terminal/adapters/codex-adapter.ts`
- **내용**:
  1. `IProviderAdapter` 구현
  2. `node-pty`로 `codex --interactive` spawn
  3. **JSON-based 프로토콜 상세** (Codex feedback #2):
     - `sendPrompt()`:
       - Construct: `{"type":"prompt","content":prompt,"id":uuid()}`
       - Send: `process.write(JSON.stringify(msg) + '\n')`
       - Wait for ACK: `{"type":"ack","id":uuid}`
     - `readOutput()`:
       - **Line-by-line parsing**: accumulate buffer, split by `\n`
       - **JSON framing validation**:
         - Try parse each line as JSON
         - If parse error, log warning and continue
         - Accumulate `{"type":"output","content":"..."}` messages
         - Stop when `{"type":"done","id":uuid}` received
       - **Timeout**: configurable (default 30s), throw after 3 retries
       - Return concatenated output content
     - `waitForExit()`: 프로세스 종료 대기, timeout handling
  4. **Error handling**:
     - spawn failure: throw ProviderSpawnError
     - JSON parse error: log + skip line (partial tolerance)
     - timeout: throw ProviderTimeoutError
     - protocol error: throw ProviderProtocolError

- **참고**: `.claude/docs/tasks/phase-2-split/02-terminal-execution-contract.md` (Line 277-398)

#### Step 1.3: ProviderAdapterFactory 확장 (기존 Factory 재사용)
- **파일**: `packages/orchestrator/src/terminal/provider-adapter.ts`
- **변경사항** (Codex feedback #1):
  1. **기존 유지**: `register()`, `get()`, `has()` static methods
  2. **신규 추가**:
     - `create(providerType, useMock?)` static method:
       ```typescript
       static create(providerType: ProviderType, useMock?: boolean): IProviderAdapter {
         const shouldUseMock = useMock ?? (process.env.NODE_ENV === 'test');
         if (shouldUseMock) {
           return new MockProviderAdapter(providerType);
         }
         return this.get(providerType); // Get real adapter
       }
       ```
     - `initialize()` static method: 자동으로 ClaudeCodeAdapter, CodexAdapter 등록
  3. **Import 추가**: ClaudeCodeAdapter, CodexAdapter import

#### Step 1.4: TerminalPool 통합
- **파일**: `packages/orchestrator/src/terminal/terminal-pool.ts`
- **변경**:
  1. **No change to constructor** (현재 config만 받음, Factory는 global singleton)
  2. **Factory 초기화**: Constructor에서 `ProviderAdapterFactory.initialize()` 호출
  3. **기존 getOrCreateTerminal() 유지**: 이미 `ProviderAdapterFactory.get(provider)` 사용 중

- **파일**: `packages/orchestrator/src/terminal/index.ts`
- **변경**: Adapter 모듈들 export 추가
  ```typescript
  export * from './adapters/claude-code-adapter.js';
  export * from './adapters/codex-adapter.js';
  ```

#### Step 1.5: 테스트 환경 설정
- **파일**: `packages/orchestrator/test/setup.ts`
- **내용**:
  ```typescript
  // Force Mock adapters in tests
  process.env.NODE_ENV = 'test';

  import { ProviderAdapterFactory, MockProviderAdapter } from '../src/terminal/provider-adapter.js';

  // Register mock adapters for all providers
  ProviderAdapterFactory.register('claude-code', new MockProviderAdapter('claude-code'));
  ProviderAdapterFactory.register('codex', new MockProviderAdapter('codex'));
  ```

**Verification**:
```bash
cd packages/orchestrator
pnpm install node-pty
pnpm typecheck

# Manual test (requires claude CLI installed)
node -e "
const { ClaudeCodeAdapter } = require('./dist/terminal/adapters/claude-code-adapter.js');
const adapter = new ClaudeCodeAdapter();
adapter.spawn().then(p => console.log('Spawned:', p.pid));
"
```

---

### Phase 2: 기본 Role 4종 추가 (Day 2)

**목표**: Gap 4 보완, 기본 Role 완성

**Role Loading Integration** (Codex feedback #3):
- **현재**: RoleManager는 `.orch/roles/`만 지원 (user-defined roles)
- **변경**: 다중 경로 지원, 우선순위 적용
  1. `.orch/roles/` - 사용자 커스텀 roles (highest priority)
  2. `packages/roles/` - 프로젝트 기본 roles (내장)
  3. `node_modules/@codecafe/roles/` - 패키지 roles (fallback)
- **Discovery**: `fs.readdir()` + glob pattern `*.md` (모든 경로 스캔)
- **Path resolution**: `path.resolve()` 사용, 우선순위 순서대로 검색
- **RoleManager 수정 필요**:
  ```typescript
  constructor(rolePaths?: string[]) {
    this.rolePaths = rolePaths || [
      path.join(process.cwd(), '.orch', 'roles'),
      path.join(process.cwd(), 'packages', 'roles'),
      path.join(process.cwd(), 'node_modules', '@codecafe', 'roles'),
    ];
  }

  listRoles(): string[] {
    const roleIds = new Set<string>();
    for (const rolesDir of this.rolePaths) {
      if (fs.existsSync(rolesDir)) {
        fs.readdirSync(rolesDir)
          .filter(f => f.endsWith('.md'))
          .forEach(f => roleIds.add(path.basename(f, '.md')));
      }
    }
    return Array.from(roleIds);
  }

  loadRole(roleId: string): Role | null {
    for (const rolesDir of this.rolePaths) {
      const rolePath = path.join(rolesDir, `${roleId}.md`);
      if (fs.existsSync(rolePath)) {
        // Load and return (first match wins)
        return this.parseRoleFile(rolePath, roleId);
      }
    }
    return null; // Not found in any path
  }
  ```

#### Step 2.1: templates/roles/ → packages/roles/ 복사 및 수정
- **작업**:
  1. `templates/roles/planner.md` 복사 → `packages/roles/planner.md` (수정)
  2. `templates/roles/coder.md` 복사 → `packages/roles/coder.md` (수정)
  3. `templates/roles/tester.md` 복사 → `packages/roles/tester.md` (수정)
  4. `templates/roles/reviewer.md` 복사 → `packages/roles/reviewer.md` (수정)
- **주의**: templates는 유지 (기존 사용처가 있을 수 있음)

#### Step 2.2: Frontmatter 업데이트
- **작업**: 각 Role 파일의 frontmatter를 Phase 2 스펙에 맞게 변경

**Before (templates 형식)**:
```yaml
---
id: planner
name: Planner
output_schema: schemas/plan.schema.json
inputs:
  - .orch/context/requirements.md
guards:
  - Output must be valid JSON
---
```

**After (packages/roles 형식)**:
```yaml
---
id: planner
name: Planner
recommended_provider: claude-code
skills:
  - read_file
  - write_file
  - analyze_code
variables:
  - name: task
    type: string
    required: true
    description: "Task description"
  - name: constraints
    type: string
    required: false
    description: "Implementation constraints"
---
```

#### Step 2.3: System Prompt 수정
- **작업**: 각 Role의 본문(system prompt)을 Handlebars 템플릿으로 변경
- **패턴**:
  ```markdown
  # {Role Name} Role

  You are a {role description}.

  ## Task
  {{task}}

  {{#if constraints}}
  ## Constraints
  {{constraints}}
  {{/if}}

  ## Guidelines
  - {guideline 1}
  - {guideline 2}
  ```

#### Step 2.4: README 작성
- **파일**: `packages/roles/README.md`
- **내용**:
  - Role 작성 가이드
  - Frontmatter 필드 설명
  - Variable 사용 예시

**Verification**:
```bash
# RoleManager로 로드 테스트
cd packages/orchestrator
pnpm test src/role/role-manager.test.ts

# 수동 검증
node -e "
const { RoleManager } = require('./dist/role/role-manager.js');
const manager = new RoleManager();
const roles = manager.listRoles();
console.log('Loaded roles:', roles); // Should include planner, coder, tester, reviewer, generic-agent
"
```

---

### Phase 3: Vitest 설정 (Day 3)

**목표**: 기존 테스트 실행 가능하도록 구성

**Vitest Migration Impact** (Codex feedback #5):
- **기존 테스트 현황**: Jest 없음, Vitest 전용으로 작성된 .test.ts 파일들 존재
- **API 호환성**:
  - ✅ `describe`, `it`, `expect`: Vitest 호환
  - ✅ `beforeEach`, `afterEach`: Vitest 호환
  - ⚠️ `jest.fn()` → `vi.fn()` 변경 필요 (사용 시)
  - ⚠️ `jest.mock()` → `vi.mock()` 변경 필요 (사용 시)
- **ESM 설정**:
  - `package.json`: `"type": "module"` 이미 설정됨
  - `vitest.config.ts`: 별도 설정 불필요 (Node.js가 ESM 인식)
- **Test environment**: `node` (default, browser 아님)
- **Setup file**: `test/setup.ts` (vitest.config.ts에서 지정)

#### Step 3.1: Vitest 설치
- **파일**: `packages/orchestrator/package.json`
- **변경**:
  ```json
  {
    "devDependencies": {
      "vitest": "^1.2.0",
      "@vitest/coverage-v8": "^1.2.0"
    },
    "scripts": {
      "test": "vitest",
      "test:ui": "vitest --ui",
      "test:coverage": "vitest --coverage"
    }
  }
  ```

#### Step 3.2: Vitest 설정 파일 작성
- **파일**: `packages/orchestrator/vitest.config.ts`
- **내용**:
  ```typescript
  import { defineConfig } from 'vitest/config';

  export default defineConfig({
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
      exclude: ['node_modules', 'dist'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'dist/',
          '**/*.test.ts',
          '**/*.config.ts',
        ],
      },
      setupFiles: ['./test/setup.ts'],
    },
  });
  ```

#### Step 3.3: Test setup 파일 작성
- **파일**: `packages/orchestrator/test/setup.ts`
- **내용**:
  ```typescript
  import { beforeAll, afterAll } from 'vitest';

  // Set NODE_ENV to test (enables MockProviderAdapter)
  process.env.NODE_ENV = 'test';

  beforeAll(() => {
    console.log('Test suite starting...');
  });

  afterAll(() => {
    console.log('Test suite finished.');
  });
  ```

#### Step 3.4: 기존 테스트 실행 확인
- **대상 파일**:
  - `src/terminal/terminal-pool.test.ts`
  - `src/barista/barista-manager.test.ts`
  - `src/barista/barista-engine-v2.test.ts`

**Verification**:
```bash
cd packages/orchestrator
pnpm install
pnpm test
pnpm test:coverage
```

---

### Phase 4: Integration & Verification (Day 3-4)

**목표**: 전체 통합 검증

**Adapter Test Harness** (Codex feedback #4):
- **Mock CLI Strategy**: MockProviderAdapter (이미 존재) + Fake PTY fixtures
- **Adapter-specific Tests**:
  1. **ClaudeCodeAdapter Test** (`src/terminal/adapters/claude-code-adapter.test.ts`):
     - Mock PTY with fake stdout: `"claude> "`
     - Test sendPrompt(): verify echo, escaping
     - Test readOutput(): verify idle detection, boundary detection
     - Test error handling: spawn failure, timeout
  2. **CodexAdapter Test** (`src/terminal/adapters/codex-adapter.test.ts`):
     - Mock PTY with fake JSON lines
     - Test sendPrompt(): verify ACK
     - Test readOutput(): verify JSON framing, accumulation, done signal
     - Test error handling: parse error tolerance, timeout
  3. **ProviderAdapterFactory Test** (`src/terminal/provider-adapter.test.ts`):
     - Test register/get/has
     - Test create() with useMock=true/false
     - Test initialize() auto-registration
- **Fake PTY Fixtures** (`test/fixtures/fake-pty.ts`):
  ```typescript
  export class FakePty {
    private dataHandler: ((data: string) => void) | null = null;
    pid = 12345;

    write(data: string) {
      // Simulate echo
      if (this.dataHandler) {
        setTimeout(() => this.dataHandler!(data), 10);
      }
    }

    onData(handler: (data: string) => void) {
      this.dataHandler = handler;
    }

    kill() {
      // no-op
    }
  }
  ```

#### Step 4.1: Unit Test 실행
```bash
cd packages/orchestrator
pnpm test
```

- **기대 결과**: 모든 테스트 통과
- **주요 테스트**:
  - TerminalPool: spawn, lease, release, crash recovery
  - BaristaManager: Role 기반 Barista 생성
  - BaristaEngineV2: Terminal lease + 실행

#### Step 4.2: Integration Test (수동)
```bash
# 1. Build all packages
pnpm build

# 2. Test Role loading
node -e "
const { RoleManager } = require('./packages/orchestrator/dist/role/role-manager.js');
const manager = new RoleManager();
const roles = manager.listRoles();
console.log('Available roles:', roles);
// Expected: ['generic-agent', 'planner', 'coder', 'tester', 'reviewer']
"

# 3. Test ProviderAdapterFactory
node -e "
const { ProviderAdapterFactory } = require('./packages/orchestrator/dist/terminal/provider-adapter.js');
ProviderAdapterFactory.initialize();
console.log('Has claude-code:', ProviderAdapterFactory.has('claude-code'));
console.log('Has codex:', ProviderAdapterFactory.has('codex'));
// Expected: true, true
"

# 4. Test TerminalPool with real adapter (requires claude CLI)
node -e "
const { TerminalPool } = require('./packages/orchestrator/dist/terminal/terminal-pool.js');
const config = {
  perProvider: {
    'claude-code': { size: 2, timeout: 5000, maxRetries: 3 }
  }
};
const pool = new TerminalPool(config);
pool.lease('claude-code').then(({ terminal, token }) => {
  console.log('Leased terminal:', terminal.id);
  pool.release(terminal, token);
});
"
```

#### Step 4.3: Type Check
```bash
pnpm typecheck
```

#### Step 4.4: Build Verification
```bash
pnpm build
```

**Verification Checklist**:
- [ ] All unit tests pass
- [ ] 5 roles loaded (generic-agent + 4 basic roles)
- [ ] ProviderAdapterFactory has claude-code and codex registered
- [ ] TerminalPool can lease/release with real adapter
- [ ] Type check passes
- [ ] Build succeeds
- [ ] Coverage > 70%

## Risks and Alternatives

### Risk 1: Claude Code CLI 설치 누락
- **Impact**: ClaudeCodeAdapter spawn 실패
- **Mitigation**:
  - README에 설치 가이드 추가
  - `doctor` 명령어에 CLI 설치 확인 추가
  - 테스트 시 Mock 사용 (환경 변수 전환)
- **Alternative**: Docker 이미지로 CLI 포함 배포

### Risk 2: node-pty Windows 빌드 실패
- **Impact**: Windows 환경에서 Adapter 사용 불가
- **Mitigation**:
  - WSL 사용 권장
  - node-gyp 설치 가이드 제공
  - Prebuilt 바이너리 사용 옵션
- **Alternative**: Windows에서는 Mock Adapter로 대체 (기능 제한)

### Risk 3: Codex API endpoint 변경
- **Impact**: CodexAdapter 프로토콜 불일치
- **Mitigation**:
  - Codex 공식 문서 참조 후 구현
  - Version check 로직 추가
  - Fallback 프로토콜 지원
- **Alternative**: Codex API 대신 CLI 사용

### Risk 4: 기존 테스트 호환성 문제
- **Impact**: Vitest 마이그레이션 시 테스트 실패
- **Mitigation**:
  - Jest → Vitest API 차이 확인
  - Setup 파일에서 polyfill 추가
  - 점진적 마이그레이션 (Mock 우선)
- **Alternative**: Jest 유지 (Vitest 도입 연기)

## Dependencies

### External Dependencies (설치 필요)
- `node-pty@^1.0.0` - PTY 프로세스 생성
- `vitest@^1.2.0` - 테스트 프레임워크
- `@vitest/coverage-v8@^1.2.0` - Coverage reporter

### System Requirements
- Claude Code CLI 설치 (claude-code-adapter)
- Codex CLI 설치 (codex-adapter)
- Node.js >= 18 (node-pty 요구사항)
- Windows: Visual Studio Build Tools (node-pty)

### Internal Dependencies
- `packages/core` - 타입 정의 (Terminal, Role)
- `packages/orchestrator` - 기존 구현 (TerminalPool, RoleManager)

### 확인 필요
- [ ] Claude Code CLI 최신 버전 설치 가능 여부
- [ ] Codex API endpoint 공식 문서 확인
- [ ] node-pty Windows 환경 테스트

## Checkpoints

- [x] Phase 1 complete: Provider Adapters 구현 및 통합
  - [x] ClaudeCodeAdapter 구현
  - [x] CodexAdapter 구현
  - [x] ProviderAdapterFactory 확장 (create, initialize)
  - [x] TerminalPool 통합 (Factory.initialize 호출)
  - [x] Type check pass

- [x] Phase 2 complete: 기본 Role 4종 추가
  - [x] planner.md 작성
  - [x] coder.md 작성
  - [x] tester.md 작성
  - [x] reviewer.md 작성
  - [x] RoleManager 다중 경로 지원 추가
  - [x] packages/roles/README.md 작성

- [x] Phase 3 complete: Vitest 설정
  - [x] vitest.config.ts 작성
  - [x] test/setup.ts 작성
  - [x] Test scripts 추가
  - [x] Vitest 의존성 설치

- [x] Phase 4 complete: Integration & Verification
  - [x] Type check passes
  - [x] Build succeeds
  - [x] All adapters implemented
  - [x] 4 basic roles + RoleManager multi-path working

## Open Questions

1. **Codex API 프로토콜**: JSON-based 프로토콜이 최신 버전과 호환되는지 확인 필요
   - 답변 대기: Codex 공식 문서 확인 후 결정

2. **Role 변수 기본값**: 기본 Role 4종의 variables에 default 값을 설정할지 여부
   - 제안: task는 required=true (default 없음), 나머지는 optional with default

3. **Vitest 마이그레이션 범위**: orchestrator 패키지만 적용할지, 전체 monorepo에 적용할지
   - 제안: orchestrator 우선 적용, 성공 시 core, desktop 순차 적용

4. **MockProviderAdapter 유지 여부**: 실제 Adapter 구현 후에도 Mock을 계속 사용할지
   - 답변: 유지 필요 (테스트용, NODE_ENV=test 시 자동 전환)

## References

### Phase 2 Split Documents
- `.claude/docs/tasks/phase-2-split/02-terminal-execution-contract.md` - Provider Adapter 상세 구현
- `.claude/docs/tasks/phase-2-split/04-role-system-design.md` - Role System 아키텍처
- `.claude/docs/tasks/phase-2-split/07-implementation-sequence.md` - 구현 시퀀스
- `.claude/docs/tasks/phase-2-split/09-testing-strategy.md` - 테스트 전략

### Implementation Status
- `.claude/docs/tasks/phase-2-implementation-status.md` - 현재 구현 상태 (65% 완료)

### Similar Features
- `packages/orchestrator/templates/roles/*.md` - 기존 Role 템플릿
- `packages/roles/generic-agent.md` - Fallback Role 예시
- `packages/orchestrator/src/terminal/provider-adapter.ts` - MockProviderAdapter 구현

### Project Rules
- `.claude/PROJECT.md` - 프로젝트 구조, 빌드 규칙
- `.claude/CLAUDE.md` - 글로벌 개발 가이드라인

---

**Implementation Ready**: Yes
**Estimated Effort**: 3-4 days (medium complexity)
**Priority**: P0 (blocking for Phase 2 completion)
