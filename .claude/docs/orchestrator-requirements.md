# 오케스트레이터 요구사항 분석 문서

**문서 버전**: v0.1
**작성일**: 2026-01-11
**상태**: 요구사항 분석 완료
**프로젝트**: code-cafe-manager
**통합 전략**: 기존 recipes/ 시스템 확장

---

## 1. 개요 (Executive Summary)

### 1.1 목적

멀티 AI CLI 오케스트레이터 PRD를 기반으로, code-cafe-manager 프로젝트에 고급 워크플로우 오케스트레이션 기능을 통합합니다. 기존 recipes/ 시스템을 확장하여 Plan → Code → Test → Check 패턴을 지원하고, 다중 Provider(claude-code, codex, gemini) 환경에서 동적 에이전트 할당과 Stage 내부 그래프 실행을 가능하게 합니다.

### 1.2 사용자 선택사항

- **구현 범위**: 전체 구현 (M0 + M1 + M2)
- **통합 전략**: 기존 recipes/ 시스템 확장
- **Provider 우선순위**: claude-code → codex → gemini

### 1.3 핵심 가치

1. **기존 시스템 보존**: 현재 작동하는 pm-agent, recipe 시스템을 유지하면서 점진적 확장
2. **표준화된 워크플로우**: Plan → Code → Test → Check FSM 제공
3. **유연한 실행 모델**: Stage 내부에서 단일 실행 또는 복잡한 DAG 실행 선택 가능
4. **Provider 중립성**: 동일 워크플로우를 다른 AI Provider로 실행 가능

---

## 2. PRD 핵심 요구사항 추출

### 2.1 상위 워크플로우 (FSM)

**원본 PRD 요구사항 (FR1)**:
- 고정 흐름: Plan → Code → Test → Check → (Done or Loop)
- Loop 조건:
  - Check 결과 JSON의 `done=true`면 종료
  - `done=false`면 `recommended_next_stage`로 이동 또는 fallback
- 반복 제한: `max_iters` 설정

**code-cafe-manager 적용**:
```yaml
# recipes/orchestrator/workflow.yaml
workflow:
  name: "orchestrator-fsm"
  stages: [plan, code, test, check]
  loop:
    max_iters: 5
    fallback_next_stage: plan
    stop_when: "$.done == true"
```

### 2.2 Stage 내부 그래프 (동적 DAG)

**원본 PRD 요구사항 (FR2)**:
- 각 Stage는 단일 노드 또는 DAG 가능
- 노드 타입:
  - `run`: Provider + Role 1회 실행
  - `foreach`: 동적 N개 실행 (순차/병렬)
  - `reduce`: 결과 합성
  - `branch`: 조건 분기
  - `export`: Stage 최종 결과 출력

**code-cafe-manager 적용**:
- 기존 recipe의 `steps` 구조 확장
- 새로운 step type 추가: `foreach`, `reduce`, `export`
- 기존 `parallel`, `conditional`과 통합

### 2.3 Role 기반 템플릿 시스템

**원본 PRD 요구사항 (FR3)**:
- Role 파일: frontmatter + 프롬프트 템플릿
- 메타데이터: `id`, `name`, `output_schema`, `inputs`, `guards`
- CRUD 기능: 생성/편집/삭제

**code-cafe-manager 적용**:
- 기존 `.claude/agents/` 시스템과 통합
- 새 디렉토리: `.orch/roles/` (오케스트레이터 전용 Role)
- 기존 agent 파일을 Role로 참조 가능

### 2.4 Provider 어댑터

**원본 PRD 요구사항 (FR4)**:
- 공통 인터페이스: prompt, cwd, outputSchemaPath, env, mode
- 명령 템플릿 주입 가능
- Assisted 모드 / Headless 모드

**code-cafe-manager 적용**:
- 기존 `packages/providers/` 구조 활용
- Provider 인터페이스 확장: `executeWithSchema()` 메서드 추가
- `providers.yml` 설정 파일 추가

### 2.5 컨텍스트 공유 (외부화)

**원본 PRD 요구사항 (FR8)**:
- `.orch/` 디렉토리 표준 구조
- 파일 기반 컨텍스트 공유
- 프롬프트에 파일 경로 전달

