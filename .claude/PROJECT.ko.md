# PROJECT.md

## 프로젝트 개요

- **이름**: CodeCafe (code-cafe-manager)
- **버전**: 0.1.0
- **설명**: AI CLI 오케스트레이터 - 여러 AI CLI 인스턴스(바리스타)를 병렬로 관리하는 크로스플랫폼 오케스트레이터
- **스택**: TypeScript, Node.js (>=18), pnpm (>=8)
- **주요 언어**: TypeScript (ESM)
- **라이선스**: MIT

## 아키텍처 컨셉

CodeCafe는 "카페" 메타포를 사용하여 AI CLI 워크플로우를 관리합니다:

- **Manager**: CodeCafe Manager (Electron UI)
- **Barista**: 독립 실행 유닛 (CLI 엔진 1개)
- **Menu**: 워크플로우 템플릿 목록
- **Recipe**: YAML 워크플로우 정의
- **Order**: 레시피 실행 1회 인스턴스
- **Beans**: Provider (claude-code, codex 등)
- **Counter**: 실행 대상 프로젝트
- **Receipt**: 실행 결과 요약

## 디렉토리 구조

```
codecafe/
├── .claude/            # Claude Code 설정 및 스킬
├── .codex/             # Codex 설정
├── .gemini/            # Gemini 설정
├── .orch/              # 오케스트레이터 런타임 데이터 (gitignored)
│   ├── orders/             # 주문 실행 로그
│   ├── runs/               # 워크플로우 실행 데이터
│   └── skills/             # 스킬 정의 (JSON)
├── packages/
│   ├── core/           # 도메인 모델, 레시피 엔진, 타입
│   ├── cli/            # codecafe CLI 명령
│   ├── desktop/        # Electron UI (Manager)
│   │   ├── src/main/       # Electron 메인 프로세스
│   │   │   └── ipc/        # IPC 핸들러 (cafe, order, workflow, skill, role 등)
│   │   ├── src/preload/    # Preload 스크립트 (CommonJS)
│   │   └── src/renderer/   # React UI
│   ├── orchestrator/   # 통합 오케스트레이터 엔진
│   │   ├── src/            # 소스 코드
│   │   └── test/           # Vitest 테스트
│   ├── providers/
│   │   ├── common/         # 공급자 공용 인터페이스
│   │   ├── claude-code/    # Claude Code Provider (PTY)
│   │   └── codex/          # Codex Provider
│   ├── git-worktree/   # Git worktree 관리
│   └── schema/         # YAML/JSON 스키마 및 검증
├── agents/             # 에이전트 설정 (선택)
├── recipes/
│   └── house-blend/    # 기본 레시피 템플릿
└── docs/
    ├── old/            # 보관 문서
    ├── desktop-architecture.md
    ├── terminal-execution-flow.md
    └── IMPLEMENTATION_SUMMARY.md
```

## 핵심 규칙 및 규약

### 1. TypeScript & 모듈 시스템
- **모든 패키지는 ESM 모듈** (`"type": "module"`)
- **엄격한 타입 체크**: `tsconfig.base.json` 확장
  - Target: ES2022, Module: NodeNext, ModuleResolution: NodeNext
  - 컴포지트 프로젝트, 증분 컴파일
  - 선언 파일 및 소스 맵 활성화
- **워크스페이스 의존성**: `workspace:*` 프로토콜 사용
- **빌드**: `tsc -b` (컴포지트 프로젝트)

### 2. 코드 스타일
- **Prettier**: `.prettierrc` 준수
  - 2 스페이스, 작은따옴표, 100자 라인 폭
  - 세미콜론, ES5 후행 콤마
- **명명**: camelCase (함수/변수), PascalCase (클래스/타입), kebab-case (파일명)
- **비동기**: async/await 선호, Promise 체이닝 지양
- **린팅**: eslint는 devDependencies에 있으나 프로젝트 전체 설정 미완료

### 3. 도메인 설계
- **core 패키지**: 순수 도메인 로직, 최소 외부 의존성 (yaml, zod)
- **Provider 인터페이스**: 일관성을 위해 `BaristaProvider` 계약 준수
- **이벤트 기반**: Barista 및 Order 상태 변경 시 이벤트 발행
- **검증**: 런타임 타입 검증에 Zod 스키마 사용

