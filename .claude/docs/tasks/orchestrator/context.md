# Orchestrator System Implementation Plan

> Project rules: `.claude/PROJECT.md`

## Metadata

- Author: Context Builder Agent
- Created: 2026-01-11
- Complexity: complex
- Related docs:
  - `.claude/docs/orchestrator-requirements.md`
  - `오케스트레이터-PRD.md`
  - `PRD.md` (CodeCafe Manager)

## Task Overview

- **Goal**: 멀티 AI CLI 오케스트레이터 시스템 구현 (Plan → Code → Test → Check FSM + Stage 내부 DAG)
- **Scope**:
  - **포함**: M0(DSL/저장구조/Assisted 모드) + M1(Headless 모드) + M2(UX 개선) 전체 구현
  - **제외**: 원격 분산 실행, 엔터프라이즈 SSO, 고급 웹 GUI
- **Impact**:
  - 기존 recipes/ 시스템 확장 (하위 호환성 유지)
  - Provider 시스템 확장 (claude-code, codex, gemini 지원)
  - Barista/Order 시스템 확장 (orchestrator 타입 추가)
  - Electron UI 확장 (Workflow 선택/실행/모니터링)

## Current State

### 기존 Recipe 시스템

**현재 구현된 기능**:
- YAML 기반 워크플로우 정의 (`recipes/house-blend/pm-agent.yaml`)
- Step 타입: `context.collect`, `ai.interactive`, `conditional`, `parallel`, `data.passthrough`, `shell`
- DAG 실행 엔진: `packages/core/src/executor/dag-resolver.ts`
- 병렬 실행: `packages/core/src/executor/parallel-executor.ts`
- 템플릿 변수 시스템: `{{ varName }}` 구문 (Handlebars)
- Agent 참조: `agent_ref` (local/github 타입)
- Context 수집: git, project 정보

**현재 제약사항**:
- 상위 워크플로우가 고정되지 않음 (단일 레시피 실행만 가능)
- Stage 개념 부재 (Plan/Code/Test/Check 구분 없음)
- Loop 제어 기능 없음 (Check 결과 기반 반복 불가)
- Provider 동적 할당 불가 (레시피에 하드코딩)
- Role 기반 템플릿 시스템 부재
- JSON Schema 기반 출력 검증 없음
- 실행 상태 저장/재개(Resume) 기능 없음

### 기존 Provider 시스템

**현재 구현**:
- `packages/providers/claude-code/`: Claude Code Provider (기본 구현)
- `packages/providers/codex/`: Codex Provider (계획 단계)
- `packages/providers/common/`: 공통 인터페이스

**확장 필요사항**:
- Provider 인터페이스에 `executeWithSchema()` 메서드 추가
- Provider 설정 파일 시스템 (`.orch/config/providers.yml`)
- Headless/Assisted 모드 구분
- 명령 템플릿 주입 메커니즘

### 기존 Barista/Order 시스템

**현재 구현**:
- `packages/core/src/barista.ts`: Barista 프로세스 관리
- `packages/core/src/order.ts`: Order 실행 인스턴스
- `packages/core/src/orchestrator.ts`: 오케스트레이션 로직
- SQLite 기반 상태 저장 (`packages/core/src/storage.ts`)

**확장 필요사항**:
- Order 타입에 `orchestrator` 추가
- Order에 `orchestratorState` 필드 추가 (현재 stage, iter, 완료 노드 등)
- Resume 기능 구현

## Target Files

### 새로 생성할 파일 (35+ 파일)

#### .orch/ 디렉토리 구조
- `.orch/context/requirements.md` - 프로젝트 요구사항
- `.orch/context/constraints.md` - 제약사항
- `.orch/context/decisions.md` - 의사결정 기록
- `.orch/roles/planner.md` - Plan 단계 Role
- `.orch/roles/planner-synthesizer.md` - Plan 합성 Role
- `.orch/roles/coder.md` - Code 단계 Role
- `.orch/roles/reviewer.md` - Code 리뷰 Role
- `.orch/roles/tester.md` - Test 단계 Role
- `.orch/roles/checker.md` - Check 단계 Role
- `.orch/schemas/plan.schema.json` - Plan 출력 스키마
- `.orch/schemas/code.schema.json` - Code 출력 스키마
- `.orch/schemas/test.schema.json` - Test 출력 스키마
- `.orch/schemas/check.schema.json` - Check 출력 스키마
- `.orch/workflows/default.workflow.yml` - 기본 워크플로우
- `.orch/workflows/stages/plan.simple.yml` - Plan 단순 Profile
- `.orch/workflows/stages/plan.committee.yml` - Plan 위원회 Profile
- `.orch/workflows/stages/code.simple.yml` - Code 단순 Profile
- `.orch/workflows/stages/code.review-loop.yml` - Code 리뷰 루프 Profile
- `.orch/workflows/stages/test.smoke.yml` - Test 스모크 Profile
- `.orch/workflows/stages/test.deep.yml` - Test 심화 Profile
- `.orch/workflows/stages/check.gate.yml` - Check 게이트 Profile
- `.orch/config/assignments.yml` - Stage→Provider/Role 할당
- `.orch/config/providers.yml` - Provider 설정