**code-cafe-manager 적용**:
```
.orch/
  context/
    requirements.md
    constraints.md
    decisions.md
  roles/
    planner.md
    coder.md
    tester.md
    checker.md
  schemas/
    plan.schema.json
    code.schema.json
    test.schema.json
    check.schema.json
  workflows/
    default.workflow.yml
    stages/
      plan.simple.yml
      plan.committee.yml
      code.simple.yml
      code.review-loop.yml
      test.smoke.yml
      test.deep.yml
      check.gate.yml
  config/
    assignments.yml
    providers.yml
  runs/
    <runId>/
      state.json
      events.jsonl
      stages/
        <iter>/
          plan/
            nodes/
              <nodeId>/
                prompt.txt
                result.json
                raw.txt
```

### 2.6 실행 상태 저장 및 재개

**원본 PRD 요구사항 (FR9)**:
- Run 상태: `state.json`
- 저장 내용: 현재 stage, 완료 노드, 결과 경로, 에러
- 재개: `orch resume <runId>`

**code-cafe-manager 적용**:
- 기존 Order 시스템과 통합
- Order에 `orchestratorState` 필드 추가
- Resume 기능: CLI와 UI 양쪽 지원

---

## 3. 기존 시스템과의 통합 지점

### 3.1 Recipe 시스템 확장

**현재 상태**:
- `recipes/house-blend/pm-agent.yaml`: 기본 PM 워크플로우
- Step types: `context.collect`, `ai.interactive`, `conditional`, `parallel`, `shell`, `data.passthrough`
- 변수 시스템: `{{ varName }}` 템플릿

**통합 방안**:
1. **하위 호환성 유지**: 기존 recipe는 그대로 작동
2. **새 Recipe 타입 추가**: `orchestrator` 타입
   ```yaml
   type: "orchestrator"  # 새로운 타입
   workflow_ref: ".orch/workflows/default.workflow.yml"
   ```
3. **Step 타입 확장**:
   - `foreach`: 동적 반복 실행
   - `reduce`: 결과 합성
   - `export`: Schema 기반 출력
   - `stage`: 오케스트레이터 Stage 실행

### 3.2 Agent 시스템 통합

**현재 상태**:
- `.claude/agents/`: requirements-analyzer, implementation-agent, verification-agent 등
- `agent_ref`: local/github 타입 지원

**통합 방안**:
1. **Role 맵핑**:
   - 기존 agent → orchestrator role 자동 변환
   - `.claude/agents/requirements-analyzer.md` → `.orch/roles/planner.md` (심볼릭 링크 또는 참조)
2. **템플릿 공유**:
   - Agent와 Role 템플릿 엔진 통일 (Handlebars)
3. **출력 스키마**:
   - Agent 출력을 JSON Schema로 검증

### 3.3 Provider 시스템 확장

**현재 상태**:
- `packages/providers/`: claude-code, codex (계획)
- Provider 인터페이스: 기본 실행 기능

**통합 방안**:
1. **Provider 인터페이스 확장**:
   ```typescript
   interface OrchestratorProvider extends Provider {
     executeWithSchema(
       prompt: string,
       schemaPath: string,
       options: {
         cwd: string;
         env: Record<string, string>;
         mode: 'assisted' | 'headless';
       }
     ): Promise<{
       rawText: string;
       parsedJson: any;
       artifacts?: string[];
     }>;
   }
   ```
2. **Provider 설정 파일**: `.orch/config/providers.yml`
   ```yaml
   providers:
     claude-code:
       headless_cmd: 'claude -p @PROMPT_FILE --output-format json'
       assisted_hint: 'Claude Code 터미널에서 실행'
     codex:
       headless_cmd: 'codex exec --json --output-schema @SCHEMA_FILE'
       assisted_hint: 'Codex 터미널에서 실행'
     gemini:
       headless_cmd: 'gemini -p @PROMPT_TEXT --output-format json'
       assisted_hint: 'Gemini CLI에서 실행'
   ```

### 3.4 Barista/Order 시스템 확장

