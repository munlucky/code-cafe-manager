# PRD.md — CodeCafe Manager (repo: `codecafe`)

> **요약**: `codecafe`는 AI CLI(우선 Claude Code, 이후 Codex/Gemini/Grok)를 “바리스타(독립 실행 엔진)”로 여러 개 띄워, YAML “레시피(워크플로우)”대로 **병렬 실행·관측·관리**하는 크로스플랫폼(Electron + CLI) 오케스트레이터입니다.  
> **코어는 CLI**, **운영/관측은 Electron UI(CodeCafe Manager)** 가 담당합니다.

- CLI 바이너리 이름: **`codecafe`**
- 기본 워크플로우(하우스 블렌드): **`pm-agent`**
  - 소스(기본값): `https://github.com/munlucky/claude-settings/blob/main/.claude/agents/pm-agent.md`

---

## 0) 공통 정의 (모든 M 공통)

### 0.1 목표(Goals)
1. 개발자가 이미 쓰는 AI CLI 세팅을 존중하면서, **재현 가능한 워크플로우**로 표준화한다.
2. 로컬 PC에서 **바리스타 N개(=CLI 엔진 N개)** 를 안정적으로 운영한다.
3. 워크플로우 정의는 **YAML**로 통일하고, UI는 YAML을 **편집/검증/시각화/실행**한다.
4. **macOS / Linux / Windows** 동일 경험을 제공한다.
5. 확장 가능한 Provider(Beans) 구조로 Claude→Codex→Gemini/Grok 순으로 확장한다.

### 0.2 비목표(Non-goals, 초기)
- 서버형 분산 오케스트레이션(클러스터, K8s 스케줄링)
- 완전 자동 병합/배포 파이프라인(프로덕션 CD 수준)
- 모델 결제/권한 통합(각 CLI의 auth를 그대로 사용, API는 옵션)

### 0.3 카페 컨셉 용어집(Glossary)
- **Manager**: Electron UI “CodeCafe Manager” (바리스타/주문/로그/상태를 통합 운영)
- **Barista(바리스타)**: 코어 실행 유닛. 독립 프로세스/PTY 세션 1개(=CLI 엔진 1개)
- **Menu(메뉴)**: 워크플로우 템플릿 목록(기본 pm-agent 포함)
- **Recipe(레시피)**: YAML 워크플로우 정의 파일
- **Order(주문)**: 레시피 실행 1회 인스턴스(실행 ID)
- **Beans(원두)**: Provider(claude-code, codex, …)
- **Counter(카운터)**: 실행 대상 프로젝트(폴더/repo/worktree)
- **Receipt(영수증)**: 실행 결과 요약(상태/로그/변경 파일/에러/다음 액션)

### 0.4 공통 아키텍처(요약)
- `codecafe`는 **1) CLI 코어** + **2) Electron UI** + **3) Provider 플러그인**으로 구성
- UI는 바리스타 프로세스를 N개 spawn하고, 표준출력/에러/상태 이벤트를 수집해 표시
- 병렬 실행은 “바리스타 풀 + 주문 큐”로 운영

#### 0.4.1 패키지 구조(제안)
```
codecafe/
  packages/
    core/              # 도메인 모델, 레시피 엔진, 이벤트 모델
    cli/               # codecafe CLI
    desktop/           # Electron (CodeCafe Manager)
    providers/
      claude-code/
      codex/
    git-worktree/      # worktree 도우미(옵션)
    schema/            # YAML schema, JSON schema, validation
  recipes/
    house-blend/
      pm-agent.yaml    # pm-agent 실행을 위한 기본 래퍼 레시피(옵션)
  docs/
```

### 0.5 워크플로우 YAML(Recipe) 최소 스펙 v0
- DAG 기반(의존성), 병렬 그룹, 재시도/타임아웃, 변수, provider 지정

```yaml
name: "house-blend-pm-agent"
version: "0.1.0"
defaults:
  provider: "claude-code"
  workspace:
    mode: "in-place"      # in-place | worktree | temp
inputs:
  counter: "."            # 실행 디렉토리
vars:
  issue: ""
steps:
  - id: pm_agent_session
    type: "ai.interactive"
    provider: "claude-code"
    agent_ref:
      type: "github"
      url: "https://github.com/munlucky/claude-settings/blob/main/.claude/agents/pm-agent.md"
    prompt: |
      {{ issue }}
    timeout_sec: 7200
```

> **중요 설계 원칙**: pm-agent의 내부 문법을 `codecafe`가 “해석”하려고 하기보다,  
> “해당 agent 파일을 설치/참조하고 Claude Code를 그 agent로 실행”하는 방식으로 통합합니다.  
> (즉, `codecafe`는 **오케스트레이션/병렬/관측**에 집중)

---

# M1 PRD — MVP (Claude Code + pm-agent + Barista Pool + 기본 UI)