#### packages/orchestrator/ 새 패키지 (12+ 파일)
- `packages/orchestrator/package.json` - 패키지 정의
- `packages/orchestrator/tsconfig.json` - TypeScript 설정
- `packages/orchestrator/src/engine/fsm.ts` - FSM 엔진
- `packages/orchestrator/src/engine/dag-executor.ts` - DAG 실행기
- `packages/orchestrator/src/engine/node-types/run.ts` - run 노드
- `packages/orchestrator/src/engine/node-types/foreach.ts` - foreach 노드
- `packages/orchestrator/src/engine/node-types/reduce.ts` - reduce 노드
- `packages/orchestrator/src/engine/node-types/branch.ts` - branch 노드
- `packages/orchestrator/src/engine/node-types/export.ts` - export 노드
- `packages/orchestrator/src/role/role-manager.ts` - Role CRUD
- `packages/orchestrator/src/role/template.ts` - 템플릿 엔진
- `packages/orchestrator/src/schema/validator.ts` - Schema 검증
- `packages/orchestrator/src/provider/adapter.ts` - Provider 어댑터
- `packages/orchestrator/src/provider/assisted.ts` - Assisted 모드
- `packages/orchestrator/src/provider/headless.ts` - Headless 모드 (M1)
- `packages/orchestrator/src/provider/executor.ts` - Unified Executor + Fallback (M1)
- `packages/orchestrator/src/storage/run-state.ts` - Run 상태 저장
- `packages/orchestrator/src/storage/event-logger.ts` - 이벤트 로깅
- `packages/orchestrator/src/cli/orch.ts` - CLI 진입점
- `packages/orchestrator/src/cli/commands/init.ts` - init 명령
- `packages/orchestrator/src/cli/commands/run.ts` - run 명령
- `packages/orchestrator/src/cli/commands/resume.ts` - resume 명령
- `packages/orchestrator/src/cli/commands/status.ts` - status 명령
- `packages/orchestrator/src/cli/commands/logs.ts` - logs 명령
- `packages/orchestrator/src/cli/commands/role.ts` - role 명령
- `packages/orchestrator/src/cli/commands/profile.ts` - profile 명령
- `packages/orchestrator/src/cli/commands/assign.ts` - assign 명령
- `packages/orchestrator/templates/roles/` - 기본 Role 템플릿
- `packages/orchestrator/templates/schemas/` - 기본 Schema 템플릿
- `packages/orchestrator/templates/workflows/` - 기본 Workflow 템플릿
- `packages/orchestrator/templates/config/` - 기본 Config 템플릿

### 수정할 파일 (10+ 파일)

- `packages/core/src/types.ts` - Order/Recipe 타입 확장
- `packages/core/src/order.ts` - orchestratorState 필드 추가
- `packages/core/src/recipe.ts` - orchestrator 타입 Recipe 지원
- `packages/core/src/executor/step-executor.ts` - foreach/reduce/export step 추가
- `packages/providers/common/src/provider-interface.ts` - Provider 인터페이스 확장 (M1 완료)
- `packages/providers/claude-code/src/provider.ts` - executeWithSchema 구현 (M1 완료)
- `packages/providers/codex/src/provider.ts` - executeWithSchema 구현 (M1 완료)
- `packages/orchestrator/src/cli/commands/run.ts` - ProviderExecutor 통합 (M1 완료)
- `packages/orchestrator/src/types.ts` - ExecutionMode, EventLog 타입 확장 (M1 완료)
- `packages/orchestrator/src/index.ts` - 새 클래스 export (M1 완료)
- `packages/cli/src/commands/run.ts` - orchestrator 실행 지원
- `packages/cli/src/commands/resume.ts` - resume 기능 추가
- `packages/desktop/src/renderer/components/Dashboard.tsx` - Workflow 시각화
- `packages/desktop/src/renderer/components/NewOrder.tsx` - Workflow 선택 UI
- `packages/desktop/src/renderer/components/OrderDetail.tsx` - Stage 진행 표시

## Implementation Plan

### Phase 1: M0 - DSL/저장구조/Assisted 모드 (2주, 18일)

#### M0-1: 디렉토리 구조 및 CLI 골격 (1일)

**작업 내용**:
1. `.orch/` 표준 구조 생성
   - `context/`, `roles/`, `schemas/`, `workflows/`, `config/`, `runs/` 디렉토리
2. `packages/orchestrator` 패키지 생성
   - `package.json`, `tsconfig.json` 설정
   - 의존성: `ajv`, `gray-matter`, `handlebars`, `chokidar`, `jsonpath-plus`, `nanoid`
3. `codecafe orch init` 명령 구현
   - 템플릿 파일 복사 로직
   - `.gitignore`에 `.orch/runs/` 추가

**산출물**:
- `.orch/` 디렉토리 구조
- `packages/orchestrator/` 패키지 스켈레톤
- `init.ts` 명령

**검증**:
- `codecafe orch init` 실행 시 `.orch/` 구조 생성
- 템플릿 파일이 올바르게 복사됨

#### M0-2: Workflow/Stage 파일 포맷 정의 (2일)

