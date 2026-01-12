# Desktop UI 개선 계획 (PRD v2 기반)

## 1. 개요 (Overview)
`CodeCafe Manager`를 **"Desktop-First"** 애플리케이션으로 전환하여, 사용자가 외부 터미널 없이도 여러 프로젝트(Cafe)를 관리하고 AI 워크플로우를 오케스트레이션할 수 있도록 합니다.

## 2. 핵심 UI 모듈 (Screens)

### 2.1 Global Lobby (The Cafe Street)
**목표**: 여러 Git 프로젝트("Cafes")를 한눈에 관리합니다.
-   **구조**: 카드 그리드 레이아웃.
-   **카드 내용**:
    -   Cafe 이름 (Repo 이름)
    -   경로 (로컬 경로)
    -   활성 주문 배지 (예: "3 Brewing")
    -   Repo 상태 (브랜치명, Dirty/Clean 여부)
-   **액션**:
    -   `Add Cafe`: 폴더 선택 다이얼로그로 로컬 폴더 등록.
    -   `Enter`: 카드를 클릭하여 해당 Cafe 대시보드로 이동.

### 2.2 Cafe Dashboard (Inside a Cafe)
**목표**: 특정 프로젝트 내의 주문(Order)을 관리합니다.
-   **레이아웃**: 사이드바(메뉴/글로벌 네비게이션) + 메인 콘텐츠 영역 + 컨텍스트 사이드바(선택 사항).
-   **주문 목록 (Kanban/List)**:
    -   컬럼: `대기중(Pending)`, `진행중(Brewing)`, `완료(Served)`, `실패(Failed)`.
    -   주문 카드: ID, 레시피 이름, 시작 시간, 현재 단계.
-   **빠른 액션**: "새 주문(New Order)" 버튼 (FAB 또는 우측 상단).
    -   `주문 생성 모달`을 엽니다.

### 2.3 주문 생성 및 Role 매핑 (The Kiosk)
**목표**: 새로운 실행 설정 및 에이전트 할당.
-   **1단계: 레시피 선택**: 워크플로우(YAML) 선택.
-   **2단계: Role/Barista 할당**:
    -   각 Stage(Plan, Code, Test...)별로 **어떤 Barista(Agent)**를 투입할지 설정.
    -   `Barista` = `Role`(템플릿) + `Provider`(사용할 터미널 타입).
    -   예: Code 단계 -> `Coder` Role을 가진 Barista 2명 생성 (Provider: Codex).
-   **3단계: 입력(Inputs)**: 이슈 내용 등 입력.

### 2.4 실시간 오더 뷰 & 컨텍스트 (The CCTV)
**목표**: 실행 관측 및 공유 메모리 확인.
-   **분할 뷰 (Split View)**:
    -   **왼쪽 (프로세스)**: Barista(Agent)들의 작업 흐름(DAG) 시각화.
    -   **중앙 (터미널)**: 실제 할당된 Terminal의 PTY 그리드.
        -   *참고*: Barista N명이 Terminal M개를 공유할 수 있음 (Queuing).
    -   **오른쪽 (Context/Memory)**:
    -   **오른쪽 (Context/Memory)**:
        -   현재 Worktree의 공유 컨텍스트 파일(`context.md` 등)을 실시간 렌더링.
        -   에이전트들이 서로 어떤 정보를 주고받는지 확인 가능.

### 2.5 Role 매니저 (Agent Studio)
**목표**: 에이전트(Role) 템플릿 관리.
-   **목록**: 기본 Role(Planner, Coder...) 및 커스텀 Role.
-   **에디터**:
    -   System Prompt 편집.
    -   사용 가능 Skills(Tools) 연결.
    -   Provider 추천 설정.

### 2.6 설정 및 Provider 연결
**목표**: 앱 내 인증 (In-App Authentication).
-   **Provider 목록**: Claude, Codex 등.
-   **연결 워크플로우**:
    -   "Connect Claude" 클릭.
    -   **내장 터미널 컴포넌트** (xterm.js) 열림.
    -   자동으로 `claude login` 실행.
    -   사용자가 해당 창 내에서 인증 상호작용 수행.
    -   성공 종료 코드 감지 시 -> "연결됨(Connected)" 상태로 표시.

## 3. 컴포넌트 아키텍처 (Atomic UI)
이를 지원하기 위해 강력한 컴포넌트 라이브러리(`packages/ui`)가 필요합니다.

-   **Atoms**: `Button`, `Input`, `Badge`, `Card`, `Spinner`.
-   **Molecules**: `RepoCard`, `OrderCard`, `LogViewer` (xterm.js 래퍼).
-   **Organisms**: `OrderList`, `RecipeForm`, `TerminalGrid`.
-   **Templates**: `LobbyLayout`, `DashboardLayout`.

## 4. 추천 기술 스택
-   **프레임워크**: React (기존).
-   **스타일링**: TailwindCSS (기존) + `shadcn/ui` (빠르고 고품질의 컴포넌트 구축을 위해 추천).
-   **상태 관리**: Zustand (Cafes, Orders 전역 스토어).
-   **터미널**: `xterm.js` + `xterm-addon-fit`.
-   **아이콘**: Lucide React.
