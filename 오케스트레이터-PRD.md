```md
# PRD.md — 멀티 AI CLI 오케스트레이터 (Claude Code / Codex / Gemini)

버전: v0.1 (Draft)  
작성일: 2026-01-11  
상태: 제안서(구현 가능한 수준의 요구사항/스펙 포함)

---

## 1. 문제 정의

사용자는 **Claude Code**, **Codex CLI**, **Gemini CLI**를 각각 **별도의 터미널(=CLI)** 로 실행하고 있으며, API 연동 없이도 다음을 만족하는 **오케스트레이션**이 필요하다.

- 고정된 상위 골격:  
  **계획(Plan) → 코드작성(Code) → 테스트/검증(Test) → 완료체크(Check) → 완료 or 루프**
- 단, 각 Stage(Plan/Code/Test/Check) 내부는 사용자가 원하면  
  **1개의 에이전트 호출로 끝**낼 수도 있고,  
  **N개의 에이전트를 실행(병렬/순차) → 결과를 합성(Join/Reduce) → Stage 결과 산출**하도록 동적으로 구성할 수 있어야 한다.
- 각 단계/노드마다 “어떤 CLI(Claude/Codex/Gemini)로 돌릴지”와 “어떤 역할(Role 프롬프트 템플릿)을 적용할지”를 **사용자가 동적으로 설정**할 수 있어야 한다.
- 모든 에이전트가 동일한 컨텍스트를 공유해야 하며, 툴 내부 세션 메모리 공유가 불가능하므로 **컨텍스트를 외부화(파일/스토어)** 해야 한다.

---

## 2. 목표 (Goals)

1. **CLI 기반 오케스트레이터** 제공 (코어는 CLI)
2. 상위 워크플로우는 고정(FSM): Plan → Code → Test → Check → (Done/Loop)
3. 각 Stage 내부에 **동적 미니 워크플로우(그래프/DAG)** 를 구성 가능
   - 예: Plan 단계에서 위원회(Committee) 3개 에이전트 병렬 실행 후 합성
   - 예: Test 단계에서 Smoke/Integration을 각각 다른 에이전트로 수행 후 Gate
4. 사용자가 **Role 기반 템플릿(생성/편집/삭제)** 을 관리하고,
   실행 시점에 **Stage/Profile/Node별로 Provider(Claude/Codex/Gemini)와 Role을 할당**
5. 컨텍스트 공유는 **로컬 파일 시스템 표준 구조(.orch/)** 로 해결
6. 모든 노드 출력은 **표준 JSON** + **JSON Schema 검증**으로 파이프라인 안정성 확보
7. v0.1에서는 API 없이도 동작하도록
   - **Assisted 모드**(오케스트레이터가 프롬프트 생성 → 사용자가 각 터미널에서 실행 → 결과 파일 드롭)
   - **Headless 모드**(가능한 범위에서 CLI를 subprocess로 호출) 둘 다 지원

---

## 3. 비목표 (Non-Goals)

- 자체 AI 모델/에이전트 개발(모델 학습/호스팅) 및 API 기반 에이전트 구현은 범위 밖
- 원격 분산 실행(클러스터/큐/서버리스)은 v0.1 범위 밖
- 완전 자동 코드 머지/리베이스/대규모 충돌 해결은 v0.1 범위 밖
- 고급 UI(웹 GUI) 필수 아님 (추후 확장)

---

## 4. 사용자 시나리오 (User Stories)

### US1 — 단순 실행

- “Plan”을 Claude Code 1회 실행으로 끝내고, 다음으로 넘어간다.

### US2 — Plan 위원회(동적 N)

- Plan 단계에서 (Claude planner_arch / Codex planner_tasks / Gemini planner_risks) 3개를 돌리고,
- Synthesizer 1개가 결과를 합성하여 Plan 산출물(JSON)을 만든다.

### US3 — Stage 내부 루프

- Check 단계에서 done=false면 Code로 되돌아가고,
- Code 단계 내부에서 reviewer/critic을 거쳐 개선하고 다시 Test로 진행한다.

### US4 — 실행 시점 동적 할당

- 같은 workflow라도 오늘은 Code를 Codex로, 내일은 Claude로 바꿔서 실행한다.

### US5 — Role CRUD

- tester 역할 템플릿을 새로 만들고, 기존 checker 템플릿을 수정/삭제한다.

---

## 5. 핵심 개념/용어

- **Provider**: 실행 대상 CLI (claude | codex | gemini)
- **Role**: 역할 기반 프롬프트 템플릿 + 출력 스키마 + 입력 규칙
- **Stage**: 상위 워크플로우 단계 (plan/code/test/check)
- **Stage Profile**: Stage 내부 그래프의 변형(예: plan@simple, plan@committee)
- **Node**: 그래프 실행 단위(대부분 “Provider + Role 1회 실행”)
- **Reduce/Join**: N개 결과를 합성해 Stage 결과를 만드는 노드
- **Run**: 한 번의 오케스트레이션 실행 인스턴스(출력/로그/상태 저장)

---

## 6. 제품 요구사항 (Functional Requirements)

### FR1 — 상위 워크플로우(고정 FSM)

- 기본 흐름: Plan → Code → Test → Check → (Done or Loop)
- Loop 조건:
  - Check 결과 JSON의 `done=true`면 종료
  - `done=false`면 `recommended_next_stage`가 있으면 그 Stage로, 없으면 기본 fallback(Stage 설정값)으로 이동
- 반복 제한: workflow 단위 `max_iters`

### FR2 — Stage 내부 그래프(동적 구성)

- 각 Stage는 “단일 노드”일 수도 있고 “DAG”일 수도 있어야 한다.
- 최소 지원 노드 타입(v0.1):
  - `run`: Provider + Role로 1회 실행
  - `foreach`: items 목록을 기반으로 런타임에 N개 run을 동적 생성 (순차/병렬 옵션)
  - `reduce`: 여러 결과를 합성 (v0.1은 summarize 전략 1종 필수)
  - `branch`: 조건 분기(간단한 if/else)
  - `export`: Stage 최종 결과를 표준 스키마로 출력
- DAG 실행 규칙:
  - 의존성 충족된 노드부터 실행
  - v0.1 병렬은 옵션(동시 실행 제한 `concurrency`)

### FR3 — Role CRUD 및 템플릿 시스템

- Role은 파일 기반으로 관리:
  - 생성/편집/삭제
  - frontmatter(메타데이터) + 본문(프롬프트 템플릿)
- Role 메타데이터 최소 필드:
  - `id`, `name`, `output_schema`, `inputs`(필수 읽기 파일 목록), `guards`(금지 규칙 optional)

### FR4 — Provider 어댑터

- 각 Provider는 “얇은 실행기”로 추상화한다.
- 공통 인터페이스:
  - 입력: prompt(문자열), cwd, outputSchemaPath, env, mode(assisted/headless)
  - 출력: rawText, parsedJson, artifacts(optional)
- v0.1에서 Provider별 실행은 “명령 템플릿”을 설정으로 주입 가능해야 한다.

### FR5 — Assisted 모드

- 오케스트레이터는 각 노드 실행 시:
  - `prompt.txt` 생성
  - “어떤 터미널에서 어떤 명령으로 실행할지” 가이드 출력
  - 사용자가 결과 JSON을 지정 경로에 저장하면 다음으로 진행
- 완료 감지:
  - 결과 파일 생성/갱신 감시(폴링 또는 fs watch)
- 장점: 각 CLI의 상호작용/권한 문제를 최소화

### FR6 — Headless 모드(선택)

- 가능한 경우 subprocess로 CLI를 호출해 결과 JSON을 자동 수집한다.
- 실패 시 Assisted로 fallback 가능(옵션)

### FR7 — 표준 출력(JSON) + 스키마 검증

- 모든 run 노드는 `result.json`을 생성해야 한다.
- 오케스트레이터는 JSON Schema로 검증한다.
- 검증 실패 시 정책:
  - 재시도(retry N회)
  - 대체 Provider로 failover(선택)
  - 사용자가 개입할 수 있도록 Assisted fallback

### FR8 — 컨텍스트 공유(외부화)

- 모든 컨텍스트/산출물은 `.orch/` 하위에 저장한다.
- 에이전트 간 공유는 파일 기반으로 통일한다.
- 프롬프트에는 컨텍스트를 “본문으로 전부 포함”하기보다,
  - 필수 파일 목록을 제공하고 “읽어라”를 규칙으로 한다.

### FR9 — 실행 상태 저장 및 재개(Resume)

- Run 상태를 `state.json`에 기록:
  - 현재 stage, stage iter, 완료된 노드, 결과 경로, 마지막 에러
- 중단 후 재개: `orch resume <runId>`

### FR10 — Stage/Profile/Provider/Role 동적 할당

- 기본 할당은 설정 파일로 저장
- 실행 시 override 가능(CLI 옵션)
- Stage Profile 선택 가능:
  - 예: `plan=simple`, `plan=committee`

---

## 7. 비기능 요구사항 (Non-Functional Requirements)

### NFR1 — 신뢰성

- 스키마 검증 기반 파이프라인
- 단계별 로그/이벤트 저장
- 재시도/중단/재개 지원

### NFR2 — 확장성

- Provider 추가가 쉬워야 함(어댑터/설정 추가)
- Node 타입 추가가 쉬워야 함(플러그인 구조 고려)

### NFR3 — 보안/안전

- 기본 모드는 Assisted(사용자 통제)
- Headless에서 파일 수정/명령 실행 권한은 최소화(Provider 설정으로 제어)
- 민감정보(토큰/키)는 env 또는 로컬 설정 파일에 저장하고, 결과/로그에 마스킹 옵션 제공

### NFR4 — 관찰 가능성(Observability)

- 실행 이벤트를 JSONL로 기록:
  - node_start, node_end, validation_fail, retry, stage_end 등
- 실패 원인/경로를 명확히 남긴다.

---

## 8. 저장 구조(표준 디렉토리)
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
...
schemas/
plan.schema.json
code.schema.json
test.schema.json
check.schema.json
...
workflows/
default.workflow.yml
stages/
plan.simple.yml
plan.committee.yml
code.simple.yml
...
config/
assignments.yml
providers.yml
runs/ <runId>/
state.json
events.jsonl
stages/ <iter>/
plan/
nodes/<nodeId>/{prompt.txt,result.json,raw.txt}
code/
test/
check/

````

---

## 9. DSL 스펙(요약)

### 9.1 상위 Workflow 파일 예시
```yaml
workflow:
  stages: [plan, code, test, check]
  loop:
    max_iters: 5
    fallback_next_stage: plan
    stop_when: "$.done == true"