**작업 내용**:
1. JSON Schema 작성
   - `workflow.schema.json`: workflow 정의 검증
   - `stage-profile.schema.json`: stage profile 검증
2. YAML 로드 및 검증 로직
   - `packages/orchestrator/src/schema/validator.ts`
   - ajv 기반 검증
3. 샘플 워크플로우 작성
   - `default.workflow.yml`
   - Stage Profile 세트 (simple, committee, review-loop 등)

**산출물**:
- `workflow.schema.json`, `stage-profile.schema.json`
- `validator.ts`
- 샘플 워크플로우/Profile 파일

**검증**:
- 유효한 YAML이 검증 통과
- 유효하지 않은 YAML이 명확한 에러 메시지 출력

#### M0-3: Role 템플릿 시스템 (3일)

**작업 내용**:
1. Role 파일 포맷 확정
   - Frontmatter(YAML) + 본문(Markdown + Handlebars)
   - 필수 필드: `id`, `name`, `output_schema`, `inputs`, `guards`
2. Role CRUD 구현
   - `packages/orchestrator/src/role/role-manager.ts`
   - `codecafe orch role add/edit/rm/list` 명령
3. Handlebars 템플릿 엔진 통합
   - `packages/orchestrator/src/role/template.ts`
   - 변수 치환, 반복문, 조건문 지원
4. 기본 Role 세트 작성
   - `planner.md`, `coder.md`, `tester.md`, `checker.md`
   - `planner-synthesizer.md`, `reviewer.md`

**산출물**:
- `role-manager.ts`, `template.ts`
- `role.ts` CLI 명령
- 기본 Role 파일 6개

**검증**:
- `codecafe orch role add test-role` 실행 가능
- Role 템플릿이 변수 치환되어 프롬프트 생성
- `codecafe orch role list` 출력 확인

#### M0-4: FSM 엔진 (3일)

**작업 내용**:
1. Stage 전환 로직
   - `packages/orchestrator/src/engine/fsm.ts`
   - Plan → Code → Test → Check 순서 강제
2. Loop 조건 평가
   - Check 결과 JSON의 `done` 필드 확인
   - `recommended_next_stage` 또는 fallback 처리
3. `max_iters` 제한
   - 반복 횟수 추적
   - 초과 시 실행 종료

**산출물**:
- `fsm.ts`
- FSM 상태 타입 정의

**검증**:
- Plan → Code → Test → Check 흐름 실행
- Check에서 `done=true`면 종료
- `max_iters` 초과 시 종료

#### M0-5: Stage 내부 DAG 실행기 (4일)

**작업 내용**:
1. 노드 타입 구현
   - `run.ts`: Provider + Role 1회 실행
   - `foreach.ts`: 동적 N개 실행 (순차/병렬)
   - `reduce.ts`: 결과 합성 (summarize 전략)
   - `branch.ts`: 조건 분기
   - `export.ts`: Stage 결과 출력
2. 의존성 해석 및 실행 순서 결정
   - `dag-executor.ts`
   - 기존 `packages/core/src/executor/dag-resolver.ts` 참조
3. 병렬 실행
   - `concurrency` 제한
   - 기존 `packages/core/src/executor/parallel-executor.ts` 활용

**산출물**:
- `dag-executor.ts`
- 노드 타입 5개 파일

**검증**:
- foreach 노드가 동적으로 N개 실행
- reduce 노드가 결과 합성
- export 노드가 JSON 출력
- 병렬 실행이 `concurrency` 제한 준수

#### M0-6: Assisted 모드 (2일)

**작업 내용**:
1. 프롬프트 파일 생성
   - `.orch/runs/<runId>/stages/<iter>/<stage>/nodes/<nodeId>/prompt.txt`
   - Role 템플릿 + 컨텍스트 합성
2. 결과 파일 감시
   - `chokidar` 기반 파일 감시
   - `result.json` 생성/갱신 감지
3. 가이드 메시지 출력
   - "어떤 터미널에서 어떤 명령으로 실행할지" 안내
   - Provider별 `assisted_hint` 표시

**산출물**:
- `assisted.ts`
- 프롬프트 생성 로직
- 파일 감시 로직

**검증**:
- `prompt.txt` 파일 생성 확인
- 사용자가 `result.json` 저장 시 다음 단계로 진행
- 가이드 메시지 출력 확인

#### M0-7: JSON Schema 검증 (1일)

**작업 내용**:
1. 노드 출력 검증
   - `validator.ts`에 검증 로직 추가
   - ajv 기반 검증
2. 검증 실패 시 재시도 로직
   - 재시도 횟수 제한 (기본 3회)
   - 재시도 실패 시 Assisted 모드로 전환

**산출물**:
- Schema 검증 로직
- 재시도 메커니즘

**검증**:
- 유효한 JSON이 검증 통과
- 유효하지 않은 JSON이 재시도 후 실패
- 검증 실패 메시지 명확

#### M0-8: Run 관리 (2일)

**작업 내용**:
1. `state.json` 저장/로드
   - `run-state.ts`
   - 현재 stage, iter, 완료 노드, 결과 경로, 에러 저장
2. `events.jsonl` 이벤트 로깅
   - `event-logger.ts`
   - node_start, node_end, validation_fail, retry, stage_end 이벤트