**현재 상태**:
- Barista: 독립 프로세스, 1 Order 실행
- Order: Recipe 1회 실행 인스턴스

**통합 방안**:
1. **Order 타입 확장**:
   ```typescript
   interface OrchestratorOrder extends Order {
     type: 'orchestrator';
     workflowId: string;
     currentStage: 'plan' | 'code' | 'test' | 'check';
     stageIter: number;
     orchestratorState: {
       stateFilePath: string;
       completedNodes: string[];
       lastCheckResult?: {
         done: boolean;
         recommendedNextStage?: string;
       };
     };
   }
   ```
2. **Resume 기능**:
   - `codecafe resume <orderId>`
   - UI: "Resume" 버튼 추가

### 3.5 UI (CodeCafe Manager) 확장

**현재 상태**:
- Dashboard: Barista/Order 목록
- New Order: Menu 선택, Counter 선택
- Order Detail: 로그 스트리밍

**통합 방안**:
1. **Workflow 선택 UI**:
   - Menu에 "Orchestrator Workflows" 카테고리 추가
   - Workflow 선택 시 Stage Profile 선택 가능
2. **Stage 진행 상황 시각화**:
   - 진행 표시: `Plan ✓ → Code ⏳ → Test ⬜ → Check ⬜`
   - 현재 Stage의 노드 실행 상태 표시
3. **Role/Provider 할당 UI**:
   - Stage별 Provider 선택
   - Role 선택 또는 커스터마이징
4. **Resume UI**:
   - 중단된 Order 목록
   - "Resume from Stage X" 버튼

---

## 4. 단계별 구현 계획

### 4.1 M0: DSL/저장구조/Assisted 모드 (1차)

**목표**: 오케스트레이터 기본 골격 구축

**기간**: 2주

**작업 항목**:

1. **디렉토리 구조 생성** (1일)
   - `.orch/` 표준 구조 생성
   - 초기 템플릿 파일 설치
   - `codecafe orch init` 명령 구현

2. **Workflow/Stage 파일 포맷 정의** (2일)
   - YAML 스키마 작성: `workflow.schema.json`, `stage-profile.schema.json`
   - 검증 로직 구현
   - 샘플 워크플로우 작성

3. **Role 템플릿 시스템** (3일)
   - Role 파일 포맷 확정 (frontmatter + Handlebars)
   - Role CRUD 명령: `codecafe orch role add/edit/rm/list`
   - 기본 Role 세트 작성: planner, coder, tester, checker

4. **FSM 엔진** (3일)
   - Stage 전환 로직
   - Loop 조건 평가 (`done`, `recommended_next_stage`)
   - `max_iters` 제한

5. **Stage 내부 DAG 실행기** (4일)
   - 노드 타입 구현: `run`, `foreach`, `reduce`, `branch`, `export`
   - 의존성 해석 및 실행 순서 결정
   - 병렬 실행 (concurrency 제한)

6. **Assisted 모드** (2일)
   - 프롬프트 파일 생성 (`prompt.txt`)
   - 결과 파일 감시 (fs.watch)
   - 가이드 메시지 출력

7. **JSON Schema 검증** (1일)
   - 노드 출력 검증
   - 검증 실패 시 재시도 로직

8. **Run 관리** (2일)
   - `state.json` 저장/로드
   - `events.jsonl` 이벤트 로깅
   - `codecafe orch run/status/logs` 명령

**산출물**:
- `.orch/` 디렉토리 구조
- CLI 명령: `orch init/run/resume/status/logs/role`
- 기본 Workflow/Role/Schema 파일 세트
- Assisted 모드 프롬프트 생성 및 결과 수집

**검증 기준**:
- [X] `.orch/` 구조가 생성되고 기본 파일이 설치됨
- [X] `orch run`으로 plan→code→test→check 흐름이 실행됨
- [X] `check.done=true`일 때 워크플로우가 종료됨
- [X] Assisted 모드에서 프롬프트 파일이 생성되고 결과 파일을 감시함

---

### 4.2 M1: Headless 모드 (2차)

**목표**: Provider 자동 실행 지원

**기간**: 1.5주

**작업 항목**:

1. **Provider 템플릿 시스템** (2일)
   - `providers.yml` 파일 포맷 정의
   - 명령 템플릿 파싱 (`@PROMPT_FILE`, `@SCHEMA_FILE` 치환)
   - Provider별 설정 로드

2. **Subprocess 실행기** (3일)
   - Provider 명령 실행 (child_process.spawn)
   - stdout/stderr 캡처
   - JSON 결과 파싱

3. **Headless/Assisted Fallback** (2일)
   - Headless 실행 시도
   - 실패 시 Assisted 모드로 전환
   - 사용자 선택: 모드 강제 옵션

4. **Provider 인터페이스 확장** (2일)
   - `executeWithSchema()` 메서드 구현
   - claude-code, codex Provider 업데이트

**산출물**:
- `providers.yml` 설정 파일
- Headless 모드 실행기
- Fallback 로직

**검증 기준**:
- [X] Headless 모드로 Claude Code 실행 성공
- [X] 실행 실패 시 Assisted 모드로 자동 전환
- [X] Provider 템플릿 설정을 변경하여 다른 명령으로 실행 가능

---

### 4.3 M2: UX 개선 (3차)

**목표**: 사용자 편의성 향상

**기간**: 1.5주

**작업 항목**:

1. **간단 TUI** (3일)
   - `codecafe orch run -i` (인터랙티브 모드)
   - Stage 진행 상황 실시간 표시
   - 노드 실행 상태 시각화
   - Ink 또는 blessed 라이브러리 사용

2. **Profile/Assignment 편의 기능** (2일)
   - `codecafe orch profile set plan=committee`
   - `codecafe orch assign set code=codex:coder`
   - 설정 저장 및 로드

3. **이벤트/로그 시각화** (2일)
   - `events.jsonl` 파싱 및 필터링
   - 타임라인 뷰
   - 에러 하이라이트

4. **Electron UI 통합** (3일)
   - Workflow 선택 UI
   - Stage 진행 시각화
   - Role/Provider 할당 UI
   - Resume 버튼

**산출물**:
- TUI 인터페이스
- Profile/Assignment 관리 CLI
- Electron UI 확장

**검증 기준**:
- [X] TUI에서 실시간 Stage 진행 상황 확인 가능
- [X] Profile/Assignment를 CLI로 설정 가능
- [X] Electron UI에서 Workflow 실행 및 모니터링 가능

---

## 5. 기술 스택 및 의존성

### 5.1 언어/런타임

- **TypeScript**: 전체 코드베이스
- **Node.js**: >= 18.0.0
- **pnpm**: >= 8.0.0 (모노레포 관리)

### 5.2 핵심 라이브러리

**DSL/검증**:
- `ajv`: JSON Schema 검증 (^8.12.0)
- `js-yaml`: YAML 파싱 (^4.1.0)
- `gray-matter`: Frontmatter 파싱 (^4.0.3)
- `handlebars`: 템플릿 엔진 (^4.7.8)

**실행/프로세스**:
- `node-pty`: PTY 프로세스 관리 (^1.0.0) - 기존 사용 중
- `chokidar`: 파일 감시 (^3.5.3)

**UI**:
- `ink`: CLI TUI (^4.4.1)
- `chalk`: CLI 컬러 (^5.3.0)
- `ora`: 스피너 (^7.0.1)

**유틸리티**:
- `jsonpath-plus`: JSONPath 평가 (^7.2.0)
- `nanoid`: ID 생성 (^5.0.4)
- `date-fns`: 날짜/시간 (^3.0.6)

### 5.3 새로운 패키지 추가

```
packages/
  orchestrator/           # 새 패키지
    src/
      engine/
        fsm.ts            # FSM 엔진
        dag-executor.ts   # DAG 실행기
        node-types/       # 노드 타입 구현
          run.ts
          foreach.ts
          reduce.ts
          branch.ts
          export.ts
      role/
        role-manager.ts   # Role CRUD
        template.ts       # 템플릿 엔진
      schema/
        validator.ts      # Schema 검증
      provider/
        adapter.ts        # Provider 어댑터
        assisted.ts       # Assisted 모드
        headless.ts       # Headless 모드
      storage/
        run-state.ts      # Run 상태 저장
        event-logger.ts   # 이벤트 로깅
    package.json
```