## M1.1 M1 목표
- “설치 → 바로 실행”이 되는 최소 제품
- Claude Code 기반으로 pm-agent를 기본 메뉴로 제공
- 바리스타 N개(최소 4개) 병렬 실행 + UI에서 통합 모니터링
- YAML 레시피 v0 + UI에서 최소 편집/검증 + 실행

## M1.2 사용자 시나리오 (M1)
1) **CLI 단독 실행**
- 개발자가 repo 폴더에서:
  - `codecafe init`
  - `codecafe run --issue "..."` (기본 pm-agent)

2) **UI 병렬 실행**
- UI에서 바리스타 4개 생성 → 주문 4개를 동시에 실행 → 로그/상태 확인

## M1.3 범위(Scope)

### Must (필수)
#### (A) CLI
- `codecafe init`
  - CodeCafe 전역 설정 디렉토리 생성(예: `~/.codecafe/`)
  - 기본 메뉴 등록: pm-agent 소스 URL 저장
  - (옵션) 사용자가 선택하면 프로젝트 `.claude/agents/`에 agent 파일을 설치할 수 있게 안내
- `codecafe run`
  - 레시피 지정 없으면 “하우스 블렌드(pm-agent)”로 실행
  - `--counter`(기본 `.`), `--issue`(문자열), `--provider`(기본 `claude-code`) 지원
- `codecafe ui`
  - Electron 앱 실행
- `codecafe doctor`
  - claude CLI 존재 여부, git 존재 여부, 권한/환경 기본 점검

#### (B) Provider(Beans): Claude Code 1종
- Provider: `claude-code`
- 요구사항:
  - 설치/인증은 사용자가 기존 방식으로 수행(인터랙티브 터미널 지원)
  - `codecafe`는 PTY로 Claude Code 프로세스를 실행하고 로그 스트리밍

#### (C) Barista Pool (병렬 코어)
- 바리스타 프로세스 N개 생성/종료/재시작
- 바리스타 상태: `IDLE | RUNNING | ERROR | STOPPED`
- 주문(Order) 실행:
  - “바리스타 1개 = 주문 1개” (M1에서는 단순 매핑)
  - UI에서 주문 생성 시 idle 바리스타에 할당(없으면 큐 대기)

#### (D) Electron UI (Manager) — 최소 화면 3종
1. **Dashboard**
   - 바리스타 리스트(상태/현재 주문)
   - 주문 리스트(상태/시작 시간/종료 시간/에러)
2. **New Order**
   - Menu 선택(기본 pm-agent 고정 1개로 시작)
   - Counter 선택(폴더 선택)
   - issue 입력
   - 실행 버튼
3. **Order Detail**
   - 실시간 로그 스트리밍
   - Stop/Restart
   - Receipt(결과 요약) 보기

#### (E) 저장/관측
- 주문/바리스타 메타데이터: 로컬 SQLite 또는 JSON(택1, M1은 JSON도 가능)
- 로그: 주문별 `logs/<orderId>.log` 저장 + UI tail
- Receipt: 최소 필드
  - `orderId`, `status`, `startedAt`, `endedAt`, `provider`, `counter`, `errorSummary(옵션)`

### Should (권장)
- YAML 레시피 편집기(텍스트 기반 + 검증 결과 표시 정도)
- 위험 명령 경고(룰 기반 최소)

### Won’t (M1 제외)
- Codex/Gemini/Grok Provider
- Git worktree 모드/병합 UX
- 레시피 DAG 시각화(그래프)
- API 모드

## M1.4 수용 기준(Acceptance Criteria)
1. (CLI) macOS/Windows에서 `codecafe init` → `codecafe run --issue "hello"` 실행이 가능하다.
2. (UI) 바리스타 4개 생성 후 주문 4개를 병렬 실행할 수 있고,
   - 각 주문 로그가 UI에서 실시간으로 보인다.
3. (안정성) 한 바리스타 프로세스가 오류로 종료되어도 다른 주문/바리스타는 계속 실행된다.
4. (재시작) UI에서 특정 주문을 Stop 후 같은 파라미터로 Restart 가능하다.
5. (기본 메뉴) New Order에서 기본 메뉴가 “pm-agent(하우스 블렌드)”로 선택되어 있다.

## M1.5 산출물(Deliverables)
- `codecafe` CLI (macOS/Windows/Linux 빌드)
- CodeCafe Manager(Electron) 데스크톱 앱 (macOS/Windows/Linux 빌드)
- Provider: claude-code
- 최소 YAML 스펙 v0 + 검증

---

# M2 PRD — Codex + Git worktree 병렬 + Recipe Studio(폼/검증/프리뷰) 고도화

## M2.1 M2 목표
- Codex Provider 추가
- 한 repo에서 **worktree 기반 브랜치 병렬** 실행
- UI에서 레시피를 “폼 기반”으로 편집하고 YAML로 저장/검증
- DAG 시각화(최소 수준) + 재시도/타임아웃/병렬 그룹 지원 강화