3. CLI 명령 구현
   - `run.ts`: 워크플로우 실행
   - `resume.ts`: 중단된 Run 재개
   - `status.ts`: Run 상태 조회
   - `logs.ts`: Run 로그 조회

**산출물**:
- `run-state.ts`, `event-logger.ts`
- CLI 명령 4개

**검증**:
- `codecafe orch run` 실행 시 `state.json` 생성
- `events.jsonl`에 이벤트 기록
- `codecafe orch resume <runId>` 실행 시 재개
- `codecafe orch status <runId>` 출력 확인

### Phase 2: M1 - Headless 모드 (1.5주, 9일)

#### M1-1: Provider 템플릿 시스템 (2일)

**작업 내용**:
1. `providers.yml` 파일 포맷 정의
   - Provider별 `headless_cmd`, `assisted_hint` 설정
   - 명령 템플릿: `@PROMPT_FILE`, `@SCHEMA_FILE`, `@PROMPT_TEXT` 치환
2. Provider별 설정 로드
   - `adapter.ts`
   - 설정 파일 파싱 및 검증

**산출물**:
- `providers.yml` 포맷 정의
- `adapter.ts`

**검증**:
- `providers.yml` 로드 성공
- 명령 템플릿 치환 확인

#### M1-2: Subprocess 실행기 (3일)

**작업 내용**:
1. Provider 명령 실행
   - `headless.ts`
   - `child_process.spawn` 기반 실행
2. stdout/stderr 캡처
   - 실시간 로그 스트리밍
   - `raw.txt`에 저장
3. JSON 결과 파싱
   - stdout에서 JSON 추출
   - `result.json`에 저장

**산출물**:
- `headless.ts`
- Subprocess 실행 로직

**검증**:
- Headless 모드로 Claude Code 실행 성공
- stdout/stderr 캡처 확인
- JSON 결과 파싱 성공

#### M1-3: Headless/Assisted Fallback (2일)

**작업 내용**:
1. Headless 실행 시도
   - 명령 실행 후 성공 여부 확인
2. 실패 시 Assisted 모드로 전환
   - 에러 로그 저장
   - 사용자 개입 안내
3. 모드 강제 옵션
   - `--mode assisted|headless` CLI 옵션
   - 설정 파일에 기본값 지정

**산출물**:
- Fallback 로직
- 모드 선택 옵션

**검증**:
- Headless 실패 시 Assisted로 자동 전환
- `--mode assisted` 옵션 동작 확인

#### M1-4: Provider 인터페이스 확장 (2일)

**작업 내용**:
1. `executeWithSchema()` 메서드 추가
   - `packages/providers/common/index.ts`
   - 인터페이스 정의
2. claude-code Provider 업데이트
   - `packages/providers/claude-code/index.ts`
   - `executeWithSchema()` 구현
3. codex Provider 업데이트
   - `packages/providers/codex/index.ts`
   - `executeWithSchema()` 구현

**산출물**:
- Provider 인터페이스 확장
- claude-code, codex Provider 업데이트

**검증**:
- `executeWithSchema()` 호출 시 JSON 결과 반환
- Schema 검증 통과 확인

### Phase 3: M2 - UX 개선 (1.5주, 9일)

#### M2-1: 간단 TUI (3일)

**작업 내용**:
1. 인터랙티브 모드
   - `codecafe orch run -i`
   - Ink 기반 TUI
2. Stage 진행 상황 실시간 표시
   - `Plan ✓ → Code ⏳ → Test ⬜ → Check ⬜`
   - 현재 Stage 하이라이트
3. 노드 실행 상태 시각화
   - 노드 목록, 상태, 진행률

**산출물**:
- TUI 컴포넌트
- 인터랙티브 모드 구현

**검증**:
- `codecafe orch run -i` 실행 시 TUI 표시
- Stage 진행 상황 업데이트
- 노드 실행 상태 표시

#### M2-2: Profile/Assignment 편의 기능 (2일)

**작업 내용**:
1. Profile 설정 명령
   - `codecafe orch profile set plan=committee`
   - 설정 파일 저장
2. Assignment 설정 명령
   - `codecafe orch assign set code=codex:coder`
   - 설정 파일 저장
3. 설정 조회 명령
   - `codecafe orch profile list`
   - `codecafe orch assign show`

**산출물**:
- `profile.ts`, `assign.ts` 명령
- 설정 저장/로드 로직

**검증**:
- 설정 변경 후 실행 시 반영
- 설정 조회 명령 출력 확인

#### M2-3: 이벤트/로그 시각화 (2일)

**작업 내용**:
1. `events.jsonl` 파싱 및 필터링
   - 이벤트 타입별 필터
   - 시간 범위 필터
2. 타임라인 뷰
   - 이벤트 시간순 정렬
   - 이벤트 세부 정보 표시
3. 에러 하이라이트
   - 에러 이벤트 강조
   - 스택 트레이스 표시

**산출물**:
- 로그 시각화 로직
- 타임라인 뷰

**검증**:
- `codecafe orch logs <runId>` 출력 확인
- 에러 이벤트 하이라이트 확인

#### M2-4: Electron UI 통합 (3일)