### 5.4 의존성 버전

**추가할 의존성**:
```json
{
  "dependencies": {
    "ajv": "^8.12.0",
    "gray-matter": "^4.0.3",
    "handlebars": "^4.7.8",
    "chokidar": "^3.5.3",
    "ink": "^4.4.1",
    "jsonpath-plus": "^7.2.0"
  }
}
```

---

## 6. 디렉토리 구조 설계

### 6.1 전체 구조

```
code-cafe-manager/
  .orch/                          # 오케스트레이터 디렉토리 (프로젝트 레벨)
    context/
      requirements.md
      constraints.md
      decisions.md
    roles/                        # Role 정의
      planner.md
      planner-synthesizer.md
      coder.md
      reviewer.md
      tester.md
      checker.md
    schemas/                      # 출력 스키마
      plan.schema.json
      code.schema.json
      test.schema.json
      check.schema.json
    workflows/                    # Workflow 정의
      default.workflow.yml
      stages/                     # Stage Profile
        plan.simple.yml
        plan.committee.yml
        code.simple.yml
        code.review-loop.yml
        test.smoke.yml
        test.deep.yml
        check.gate.yml
    config/
      assignments.yml             # Stage→Provider/Role 할당
      providers.yml               # Provider 설정
    runs/                         # Run 실행 기록
      <runId>/
        state.json                # 실행 상태
        events.jsonl              # 이벤트 로그
        stages/
          <iter>/                 # Stage 반복 번호
            plan/
              nodes/
                <nodeId>/
                  prompt.txt
                  result.json
                  raw.txt
            code/
            test/
            check/

  packages/
    orchestrator/                 # 새 패키지
      src/
        engine/
        role/
        schema/
        provider/
        storage/
        cli/                      # CLI 명령
          orch.ts
          commands/
            init.ts
            run.ts
            resume.ts
            status.ts
            logs.ts
            role.ts
            profile.ts
            assign.ts
      templates/                  # 초기 템플릿
        roles/
        schemas/
        workflows/
        config/

  recipes/
    orchestrator/                 # 오케스트레이터 Recipe
      default-fsm.yaml            # 기본 FSM 워크플로우
      committee-plan.yaml         # 위원회 방식 Plan

  .claude/
    agents/                       # 기존 Agent (Role로 참조 가능)
      requirements-analyzer.md
      implementation-agent.md
      verification-agent.md
```

### 6.2 `.orch/` 초기화

**`codecafe orch init` 실행 시**:

1. `.orch/` 디렉토리 생성
2. 기본 템플릿 복사:
   - `context/requirements.md` (빈 파일)
   - `roles/*.md` (기본 Role 세트)
   - `schemas/*.schema.json` (표준 스키마)
   - `workflows/default.workflow.yml`
   - `workflows/stages/*.yml` (기본 Stage Profile)
   - `config/assignments.yml` (기본 할당)
   - `config/providers.yml` (기본 Provider 설정)
3. `.gitignore`에 `.orch/runs/` 추가 (실행 기록 제외)

---

## 7. 리스크 및 제약사항

### 7.1 기술 리스크

| 리스크 | 영향도 | 발생 가능성 | 대응 방안 |
|--------|--------|-------------|-----------|
| Provider CLI 출력 파싱 실패 | 높음 | 중간 | Assisted 모드 fallback, Schema 재시도 |
| Headless 모드 권한/인증 문제 | 중간 | 높음 | Assisted 모드 우선, Provider별 가이드 |
| 병렬 실행 시 리소스 경합 | 중간 | 낮음 | concurrency 제한, Barista 풀 활용 |
| Windows/Mac/Linux 파일 감시 차이 | 낮음 | 중간 | chokidar 라이브러리 사용 (크로스플랫폼) |
| Role 템플릿 보안 (악의적 명령) | 높음 | 낮음 | Guards 검증, Sandbox 옵션 (향후) |

### 7.2 프로젝트 제약사항