## M2.2 범위(Scope)

### Must
#### (A) Provider(Beans): Codex 추가
- `codex` CLI 프로세스 실행/로그 스트리밍
- Provider 선택 UI 제공(claude-code / codex)

#### (B) Git worktree 모드
- 레시피 또는 UI 주문 옵션에서 `workspace.mode=worktree`
- 기능:
  - worktree 생성: baseBranch에서 새 브랜치 생성 + worktree 폴더 생성
  - 주문 종료 시 정리 옵션(clean)
  - worktree별 산출물 수집(최소: diff/patch export)
- UI:
  - Worktree 목록(주문별 worktree 경로, 브랜치명, 상태)
  - “패치 내보내기” 버튼

#### (C) Recipe Studio(폼 + YAML)
- UI에서 step 추가/삭제/의존성 설정
- YAML 실시간 검증(스키마/필수 필드/타입)
- 레시피 저장소(로컬 폴더) 관리: list/add/edit/delete

#### (D) 실행 엔진 고도화
- `parallel` step 지원(하위 steps 병렬 실행)
- `retry`, `timeout_sec` 지원

### Should
- DAG 시각화(노드/엣지 정도) + 실패 노드 하이라이트
- Receipt에 “변경 파일 요약(간단)” 포함

### Won’t (M2 제외)
- Gemini/Grok Provider
- API 모드
- 자동 병합(merge) 완전 자동화

## M2.3 수용 기준(Acceptance Criteria)
1. Codex Provider로도 주문 실행/로그 스트리밍이 가능하다.
2. worktree 모드로 같은 repo에서 3개 주문을 병렬 실행할 수 있다.
3. 주문 종료 후 patch export가 가능하고, 원본 repo는 깨끗한 상태를 유지한다.
4. Recipe Studio에서 폼으로 만든 레시피가 YAML로 저장되고, CLI로도 실행된다.

---

# M3 PRD — Provider 플러그인 확장(Gemini/Grok) + API 옵션 + 템플릿 공유/레지스트리

## M3.1 M3 목표
- Provider 플러그인 구조를 안정화하여 Gemini/Grok 등 확장 가능
- “API 모드(옵션)” 지원(서버/CI 등 CLI 없는 환경 대비)
- 레시피 템플릿 공유(레지스트리)와 가져오기/업데이트 UX
- 운영 기능: 비교/선택/리포트 고도화

## M3.2 범위(Scope)

### Must
#### (A) Provider 플러그인 프레임워크
- Provider 인터페이스 표준화:
  - `spawnInteractive()`, `runPrompt()`, `validateEnv()`, `authHint()` 등
- Provider 설치/활성화 UI

#### (B) API 모드(옵션)
- 최소 1개 Provider에서 API 모드 지원(예: Codex API or Gemini API)
- 키 저장: OS Keychain/Windows Credential Manager 연동(가능 범위 내)

#### (C) Recipe Registry (템플릿 공유)
- 로컬 레지스트리(폴더/깃) + 원격(깃 URL) 등록
- 템플릿 버전/업데이트(핀/체크섬) 지원

### Should
- 결과 비교(여러 worktree 결과 diff/테스트 결과 비교) UI
- Receipt 리포트(HTML/Markdown export)

### Won’t (M3 제외)
- 원격 분산 실행(서버/에이전트 팜)
- 엔터프라이즈 권한/SSO 수준 통합

## M3.3 수용 기준(Acceptance Criteria)
1. Provider 플러그인을 추가/활성화/비활성화 할 수 있다.
2. API 모드로 최소 1개 Provider가 동작하며, 키가 안전하게 저장된다.
3. 레시피 템플릿을 원격(깃 URL)에서 가져와 실행하고, 버전 업데이트가 가능하다.

---

## 리스크 & 대응(요약)
- **PTY/프로세스 제어의 OS 차이**: node-pty 기반으로 추상화 + e2e 테스트(Windows 포함)
- **CLI 인증/로그인 흐름 다양성**: “내장 터미널” 제공 + doctor로 진단/가이드
- **레시피의 안전성**: 위험 명령 경고/정책(기본 Off → 팀 설정으로 On 가능)
- **공급망(레시피 원격 동기화)**: 핀 버전 + 체크섬 + 수동 승인 흐름

---

## 오픈 이슈(Open Questions)
1) pm-agent를 프로젝트 `.claude/agents/`에 “복사”할지 “참조만” 할지의 기본 정책  
2) 바리스타=주문 1:1 매핑을 언제 “바리스타가 여러 주문을 순차 처리(큐)”로 확장할지  
3) 레시피 스펙 v0의 최소 step type 확정(ai.prompt vs ai.interactive 구분 기준)  
