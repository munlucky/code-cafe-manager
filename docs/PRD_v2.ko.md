# PRD.md — CodeCafe Manager (v3: Desktop-First & Cafe Scale)

> **요약**: `CodeCafe`는 로컬 CLI 기반의 **멀티 AI 오케스트레이션 플랫폼**입니다.  
> 사용자는 **CodeCafe Manager(Desktop)**를 통해 여러 프로젝트(**Cafe**)를 등록하고, 각 프로젝트에서 다수의 작업(**Order**)을 병렬로 생성·실행합니다.  
> 핵심은 `git-worktree`를 통한 **작업 공간 격리**와 **실시간 AI 터미널 관측**이며, 모든 흐름은 데스크톱 앱에서 완결됩니다.

---

## 1. 핵심 가치 및 목표

1.  **Desktop-First Experience**: 모든 플로우(설정, 실행, 모니터링)는 Desktop App에서 가능해야 합니다. CLI는 백그라운드 엔진 혹은 "초기 인증용" 보조 도구로 역할이 한정됩니다.
2.  **Project as a Cafe**: 하나의 Git Repository(프로젝트)를 **"Cafe"**라고 부릅니다. 사용자는 N개의 Cafe를 동시에 관리할 수 있습니다.
3.  **Isolation by Default**: 주문(Order) 생성 시, 자동으로 `git-worktree`를 생성하여 메인 브랜치를 오염시키지 않고 AI가 독립된 공간에서 작업하도록 보장합니다.
4.  **Parallel Orchestration**: 한 Cafe 내에서도 여러 주문(Order)이 동시에 돌아가며, 각 주문의 Provider(AI)들이 실시간으로 활동하는 모습을 "CCTV"처럼 관측할 수 있습니다.

---

## 2. 사용자 작업을 플로우 (User Workflow)

### 2.1 플로우 요약
1.  **Cafe Open (프로젝트 등록)**: 로컬 Git 프로젝트 폴더를 선택하여 CodeCafe에 등록.
2.  **New Order (주문 생성)**:
    -   Cafe 진입 -> "새 주문" 클릭.
    -   **Recipe(워크플로우)** 선택 (예: `feature-dev`, `bug-fix`, `code-review`).
    -   **Issue/Prompt** 입력.
3.  **Workspace Prep (작업 공간 확보)**:
    -   시스템이 자동으로 `git-worktree` 생성 (예: `order/123-feat-login`).
    -   해당 격리 공간으로 컨텍스트 복사.
4.  **Brewing (실행 및 관측)**:
    -   정의된 단계(Plan → Code → Test) 순차 실행.
    -   사용자는 Desktop UI에서 각 단계별 Provider(Claude/Codex 등)의 터미널 출력을 실시간 확인.
5.  **Serve (완료)**:
    -   작업 완료 후 결과 리포트 확인.
    -   `git worktree` 정리 또는 PR 생성.

---

## 3. 기능 명세 (Functional Requirements)

### 3.1 CodeCafe Manager (Desktop UI)
**[필수 화면 및 기능]**

#### (A) Global Lobby (Cafe Selection)
-   등록된 Cafe(프로젝트) 카드 리스트.
-   각 Cafe의 현재 활성 주문 수, 상태 요약 표시.
-   `Add Cafe`: 로컬 폴더 불러오기.

#### (B) Cafe Dashboard (Inside a Cafe)
-   **Order List**: 현재 진행 중/완료된 주문 목록 (Kanban 또는 List View).
-   **Create Order**:
    -   워크플로우 템플릿 선택.
    -   입력 폼 (변수, 요구사항).
    -   Provider 동적 할당 (Plan=Claude, Code=Codex 등).

#### (C) Order Live View (The Brewing Monitor)
-   **Workflow Graph**: 현재 어느 단계(Node)를 실행 중인지 시각화.
-   **Terminal Grid**: 실행 중인 Provider의 PTY(가상 터미널) 화면을 그대로 미러링.
    -   *Why?* 사용자는 AI가 실제로 타이핑하고 명령어를 치는 과정을 보고 싶어함.
-   **Intervention**: 일시 정지, 재시도, 또는 Assisted 모드 시 "직접 입력" 프롬프트 제공.