1. **기존 시스템 호환성**:
   - 기존 `recipes/house-blend/pm-agent.yaml`은 그대로 작동해야 함
   - 기존 Provider 인터페이스 변경 최소화

2. **Provider 가용성**:
   - Claude Code: 안정적 지원 (이미 구현 중)
   - Codex: 계획 단계 (M1 이후)
   - Gemini: 계획 단계 (M2 이후)

3. **사용자 환경**:
   - Provider CLI 설치는 사용자 책임
   - 인증/로그인은 각 CLI의 표준 방식 사용

4. **성능 제약**:
   - 병렬 실행: 최대 4개 Barista (하드웨어 제약)
   - Run 기록: 디스크 용량 (로그 로테이션 필요)

### 7.3 운영 리스크

1. **학습 곡선**:
   - 오케스트레이터 개념이 복잡함
   - 문서/예제 충실히 제공 필요

2. **디버깅 복잡도**:
   - Stage/Node 중첩 실행으로 디버깅 어려움
   - 상세 로깅, 이벤트 추적 필수

3. **버전 관리**:
   - Workflow/Role 버전 변경 시 호환성 문제
   - Schema 버전 관리 필요

---

## 8. 확장 가능성

### 8.1 단기 확장 (3개월)

1. **Provider 추가**:
   - Codex 완전 지원
   - Gemini CLI 통합

2. **Stage Profile 라이브러리**:
   - 커뮤니티 공유 Stage Profile
   - GitHub 기반 레지스트리

3. **Reduce 전략 확장**:
   - `summarize` 외 `vote`, `merge`, `best-of-n` 전략

### 8.2 중기 확장 (6개월)

1. **API 모드**:
   - Provider API 직접 호출 (CLI 없이)
   - 키 관리 (OS Keychain 연동)

2. **워크플로우 시각화**:
   - DAG 그래프 뷰
   - 실시간 노드 상태 애니메이션

3. **협업 기능**:
   - Workflow 공유/임포트
   - 팀 설정 (공유 Role/Provider 설정)

### 8.3 장기 확장 (1년)

1. **분산 실행**:
   - 원격 Barista (클라우드 에이전트)
   - 작업 큐 시스템

2. **고급 제어 흐름**:
   - 사용자 승인 단계 (Approval Gate)
   - 조건부 Stage 스킵

3. **메트릭/분석**:
   - 실행 성공률, 평균 시간
   - Provider 성능 비교

---

## 9. 성공 지표 (Success Metrics)

### 9.1 M0 성공 지표

- [ ] `.orch init`으로 표준 구조 생성 성공률 100%
- [ ] plan→code→test→check 흐름 실행 성공률 ≥ 80%
- [ ] Assisted 모드에서 사용자 개입 없이 결과 수집 성공률 ≥ 90%
- [ ] Schema 검증 실패 시 재시도로 복구 성공률 ≥ 70%

### 9.2 M1 성공 지표

- [ ] Headless 모드 실행 성공률 ≥ 60% (Claude Code)
- [ ] Headless 실패 시 Assisted fallback 성공률 100%
- [ ] Provider 설정 변경 후 즉시 반영 성공률 100%

### 9.3 M2 성공 지표

- [ ] TUI 인터랙티브 모드 사용자 만족도 ≥ 4/5
- [ ] Electron UI에서 Workflow 실행 성공률 ≥ 90%
- [ ] Resume 기능으로 중단 지점부터 재개 성공률 ≥ 85%

### 9.4 비즈니스 지표

- 워크플로우 재사용률: ≥ 50% (사용자가 기본 Workflow를 여러 번 실행)
- 커스터마이징률: ≥ 30% (사용자가 Role/Profile/Assignment 변경)
- 다중 Provider 사용률: ≥ 20% (사용자가 2개 이상 Provider 사용)

---

## 10. 다음 단계 (Next Steps)

### 10.1 즉시 착수 (이번 주)

1. **M0 Phase 1: 디렉토리 구조 및 CLI 골격**
   - [ ] `.orch/` 디렉토리 구조 정의
   - [ ] `packages/orchestrator` 패키지 생성
   - [ ] `codecafe orch init` 명령 구현
   - [ ] 기본 템플릿 파일 작성