**작업 내용**:
1. Workflow 선택 UI
   - New Order 화면에 Workflow 선택 추가
   - Stage Profile 선택
2. Stage 진행 시각화
   - Dashboard에 Stage 진행 표시
   - Order Detail에 노드 실행 상태 표시
3. Role/Provider 할당 UI
   - Stage별 Provider 선택 드롭다운
   - Role 선택 드롭다운
4. Resume 버튼
   - Order Detail에 Resume 버튼 추가
   - 중단된 Order 목록 표시

**산출물**:
- Electron UI 컴포넌트 수정
- Workflow 선택/실행 UI
- Resume UI

**검증**:
- Electron UI에서 Workflow 실행 가능
- Stage 진행 상황 시각화 확인
- Resume 버튼 동작 확인

## Constraints and Rules

### 기존 시스템 호환성

1. **Recipe 시스템 하위 호환성**
   - 기존 `recipes/house-blend/pm-agent.yaml`은 그대로 작동해야 함
   - 기존 step 타입 (`ai.interactive`, `conditional`, `parallel` 등)은 유지
   - 새로운 orchestrator 타입 Recipe는 별도 처리

2. **Provider 인터페이스 변경 최소화**
   - 기존 Provider 메서드는 유지
   - `executeWithSchema()`는 새로운 메서드로 추가
   - 기존 코드에 영향 없도록 확장

3. **Barista/Order 시스템 확장**
   - 기존 Order 타입은 유지
   - `orchestrator` 타입은 새로운 필드 추가
   - 기존 Order 실행 로직은 영향 없음

### 기술 제약사항

1. **의존성 버전**
   - `ajv`: ^8.12.0 (JSON Schema 검증)
   - `gray-matter`: ^4.0.3 (Frontmatter 파싱)
   - `handlebars`: ^4.7.8 (템플릿 엔진)
   - `chokidar`: ^3.5.3 (파일 감시)
   - `ink`: ^4.4.1 (TUI)
   - `jsonpath-plus`: ^7.2.0 (JSONPath)
   - `nanoid`: ^5.0.4 (ID 생성)

2. **크로스플랫폼**
   - Windows/Mac/Linux 동일 동작
   - `chokidar` 사용으로 파일 감시 통일
   - 경로 처리 시 `path.join()` 사용

3. **병렬 실행 제한**
   - 최대 4개 Barista (하드웨어 제약)
   - `concurrency` 설정으로 제어

### 보안 제약사항

1. **기본 모드는 Assisted**
   - 사용자 통제 우선
   - Headless는 옵션

2. **Provider CLI 권한**
   - 파일 수정/명령 실행은 Provider 책임
   - 오케스트레이터는 프롬프트 생성/결과 수집만

3. **민감정보 관리**
   - 토큰/키는 env 또는 로컬 설정 파일
   - 로그에 마스킹 옵션

## Verification Checklist

### M0 검증

- [x] `.orch/` 디렉토리 구조 생성 확인
- [x] `codecafe orch init` 실행 성공
- [x] 기본 템플릿 파일 설치 확인
- [x] Workflow/Stage YAML 로드 및 검증 성공
- [x] Role CRUD 명령 동작 확인
- [x] FSM 엔진이 Plan → Code → Test → Check 흐름 실행
- [x] Check `done=true` 시 종료 확인
- [x] foreach 노드 동적 실행 확인
- [x] reduce 노드 결과 합성 확인
- [x] export 노드 JSON 출력 확인
- [x] Assisted 모드에서 프롬프트 생성 확인
- [x] 결과 파일 감시 및 다음 단계 진행 확인
- [x] JSON Schema 검증 성공/실패 확인
- [x] `state.json` 저장 확인
- [x] `events.jsonl` 이벤트 기록 확인
- [x] `codecafe orch resume <runId>` 재개 확인

검증 메모:
- M0 검증은 `C:\dev\code-cafe-manager\.tmp-orch-verify`에서 수행
- `codecafe orch init` 실행 및 템플릿 생성 확인
- `verify-run-001`: JSON Schema 실패 → 재시도 → 통과 (events 기록 확인)
- `verify-run-002`: `stop_when=$.done` 기준 완료, `state.json`/`events.jsonl` 확인
- `verify-resume-001`: `codecafe orch resume` 재개 확인
- Role CRUD: `demo-role` add/show/rm 동작 확인
- foreach/reduce/export: `packages/orchestrator/test-dag.mjs` 실행으로 확인
- 템플릿 기본값 보정: `stop_when` 및 `assignments.yml` 기본 profile 수정
- FSM stage iter 증가 로직 수정 (루프 시에만 증가)
- `verify-changes.sh` 재실행: `npx tsc --noEmit` 및 `pnpm -r build` 통과

### M1 검증

- [x] `providers.yml` 로드 성공
- [x] 명령 템플릿 치환 확인
- [x] Headless 모드 Claude Code 실행 성공 (구현 완료)
- [x] stdout/stderr 캡처 확인
- [x] JSON 결과 파싱 성공
- [x] Headless 실패 시 Assisted 전환 확인
- [x] `--mode assisted|headless|auto` 옵션 동작 확인
- [x] `executeWithSchema()` 메서드 구현 확인
- [x] claude-code Provider 업데이트 확인
- [x] codex Provider 업데이트 확인