#### (D) Settings & Providers
-   **Embedded Terminal**: 초기 설정을 위한 내장 터미널 제공.
    -   *Q: 초기 AI CLI 인증은?*
    -   *A:* `claude login` 등 브라우저 인증이 필요한 경우, 데스크톱 앱 내 **"도구 설정"** 메뉴에서 내장 터미널을 열어 로그인 가이드를 제공하거나, 팝업으로 안내.

### 3.2 Core Engine (Orchestrator)
-   **Multi-Cafe Support**: 엔진은 여러 Cafe(루트 경로)의 컨텍스트를 동시에 메모리에 로드하지 않고, 요청 시 해당 Cafe의 `.orch` 설정을 읽어 구동.
-   **Git Worktree Manager**:
    -   Order 시작 전: `git worktree add ...` 자동 수행.
    -   Order 종료 후: 사용자 선택에 따라 `git worktree remove` 또는 유지.
-   **Resource Management (Terminal Pool)**:
    -   **Provider**: 각 AI CLI(Claude, Codex)는 "실행 가능한 환경(Terminal)"을 제공하는 공급자입니다.
    -   **Terminal**: Provider가 생성한 실제 프로세스/세션입니다. (Resource)
    -   **Barista (Agent)**: 특정 Role과 Context를 가진 "논리적 작업자"입니다. (Worker)
    -   **Mapping**: 실행 시점에 `Barista`가 `Terminal`을 할당받아(Lease) 프롬프트를 주입하고 작업을 수행합니다. 작업이 끝나면 Terminal은 반환되거나 재사용됩니다.


### 3.3 에이전트 및 컨텍스트 관리 (Agent & Context)
-   **Shared Context (Memory Board)**:
    -   각 Order(Worktree)마다 `.codecafe/run/context.md` 등의 파일 기반 공유 메모리 생성.
    -   모든 Barista(Provider)는 이 Context 파일을 읽고(Read) 쓸(Write/Append) 수 있어 협업 가능.
-   **Role System (Template & Skills)**:
    -   단순 프롬프트가 아닌 **Role(역할)** 단위로 관리.
    -   `Role` = `System Prompt Template` + `Skills(Tools DEFINITION)` + `Recommended Provider`.
    -   기본 Role 제공: `Planner`, `Coder`, `Tester`, `Reviewer`.
    -   사용자는 각 Stage(Plan, Code...)에 N개의 Role을 할당 가능 (예: Code 단계에 Coder 3명 + Reviewer 1명 병렬 배치).


---

## 4. 용어 정의 (Terminology Refined)

| 용어 | 설명 | 비고 |
| :--- | :--- | :--- |
| **Cafe** | 관리 대상 로컬 프로젝트 (Git Repo) | 1 Cafe = 1 Repo |
| **Order** | 하나의 작업 요청 (Workflow 실행 인스턴스) | Order ID 발급 |
| **Recipe** | 워크플로우 템플릿 (YAML 정의서) | Plan->Code->Test... |
| **Role** | 에이전트 역할 정의 (템플릿 + 스킬) | Planner, Coder, Reviewer |
| **Barista** | 실제 작업을 수행하는 **논리적 에이전트** | Role Instance (ex: Coder-1) |
| **Terminal** | 프롬프트가 전달되어 실행되는 물리적 **프로세스** | Provider Session (ex: Claude Process) |
| **Guest** | 사용자 (User) | |
| **Table** | 작업이 수행되는 격리 공간 | `git-worktree` 폴더 |

---

## 5. 초기 설정과 CLI의 역할
**"모든 것은 Desktop에서"** 원칙을 따릅니다.

1.  **CLI의 역할 축소**: `codecafe-cli`는 주로 CI/CD나 고급 사용자를 위한 Headless 모드 전용으로 남겨둡니다. 일반 사용자는 CLI를 직접 칠 필요가 없습니다.
2.  **Provider 인증 (초기 세팅)**:
    -   Claude Code, OpenAI CLI 등은 최초 1회 `login` 명령어가 필요합니다.
    -   CodeCafe Desktop은 **"Settings > Providers"** 탭을 제공합니다.
    -   여기서 [Connect Claude] 버튼을 누르면 내부적으로 `node-pty`를 통해 터미널을 띄워 인증 링크를 보여주거나 브라우저를 엽니다.
    -   즉, 사용자는 별도 터미널 앱을 켤 필요 없이 CodeCafe 안에서 인증까지 마칩니다.