2. **M0 Phase 2: Workflow/Stage 파서**
   - [ ] `workflow.schema.json` 작성
   - [ ] `stage-profile.schema.json` 작성
   - [ ] YAML 로드 및 검증 로직 구현

### 10.2 1주차

3. **M0 Phase 3: Role 템플릿 시스템**
   - [ ] Role 파일 포맷 확정
   - [ ] Role CRUD 구현
   - [ ] Handlebars 템플릿 엔진 통합

4. **M0 Phase 4: FSM 엔진**
   - [ ] Stage 전환 로직 구현
   - [ ] Loop 조건 평가 구현

### 10.3 2주차

5. **M0 Phase 5: DAG 실행기**
   - [ ] 노드 타입 구현 (`run`, `foreach`, `reduce`, `branch`, `export`)
   - [ ] 의존성 해석 및 실행 순서 결정

6. **M0 Phase 6: Assisted 모드**
   - [ ] 프롬프트 생성 및 파일 감시
   - [ ] JSON Schema 검증

### 10.4 의사결정 필요 항목

1. **템플릿 엔진 선택**:
   - Handlebars vs Mustache vs Liquid
   - 권장: Handlebars (더 많은 기능, 커뮤니티 활발)

2. **파일 감시 방식**:
   - 폴링 vs fs.watch vs chokidar
   - 권장: chokidar (크로스플랫폼, 안정적)

3. **Run ID 생성 방식**:
   - UUID vs nanoid vs timestamp
   - 권장: nanoid (짧고 가독성 좋음)

4. **기본 Stage Profile**:
   - simple vs committee 중 기본값
   - 권장: simple (학습 곡선 낮음)

---

## 11. 참고 자료

### 11.1 관련 문서

- **오케스트레이터 PRD**: `C:\dev\code-cafe-manager\오케스트레이터-PRD.md`
- **code-cafe-manager PRD**: `C:\dev\code-cafe-manager\PRD.md`
- **기존 Recipe 예시**: `C:\dev\code-cafe-manager\recipes\house-blend\pm-agent.yaml`
- **Agent 파일**: `C:\dev\code-cafe-manager\.claude\agents\*.md`

### 11.2 기술 레퍼런스

- **JSON Schema**: https://json-schema.org/
- **YAML 스펙**: https://yaml.org/spec/1.2/spec.html
- **Handlebars**: https://handlebarsjs.com/
- **JSONPath**: https://goessner.net/articles/JsonPath/
- **Chokidar**: https://github.com/paulmillr/chokidar

### 11.3 유사 프로젝트

- **GitHub Actions**: Workflow/Job/Step 개념 참고
- **Airflow**: DAG 실행 엔진 참고
- **Tekton**: Pipeline/Task 개념 참고

---

## 12. 부록: 샘플 파일

### 12.1 Workflow 파일 예시

**파일**: `.orch/workflows/default.workflow.yml`

```yaml
workflow:
  name: "default-orchestrator"
  version: "1.0.0"
  description: "표준 Plan→Code→Test→Check 워크플로우"

  stages: [plan, code, test, check]

  loop:
    max_iters: 5
    fallback_next_stage: plan
    stop_when: "$.done == true"

  defaults:
    provider: claude-code
    timeout_sec: 1800
```

### 12.2 Stage Profile 예시

**파일**: `.orch/workflows/stages/plan.committee.yml`

```yaml
stage: plan
profile: committee
description: "3개 에이전트가 계획을 수립하고 합성"

vars:
  plan_committee:
    - provider: claude-code
      role: planner_arch
    - provider: codex
      role: planner_tasks
    - provider: gemini
      role: planner_risks

graph:
  - id: committee
    type: foreach
    items: ${vars.plan_committee}
    mode: parallel
    concurrency: 3
    run:
      type: run
      provider: ${item.provider}
      role: ${item.role}
    out: committee_outputs

  - id: synthesize
    type: run
    provider: claude-code
    role: planner_synthesizer
    inputs:
      - committee_outputs

  - id: plan_out
    type: export
    from: synthesize
    output_schema: schemas/plan.schema.json
```