### 4. 에러 처리
- **명시적 에러 타입**: `CafeError`, `ExecutionError`, `ProviderError` 등
- **로깅**: `LogManager`를 통한 JSON 로그 기록 (JSONL 형식)
- **상태 지속성**: `Storage` 클래스로 JSON 파일 관리
- **IPC 응답**: 모든 Electron IPC 핸들러는 구조화된 응답 반환

## 주요 패키지

### @codecafe/core
- **역할**: 도메인 모델, 레시피 엔진, 이벤트 시스템
- **주요 파일**:
  - `barista.ts`: Barista 클래스 (실행 유닛)
  - `recipe.ts`: Recipe 클래스 (YAML 파싱)
  - `order.ts`: Order 클래스 (실행 인스턴스)
  - `executor/`: 실행 엔진
  - `orchestrator.ts`: 통합 오케스트레이터
  - `storage.ts`: JSON 저장소
  - `log-manager.ts`: 로그 관리
- **의존성**: `yaml`, `zod`

### @codecafe/cli
- **역할**: `codecafe` CLI 명령
- **주요 명령**:
  - `init`: 환경 초기화
  - `run`: 레시피 실행
  - `doctor`: 환경 점검
  - `status`: 상태 조회
  - `ui`: Desktop UI 실행
- **의존성**: `commander`, `chalk`, `ora`, `inquirer`

### @codecafe/desktop
- **역할**: Electron 기반 Manager UI
- **주요 뷰**:
  - Dashboard: 전체 상태
  - New Order: 새 주문 생성
  - Order Detail: 상세 실행 상태
  - Baristas: 바리스타 목록
- **기술 스택**: Electron, React, TailwindCSS, Zustand, Framer Motion, webpack
- **IPC 아키텍처**: main ↔ renderer contextBridge 통신
  - `preload/index.cts`: 렌더러에 IPC API 노출 (CommonJS)
  - `main/ipc/*.ts`: IPC 핸들러 (cafe, barista, order, workflow, run, config, role, terminal, worktree, provider, skill)
  - Registry: `~/.codecafe/cafes.json`의 카페 메타데이터 관리

### @codecafe/orchestrator
- **역할**: 멀티 AI CLI 오케스트레이터 엔진
- **주요 기능**: 워크플로우 실행, 프롬프트 템플릿, 터미널 풀, UI (ink), 저장소
- **의존성**: ajv, handlebars, gray-matter, jsonpath-plus, chalk, ora, commander, node-pty
- **테스트**: vitest, v8 커버리지

### @codecafe/providers
- **common**: 공급자 공용 인터페이스 및 유틸리티
- **claude-code**: PTY 기반 Claude Code 공급자
- **codex**: Codex CLI 공급자

### @codecafe/schema
- **역할**: YAML/JSON 스키마 정의 및 zod 검증

### @codecafe/git-worktree
- **역할**: Git worktree 병렬 실행 관리

### agents/
- **역할**: 에이전트 역할 정의 (마크다운 파일)
  - `coder.md`: 구현 에이전트
  - `planner.md`: 계획 에이전트
  - `reviewer.md`: 리뷰 에이전트
  - `tester.md`: 테스트 에이전트
  - `generic-agent.md`: 일반 에이전트 템플릿

## 빌드 및 개발 명령

```bash
# 전체 빌드
pnpm build

# 개발 모드 (watch)
pnpm dev

# 타입 체크
pnpm typecheck

# 린트
pnpm lint

# 테스트
pnpm test

# 클린
pnpm clean
```

### 패키지별 빌드

```bash
# core 빌드
cd packages/core && pnpm build

# CLI 빌드 및 링크 (로컬 개발)
cd packages/cli && pnpm build && pnpm link --global

# desktop 빌드
cd packages/desktop && pnpm build

# Desktop 개발 서버
cd packages/desktop && pnpm dev
```

## 환경 변수

현재 프로젝트는 최소한의 환경 변수를 사용합니다.

- **desktop**: `dotenv` 사용 (`packages/desktop/src/main/index.ts`)
- **.env.example**: 없음 (TODO: 필요 시 추가)