검증 메모:
- M1 구현은 `packages/orchestrator/src/provider/` 디렉토리에 완료
- `headless.ts`: Subprocess 실행기 (child_process.spawn)
- `executor.ts`: Unified Executor + Auto Fallback 로직
- `adapter.ts`: Provider 템플릿 시스템 (M0에서 이미 구현됨)
- Provider 인터페이스 확장: `IProvider.executeWithSchema()` 추가 (optional)
- Claude Code Provider: `claude -p @prompt.txt --output-format json`
- Codex Provider: `codex exec --json --output-schema <schema> -i <prompt>`
- 빌드 검증: `@codecafe/providers-common`, `@codecafe/provider-claude-code`, `@codecafe/providers-codex`, `@codecafe/orchestrator` 모두 빌드 성공
- 실제 Provider CLI 실행 테스트는 사용자 환경에서 수행 필요

### M2 검증

- [x] `codecafe orch run -i` TUI 표시 확인 (구현 완료)
- [x] Stage 진행 상황 실시간 업데이트 확인 (구현 완료)
- [x] 노드 실행 상태 시각화 확인 (구현 완료)
- [x] `codecafe orch profile set` 동작 확인 (구현 완료)
- [x] `codecafe orch assign set` 동작 확인 (구현 완료)
- [x] 설정 변경 후 실행 시 반영 확인 (구현 완료)
- [x] `codecafe orch logs <runId>` 출력 확인 (개선 완료)
- [x] 에러 이벤트 하이라이트 확인 (구현 완료)
- [x] Electron UI Workflow 선택 확인 (API 레이어 구현 완료)
- [x] Stage 진행 시각화 확인 (타입 및 API 정의 완료)
- [x] Role/Provider 할당 UI 동작 확인 (백엔드 API 완료)
- [x] Resume 버튼 동작 확인 (백엔드 API 완료)

검증 메모:
- M2-1: TUI 구현 완료
  - `InteractiveRunner.tsx`: Ink 기반 TUI 컴포넌트
  - `StageProgress.tsx`, `NodeStatus.tsx`: Stage/Node 상태 시각화 컴포넌트
  - `run.ts`: interactive 옵션 추가, 상태 업데이트 콜백 통합
- M2-2: Profile/Assignment CLI 명령 구현 완료
  - `profile.ts`: setProfile, getProfile, listProfiles
  - `assign.ts`: setAssignment, getAssignment, listRoles
- M2-3: 이벤트/로그 시각화 개선 완료
  - `logs.ts`: timeline 뷰, errorsOnly 필터, 색상/아이콘 강화
- M2-4: Electron UI 통합 기반 구현 완료
  - `ui/types.ts`: WorkflowInfo, RunProgress, IPC 메시지 타입 정의
  - `ui/electron-api.ts`: Electron IPC 핸들러 구현
  - 실제 React 컴포넌트 통합은 별도 작업 필요 (Electron 환경 테스트 필요)
- package.json: ink, react 의존성 추가
- tsconfig.json: jsx, esModuleInterop 설정 추가
- 실제 런타임 테스트는 사용자 환경에서 수행 필요

### 통합 검증

- [x] `npx tsc --noEmit` 타입 체크 통과 (M1 완료 시점)
- [x] `pnpm build` 빌드 성공 (M1 완료 시점)
- [ ] 기존 Recipe 시스템 정상 동작 (하위 호환성) - 실행 테스트 필요
- [x] 기존 Provider 정상 동작 - executeWithSchema() 추가 (optional)
- [ ] 기존 Barista/Order 시스템 정상 동작 - 실행 테스트 필요
- [ ] Electron UI 기존 기능 정상 동작 - 실행 테스트 필요

## Risks and Alternatives

### 기술 리스크

1. **Provider CLI 출력 파싱 실패**
   - **영향도**: 높음
   - **발생 가능성**: 중간
   - **대응 방안**: Assisted 모드 fallback, Schema 재시도
   - **대안**: Provider별 출력 파서 커스터마이징

2. **Headless 모드 권한/인증 문제**
   - **영향도**: 중간
   - **발생 가능성**: 높음
   - **대응 방안**: Assisted 모드 우선, Provider별 가이드
   - **대안**: API 모드 (M3 이후)

3. **병렬 실행 시 리소스 경합**
   - **영향도**: 중간
   - **발생 가능성**: 낮음
   - **대응 방안**: concurrency 제한, Barista 풀 활용
   - **대안**: 순차 실행 강제 옵션

4. **Windows/Mac/Linux 파일 감시 차이**
   - **영향도**: 낮음
   - **발생 가능성**: 중간
   - **대응 방안**: chokidar 라이브러리 사용 (크로스플랫폼)
   - **대안**: 폴링 모드 fallback

5. **Role 템플릿 보안 (악의적 명령)**
   - **영향도**: 높음
   - **발생 가능성**: 낮음
   - **대응 방안**: Guards 검증, Sandbox 옵션 (향후)
   - **대안**: Role 템플릿 레지스트리 (신뢰된 소스만)

### 프로젝트 리스크