````

### 9.2 Stage Profile(그래프) 예시 — plan@committee

```yaml
graph:
  - id: committee
    type: foreach
    items: ${vars.plan_committee}
    mode: parallel # or sequential
    concurrency: 3
    run:
      type: run
      provider: ${item.provider}
      role: ${item.role}
    out: committee_outputs

  - id: synthesize
    type: run
    provider: claude
    role: planner_synthesizer
    inputs:
      - committee_outputs

  - id: plan_out
    type: export
    from: synthesize
    output_schema: schemas/plan.schema.json
```

### 9.3 Node 타입 정의(v0.1)

- `run`
  - provider: string
  - role: string
  - inputs: (optional) 결과 참조 또는 파일 경로

- `foreach`
  - items: 배열 변수 참조
  - run: run node template
  - mode: parallel|sequential
  - out: 결과 배열 변수명

- `reduce`
  - strategy: summarize (v0.1)
  - provider/role: 합성 담당

- `branch`
  - when: 조건 목록

- `export`
  - from: node id
  - output_schema: schema path

### 9.4 표현식/참조 규칙(v0.1)

- `${vars.*}`: 사용자 변수 참조
- 결과 참조는 node id 기반:
  - `${nodes.synthesize.result}` 또는 `${committee_outputs}`(foreach out)