### 12.3 Role 파일 예시

**파일**: `.orch/roles/planner.md`

```markdown
---
id: planner
name: "계획 수립자"
output_schema: schemas/plan.schema.json
inputs:
  - .orch/context/requirements.md
  - .orch/context/constraints.md
guards:
  - "출력은 반드시 JSON 형식"
  - "스키마 필드를 모두 포함"
---

# 계획 수립 에이전트

당신은 소프트웨어 개발 계획을 수립하는 전문가입니다.

## 입력 파일

다음 파일을 반드시 읽으세요:

{{#each inputs}}
- {{this}}
{{/each}}

## 출력 형식

아래 스키마에 맞는 JSON을 출력하세요:

```json
{
  "goals": ["목표 1", "목표 2"],
  "tasks": [
    {
      "id": "task-1",
      "description": "작업 설명",
      "dependencies": []
    }
  ],
  "risks": ["리스크 1", "리스크 2"],
  "assumptions": ["가정 1", "가정 2"]
}
```

## 가이드

1. 요구사항을 명확히 이해하세요
2. 작업을 논리적 순서로 분해하세요
3. 의존성을 명확히 하세요
4. 리스크와 가정을 명시하세요
```

### 12.4 Schema 파일 예시

**파일**: `.orch/schemas/plan.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["goals", "tasks"],
  "properties": {
    "goals": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 1
    },
    "tasks": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "description"],
        "properties": {
          "id": { "type": "string" },
          "description": { "type": "string" },
          "dependencies": {
            "type": "array",
            "items": { "type": "string" }
          }
        }
      }
    },
    "risks": {
      "type": "array",
      "items": { "type": "string" }
    },
    "assumptions": {
      "type": "array",
      "items": { "type": "string" }
    }
  }
}
```

### 12.5 Provider 설정 예시

**파일**: `.orch/config/providers.yml`

```yaml
providers:
  claude-code:
    headless_cmd: 'claude -p @PROMPT_FILE --output-format json'
    assisted_hint: |
      Claude Code 터미널에서 다음을 실행하세요:
      1. prompt.txt 내용을 복사
      2. Claude Code에 붙여넣기
      3. 결과 JSON을 result.json에 저장
    timeout_sec: 1800

  codex:
    headless_cmd: 'codex exec --json --output-schema @SCHEMA_FILE -i @PROMPT_FILE'
    assisted_hint: |
      Codex 터미널에서 다음을 실행하세요:
      1. codex exec -i prompt.txt
      2. 결과 JSON을 result.json에 저장
    timeout_sec: 1800

  gemini:
    headless_cmd: 'gemini -p @PROMPT_TEXT --output-format json'
    assisted_hint: |
      Gemini CLI에서 다음을 실행하세요:
      1. prompt.txt 내용으로 실행
      2. JSON 결과를 result.json에 저장
    timeout_sec: 1800
```

### 12.6 Assignment 설정 예시

**파일**: `.orch/config/assignments.yml`

```yaml
# Stage별 기본 Provider/Role 할당
assignments:
  plan:
    provider: claude-code
    role: planner
    profile: simple  # 또는 committee

  code:
    provider: claude-code
    role: coder
    profile: simple  # 또는 review-loop

  test:
    provider: codex
    role: tester
    profile: smoke  # 또는 deep

  check:
    provider: claude-code
    role: checker
    profile: gate

# 실행 시 override 가능:
# codecafe orch run --assign code=codex:coder
```

---

## 13. 결론

본 문서는 오케스트레이터 PRD의 핵심 요구사항을 code-cafe-manager 프로젝트에 통합하기 위한 상세 분석 결과입니다.

**핵심 전략**:
1. **점진적 확장**: 기존 recipes/ 시스템 유지하며 `.orch/` 추가
2. **하위 호환성**: 기존 pm-agent, Recipe 그대로 작동
3. **표준화**: Plan→Code→Test→Check FSM + Role/Schema 기반 실행
4. **유연성**: Provider/Role 동적 할당, Stage Profile 선택

**다음 단계**: M0 Phase 1부터 구현 시작, 2주 내 기본 골격 완성 목표