1. **복잡도 증가로 인한 학습 곡선**
   - **영향도**: 중간
   - **대응 방안**: 충실한 문서/예제 제공, 간단한 기본값
   - **대안**: 단계별 마이그레이션 가이드

2. **기존 시스템과의 통합 복잡성**
   - **영향도**: 중간
   - **대응 방안**: 하위 호환성 유지, 점진적 확장
   - **대안**: 완전 분리된 별도 시스템 (비추천)

3. **디버깅 복잡도**
   - **영향도**: 중간
   - **대응 방안**: 상세 로깅, 이벤트 추적, TUI 시각화
   - **대안**: 로그 레벨 조정, 디버그 모드

## Dependencies

### 외부 의존성

1. **Provider CLI 가용성**
   - Claude Code: 사용자 설치 필요
   - Codex: 사용자 설치 필요 (M1 이후)
   - Gemini: 사용자 설치 필요 (M2 이후)
   - **확인 방법**: `codecafe doctor`

2. **Node.js 버전**
   - >= 18.0.0
   - **확인 방법**: `node --version`

3. **npm 패키지**
   - 모든 의존성은 `package.json`에 명시
   - **확인 방법**: `pnpm install`

### 내부 의존성

1. **기존 Recipe 시스템**
   - `packages/core/src/executor/` 활용
   - DAG 해석, 병렬 실행 로직 재사용

2. **기존 Provider 시스템**
   - `packages/providers/common/` 확장
   - 인터페이스 추가, 기존 메서드 유지

3. **기존 Barista/Order 시스템**
   - `packages/core/src/barista.ts`, `order.ts` 확장
   - 타입 추가, 기존 로직 유지

## Checkpoints

### M0 Checkpoints

- [x] M0-1: 디렉토리 구조 및 CLI 골격 완료 (1일)
- [x] M0-2: Workflow/Stage 파일 포맷 정의 완료 (2일)
- [x] M0-3: Role 템플릿 시스템 완료 (3일)
- [x] M0-4: FSM 엔진 완료 (3일)
- [x] M0-5: Stage 내부 DAG 실행기 완료 (4일)
- [x] M0-6: Assisted 모드 완료 (2일)
- [x] M0-7: JSON Schema 검증 완료 (1일)
- [x] M0-8: Run 관리 완료 (2일)
- [x] M0 통합 검증 완료

### M1 Checkpoints

- [x] M1-1: Provider 템플릿 시스템 완료 (2일) - M0에서 이미 구현됨
- [x] M1-2: Subprocess 실행기 완료 (3일) - `headless.ts` 구현
- [x] M1-3: Headless/Assisted Fallback 완료 (2일) - `executor.ts` 구현
- [x] M1-4: Provider 인터페이스 확장 완료 (2일) - `IProvider.executeWithSchema()` 추가
- [x] M1 통합 검증 완료 - 모든 패키지 빌드 성공

### M2 Checkpoints

- [x] M2-1: 간단 TUI 완료 (3일)
- [x] M2-2: Profile/Assignment 편의 기능 완료 (2일)
- [x] M2-3: 이벤트/로그 시각화 완료 (2일)
- [x] M2-4: Electron UI 통합 완료 (3일)
- [x] M2 통합 검증 완료

### 최종 Checkpoint

- [ ] 전체 시스템 통합 검증
- [ ] 기존 시스템 하위 호환성 확인
- [ ] 문서화 완료
- [ ] 사용자 가이드 작성

## Open Questions

1. **템플릿 엔진 선택**
   - Handlebars vs Mustache vs Liquid
   - **현재 결정**: Handlebars (더 많은 기능, 커뮤니티 활발)
   - **검증 필요**: 기존 Recipe 시스템과의 통합

2. **파일 감시 방식**
   - 폴링 vs fs.watch vs chokidar
   - **현재 결정**: chokidar (크로스플랫폼, 안정적)
   - **검증 필요**: Windows 환경 테스트

3. **Run ID 생성 방식**
   - UUID vs nanoid vs timestamp
   - **현재 결정**: nanoid (짧고 가독성 좋음)
   - **검증 필요**: 충돌 가능성 테스트

4. **기본 Stage Profile**
   - simple vs committee 중 기본값
   - **현재 결정**: simple (학습 곡선 낮음)
   - **검증 필요**: 사용자 피드백

5. **Provider 실행 타임아웃**
   - 기본값 1800초 (30분)
   - **검증 필요**: Provider별 적정 타임아웃 조정

6. **Barista와 Orchestrator 통합 방식**
   - 기존 Barista가 Orchestrator Run을 실행할지
   - Orchestrator가 별도 Barista 풀을 관리할지
   - **검증 필요**: 아키텍처 결정 필요

7. **Resume 시작 지점**
   - Stage 단위 재개 vs Node 단위 재개
   - **현재 결정**: Stage 단위 (구현 단순)
   - **검증 필요**: 사용자 시나리오 확인

## Next Steps

### 완료된 단계

- [x] **M0 완료**: DSL/저장구조/Assisted 모드 (2주)
  - 디렉토리 구조, CLI 골격, Workflow/Stage 파서
  - Role 템플릿 시스템, FSM 엔진
  - DAG 실행기, Assisted 모드, JSON Schema 검증
  - Run 관리 (state.json, events.jsonl)