환경 변수가 필요한 경우 다음 규칙을 따르십시오:
- `.env.example` 템플릿 제공
- `.gitignore`에 `.env` 등록
- 민감 정보 절대 커밋 금지

## IPC API (Desktop)

`window.codecafe`를 통해 노출되는 Electron IPC 채널:

### Cafe (저장소 레지스트리)
- `cafe:list` - 모든 카페 목록
- `cafe:get` - ID로 카페 조회
- `cafe:create` - 새 카페 등록
- `cafe:update` - 카페 메타데이터 수정
- `cafe:delete` - 카페 삭제
- `cafe:setLastAccessed` / `cafe:getLastAccessed` - 마지막 접근 추적

### Barista (실행 유닛)
- `barista:create` - 새 바리스타 생성
- `barista:getAll` - 모든 바리스타 목록
- `barista:event` - 바리스타 이벤트 구독

### Order (워크플로우 실행)
- `order:create` - 새 주문 생성
- `order:getAll` - 모든 주문 목록
- `order:get` - 주문 상세 조회
- `order:getLog` - 주문 로그 조회
- `order:cancel` - 주문 취소
- `order:event` / `order:assigned` / `order:completed` - 이벤트 구독

### Workflow
- `workflow:list` - 사용 가능한 워크플로우 목록
- `workflow:get` - 워크플로우 정의 조회
- `workflow:run` - 워크플로우 실행

### Run (워크플로우 실행 관리)
- `run:list` - 워크플로우 실행 목록
- `run:status` - 실행 상태 조회
- `run:resume` - 실행 재개
- `run:logs` - 실행 로그 조회

### Config
- `config:assignments:get` / `config:assignments:set` - 배정 설정
- `config:profiles:list` / `config:profiles:set` - 프로필 관리
- `config:roles:list` - 역할 목록

### Role
- `role:list` / `role:get` - 역할 정의
- `role:listDefault` / `role:listUser` - 타입별 필터
- `role:reload` - 역할 새로고침

### Terminal
- `terminal:init` - 터미널 초기화
- `terminal:poolStatus` - 터미널 풀 상태

### Worktree
- `worktree:list` - worktree 목록
- `worktree:exportPatch` - worktree 패치 내보내기
- `worktree:remove` - worktree 삭제
- `worktree:openFolder` - worktree 폴더 열기

### Provider
- `provider:getAvailable` - 사용 가능한 공급자 목록

### Skill
- `skill:list` - 모든 스킬 목록 (내장 + 사용자 생성)
- `skill:get` - ID로 단일 스킬 조회
- `skill:create` - 새 스킬 생성
- `skill:update` - 기존 스킬 수정
- `skill:delete` - 스킬 삭제
- `skill:duplicate` - 스킬 복제

## 데이터 저장소

- **레시피**: `recipes/` 디렉토리 (YAML)
  - `house-blend/`: 기본 레시피 템플릿
- **스킬**: `.orch/skills/` 디렉토리 (JSON, gitignored)
  - 내장 스킬은 첫 실행 시 자동 생성
  - 사용자 생성 스킬은 개별 `.json` 파일로 저장
- **실행 데이터**: `.orch/` 디렉토리 (JSON, gitignored)
  - `storage.json`: 주문 메타데이터
  - `orders/{orderId}/`: 개별 주문 로그 및 상태
  - `runs/`: 워크플로우 실행 데이터 (gitignored)
- **카페 레지스트리**: `~/.codecafe/cafes.json` (저장소 메타데이터)
- **로그**: JSON Lines 형식 (`.orch/orders/{orderId}/logs.jsonl`)

## 검증 및 테스트

- **타입 체크**: `pnpm typecheck` (전체 프로젝트)
  - Desktop: `tsc --noEmit && tsc -p tsconfig.renderer.json --noEmit`
- **테스트**: `pnpm test` (orchestrator 패키지의 vitest)
  - 테스트 위치: `src/**/*.test.ts`, `test/**/*.test.ts`
  - 커버리지: v8 공급자 (text, json, html 리포터)
  - 설정: `test/setup.ts`
- **린트**: `pnpm lint` (eslint는 devDeps에 있으나 프로젝트 전체 설정 미완료)