- `stop_when` 등은 JSONPath 기반(최소 subset)

---

## 10. Role 템플릿 포맷

### 10.1 Role 파일 예시(Frontmatter + Template)

```md
---
id: planner_synthesizer
name: Plan Synthesizer
output_schema: schemas/plan.schema.json
inputs:
  - .orch/context/requirements.md
  - .orch/context/constraints.md
guards:
  - '출력은 JSON만'
  - '스키마 위반 금지'
---

너는 여러 계획안을 합성하는 책임자다.

반드시 아래 파일을 읽어라:
{{#each inputs}}- {{this}}
{{/each}}

추가 입력(다른 에이전트 결과):
{{inputs}}

출력은 반드시 JSON만.
스키마를 준수하고, 불확실하면 assumptions 배열에 명시.
```

---

## 11. Provider 설정(명령 템플릿)

`providers.yml`에서 각 provider별 headless/assisted 템플릿을 설정 가능하게 한다.

예시:

```yaml
providers:
  claude:
    headless_cmd: 'claude -p @PROMPT_FILE --output-format json'
    assisted_hint: 'Claude Code 터미널에서 prompt.txt 내용을 붙여넣고 result.json 저장'

  codex:
    headless_cmd: 'codex exec --json --output-schema @SCHEMA_FILE -i @PROMPT_FILE'
    assisted_hint: 'Codex 터미널에서 실행 후 최종 JSON을 result.json에 저장'

  gemini:
    headless_cmd: 'gemini -p @PROMPT_TEXT --output-format json'
    assisted_hint: 'Gemini CLI에서 prompt 실행 후 JSON 결과 저장'
```

> v0.1에서는 실제 각 CLI 옵션 차이는 사용자 환경에 따라 다를 수 있으므로,
> “명령 템플릿 주입”을 1순위로 둔다.

---

## 12. CLI 커맨드 스펙(v0.1)

### 12.1 워크플로우/실행