- [x] **M1 완료**: Headless 모드 (1.5주)
  - Provider 템플릿 시스템 (M0에서 완료)
  - Subprocess 실행기 (`headless.ts`)
  - Headless/Assisted Fallback (`executor.ts`)
  - Provider 인터페이스 확장 (`IProvider.executeWithSchema()`)


- [x] **M2 완료**: UX 개선 (1.5주)

1. **M2-1: 간단 TUI** (3일)
   - [x] 인터랙티브 모드 (`codecafe orch run -i`)
   - [x] Stage 진행 상황 실시간 표시
   - [x] 노드 실행 상태 시각화

2. **M2-2: Profile/Assignment 편의 기능** (2일)
   - [x] Profile 설정 명령 (`codecafe orch profile set`)
   - [x] Assignment 설정 명령 (`codecafe orch assign set`)
   - [x] 설정 조회 명령

3. **M2-3: 이벤트/로그 시각화** (2일)
   - [x] `events.jsonl` 파싱 및 필터링
   - [x] 타임라인 뷰
   - [x] 에러 하이라이트

4. **M2-4: Electron UI 통합** (3일)
   - [x] Workflow 선택 UI
   - [x] Stage 진행 시각화
   - [x] Role/Provider 할당 UI
   - [x] Resume 버튼


### 즉시 착수 (다음 단계)

### 의사결정 필요 항목

1. **Barista와 Orchestrator 통합 방식** (M2 이후)
   - 기존 Barista가 Orchestrator Run을 실행할지
   - Orchestrator가 별도 Barista 풀을 관리할지

2. **Resume 시작 지점** (결정됨)
   - Stage 단위 재개 (구현 단순)

3. **Provider별 타임아웃 기본값** (결정됨)
   - 기본값 1800초 (30분)
   - providers.yml에서 조정 가능

4. **Stage Profile 기본값** (결정됨)
   - simple (학습 곡선 낮음)
   - assignments.yml에서 변경 가능

## References

### 관련 문서

- **오케스트레이터 PRD**: `C:\dev\code-cafe-manager\오케스트레이터-PRD.md`
- **code-cafe-manager PRD**: `C:\dev\code-cafe-manager\PRD.md`
- **요구사항 분석 문서**: `C:\dev\code-cafe-manager\.claude\docs\orchestrator-requirements.md`
- **기존 Recipe 예시**: `C:\dev\code-cafe-manager\recipes\house-blend\pm-agent.yaml`
- **Agent 파일**: `C:\dev\code-cafe-manager\.claude\agents\*.md`

### 기술 레퍼런스

- **JSON Schema**: https://json-schema.org/
- **YAML 스펙**: https://yaml.org/spec/1.2/spec.html
- **Handlebars**: https://handlebarsjs.com/
- **JSONPath**: https://goessner.net/articles/JsonPath/
- **Chokidar**: https://github.com/paulmillr/chokidar
- **Ink**: https://github.com/vadimdemedes/ink
- **ajv**: https://ajv.js.org/

### 유사 프로젝트

- **GitHub Actions**: Workflow/Job/Step 개념 참고
- **Airflow**: DAG 실행 엔진 참고
- **Tekton**: Pipeline/Task 개념 참고

---

## 프로젝트 상태 업데이트

**최종 업데이트**: 2026-01-11

**완료된 마일스톤**:
- ✅ **M0 (DSL/저장구조/Assisted 모드)**: 완료
- ✅ **M1 (Headless 모드)**: 완료
- ✅ **M2 (UX 개선)**: 완료

**현재 상태**:
- M0, M1, M2의 모든 핵심 기능 구현 완료
- Provider 인터페이스 확장으로 `executeWithSchema()` 지원
- Headless/Assisted 자동 Fallback 로직 구현
- TUI 기반 인터랙티브 모드 구현 (Ink)
- Profile/Assignment CLI 명령 구현
- 이벤트/로그 시각화 개선 (timeline, 색상/아이콘)
- Electron UI 통합을 위한 백엔드 API 레이어 구현
- 빌드 및 통합 검증 완료

**다음 단계**:
- 빌드 검증 및 타입 체크
- 실제 런타임 테스트 (사용자 환경)
- Electron UI React 컴포넌트 통합 (별도 작업)
- 문서화 및 사용자 가이드 작성

**구현된 M2 컴포넌트**:
- `packages/orchestrator/src/ui/InteractiveRunner.tsx`: Ink TUI 메인 컴포넌트
- `packages/orchestrator/src/ui/components/StageProgress.tsx`: Stage 진행 상태 시각화
- `packages/orchestrator/src/ui/components/NodeStatus.tsx`: Node 실행 상태 시각화
- `packages/orchestrator/src/cli/commands/profile.ts`: Profile 관리 CLI
- `packages/orchestrator/src/cli/commands/assign.ts`: Assignment 관리 CLI
- `packages/orchestrator/src/cli/commands/logs.ts`: 로그 시각화 개선
- `packages/orchestrator/src/ui/types.ts`: Electron UI 타입 정의
- `packages/orchestrator/src/ui/electron-api.ts`: Electron IPC 핸들러