## 문서화

- `README.md`: 프로젝트 개요 및 사용법
- `docs/IMPLEMENTATION_SUMMARY.md`: 구현 요약
- `docs/desktop-architecture.md`: Electron desktop UI 아키텍처
- `docs/terminal-execution-flow.md`: 터미널 PTY 실행 플로우
- `docs/old/`: 보관 문서
  - `PRD.md`: 제품 요구사항 문서
  - `오케스트레이터-PRD.md`: 오케스트레이터 PRD (한국어)
- `agents/`: 에이전트 역할 정의 (coder, planner, reviewer, tester, generic-agent)

## 마일스톤 진행 상황

### M1 (✅ 완료)
- CLI 코어 (init, run, doctor, status, ui)
- Provider: claude-code (PTY 기반)
- Core 패키지 (도메인 모델, 레시피 엔진)
- Schema 패키지 (YAML 검증)
- Barista Pool 구현
- Orchestrator (통합 관리)
- 저장/관측 시스템 (JSON + 로그)
- Electron UI (Dashboard, New Order, Order Detail, Baristas)

### M2 (진행 중 - 부분 완료)
- [x] 워크플로우 엔진 (FSM 기반)
- [x] Git worktree 병렬 실행
- [x] 워크플로우 UI (실행/모니터링)
- [x] 스킬 시스템 (내장 + 사용자 정의)
- [ ] Codex Provider 연동
- [ ] DAG 시각화

### M3 (계획)
- Provider 플러그인 확장 (Gemini/Grok)
- API 모드
- 템플릿 레지스트리

## 주의사항

- **ESM 호환성**: 모든 import/export는 ESM 문법 사용
  - 예외: `preload/index.cts`는 CommonJS 사용 (Electron 요구사항)
- **nanoid ESM 이슈**: v5.0.0+는 동적 import 필요
- **경로 구분자**: 크로스플랫폼 호환성을 위해 `path.join()` 사용 (Windows/POSIX)
- **PTY 제한**: Windows에서 node-pty 빌드 이슈 가능 (WSL 권장)
- **Git 작업**: 카페 레지스트리는 저장소 메타데이터를 위해 `.git/config` 읽기
- **워크스페이스 프로토콜**: 패키지 간 의존성에 `workspace:*` 사용
- **타입 안전성**: Zod 스키마로 런타임 데이터 검증 (IPC 파라미터, YAML 레시피 등)

## TODO

- [ ] .env.example 템플릿 추가
- [ ] 통합 테스트 추가 (현재 orchestrator만 vitest 존재)
- [ ] CI/CD 파이프라인 구축
- [ ] ESLint 프로젝트 전체 설정 (현재 devDeps에만 존재)
- [ ] orchestrator 외 다른 패키지에도 테스트 커버리지 추가
- [ ] M2 기능 완료 (Codex Provider 연동, DAG 시각화)

## 내장 스킬

다음 내장 스킬이 `.orch/skills/`에 자동 생성됩니다:

| ID | 이름 | 카테고리 | 명령 |
|----|------|----------|---------|
| `classify-task` | 작업 분류 | 분석 | `/moonshot-classify-task` |
| `evaluate-complexity` | 복잡도 평가 | 분석 | `/moonshot-evaluate-complexity` |
| `detect-uncertainty` | 불확실성 감지 | 분석 | `/moonshot-detect-uncertainty` |
| `decide-sequence` | 시퀀스 결정 | 계획 | `/moonshot-decide-sequence` |
| `pre-flight-check` | 사전 점검 | 계획 | `/pre-flight-check` |
| `requirements-analyzer` | 요구사항 분석 | 계획 | `requirements-analyzer` |
| `context-builder` | 컨텍스트 빌더 | 계획 | `context-builder` |
| `implementation-runner` | 구현 실행자 | 구현 | `implementation-runner` |
| `codex-review-code` | Codex 코드 리뷰 | 검증 | `codex-review-code` |
| `codex-test-integration` | Codex 통합 테스트 | 검증 | `codex-test-integration` |

내장 스킬은 직접 수정/삭제할 수 없습니다. 먼저 복제한 후 사용하십시오.