- `orch init`
  - `.orch/` 기본 구조 생성

- `orch run [--workflow <path>] [--profile plan=committee ...] [--set key=value] [--assign stage=provider:role] [--mode assisted|headless]`
- `orch resume <runId>`
- `orch status <runId>`
- `orch logs <runId> [--follow]`

### 12.2 Role 관리

- `orch role list`
- `orch role add <id> [--from <template>]`
- `orch role edit <id>`
- `orch role rm <id>`

### 12.3 Stage Profile 관리

- `orch profile list`
- `orch profile set plan=committee`
- `orch profile edit plan@committee`

### 12.4 Provider/Assignment

- `orch provider list`
- `orch assign show`
- `orch assign set plan=claude:planner`
- `orch assign set test=gemini:tester`

---

## 13. 완료체크(Check) 표준 스키마(v0.1 권장)

Check는 상위 루프 제어를 하므로 필수 필드가 있다.

```json
{
  "done": false,
  "summary": "현재 상태 요약",
  "reasons": ["테스트 실패", "요구사항 미충족"],
  "recommended_next_stage": "code",
  "required_fixes": [{ "file": "src/a.ts", "action": "fix", "detail": "..." }]
}
```

- `done`(boolean): true면 종료
- `recommended_next_stage`(string, optional): 되돌아갈 stage
- `required_fixes`(array, optional): 다음 stage에서 참고할 수정 포인트

---

## 14. 에러 처리 정책(v0.1)

- 스키마 검증 실패:
  1. 동일 provider 재시도 N회
  2. 실패 시 Assisted 모드로 전환(사용자 개입)

- provider 실행 실패:
  - 표준 에러 로그 저장(raw.txt)
  - 노드 상태를 failed로 마킹 후 정책에 따라 재시도/중단

- max_iters 초과:
  - run을 failed로 종료
  - 마지막 check 결과/상태 로그를 강조 출력

---

## 15. 성공 지표(Acceptance Criteria)

### AC1 — 기본 골격 동작

- plan→code→test→check 흐름이 실행되며, check.done=true면 종료된다.

### AC2 — Stage 내부 N개 실행 + 합성

- plan@committee에서 foreach로 3개 노드가 실행되고 reduce(run synthesize)로 단일 plan 결과가 export된다.

### AC3 — 동적 할당

- 같은 workflow라도 `--assign code=codex:coder`로 실행 시 code 단계 provider가 바뀐다.

### AC4 — Role CRUD

- role add/edit/rm가 파일 기반으로 동작하고, 실행에 반영된다.

### AC5 — Resume

- 실행 도중 중단 후 `orch resume <runId>`로 이어서 진행된다.

---

## 16. 출시 계획(Milestones)

### M0 (1차) — DSL/저장구조/Assisted 모드

- `.orch/` 구조 생성
- workflow.yml + stage profile graph 로드
- foreach 확장 + export 생성
- Assisted 모드(프롬프트 생성, 결과 파일 감시)
- JSON Schema 검증
- run/resume/status/logs

### M1 (2차) — Headless 모드(부분 지원)

- subprocess 실행기 도입
- provider 템플릿 기반 실행
- 실패 시 assisted fallback

### M2 (3차) — UX 개선

- `orch run -i` (간단 TUI)
- profile/assign 편의 기능
- 이벤트/로그 시각화(간단)

---

## 17. 오픈 이슈/결정 필요사항

1. 표현식/조건식(Branch, stop_when)의 최소 문법 범위(JSONPath subset vs custom)
2. 병렬 실행(concurrency) 우선 지원 여부(v0.1에 넣을지)
3. provider별 “결과 JSON을 어떻게 안정적으로 얻을지”
   - headless에서 결과 파싱 실패 시 정책

4. 역할 템플릿 엔진 선택(Handlebars/Mustache 등) 및 escaping 규칙
5. Windows/WSL/맥 환경에서의 파일 감시 방식 통일

---

## 18. 부록: Stage Profile 샘플(추천 세트)

- plan@simple: run(planner) → export
- plan@committee: foreach(arch/tasks/risks) → run(synth) → export
- code@simple: run(coder) → export
- code@review-loop: run(coder) → run(reviewer) → run(improve) → export
- test@smoke: run(smoke_tester) → export
- test@deep: foreach(unit/integration/security) → run(synth_test_report) → export
- check@gate: run(checker) → export

---

```

원하시면 다음 단계로, 위 PRD 기준 **실제 템플릿 파일 세트**(roles/*.md, schemas/*.json, workflows/*.yml, providers.yml 기본값)까지 한 번에 “초기 스캐폴딩” 형태로 같이 작성해드릴게요.
::contentReference[oaicite:0]{index=0}
```
