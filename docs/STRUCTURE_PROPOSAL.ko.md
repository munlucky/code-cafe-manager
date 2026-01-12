# 구조 개선 제안서 (Structure Improvement Proposal)

## 1. 현재 구조 분석
현재 프로젝트는 `pnpm workspace`를 이용한 모노레포로 잘 구성되어 있습니다.
- `packages/core`: 핵심 로직 및 타입정의?
- `packages/orchestrator`: 메인 엔진 (오케스트레이터).
- `packages/cli`: CLI 인터페이스.
- `packages/desktop`: Electron 기반 UI.

## 2. 문제점 및 개선 제안

### (1) `@codecafe/core`와 `@codecafe/orchestrator` 역할 명확화
**문제**: `core`와 `orchestrator`에 각각 무엇이 들어가야 하는지 경계가 모호합니다.
**제안**:
- **Strict Layering (추천)**: `core`는 "공유 계약(Shared Contracts)" 라이브러리로 유지합니다.
    - `core`: 공유 인터페이스, 타입(WorkflowDefinition, RunState, NodeResult 등), 부수 효과가 없는 순수 유틸리티 함수.
    - `orchestrator`: 상태 머신, 파일 I/O, 프로세스 실행 로직 등 실제 엔진 구현체.
- **병합 옵션**: 만약 `core` 패키지가 너무 얇다면 `orchestrator`로 병합하는 것도 방법입니다.

### (2) `packages/schema`를 `packages/core`로 통합
**문제**: JSON Schema만을 위한 별도의 패키지는 관리 오버헤드가 발생할 수 있으며, `core`의 타입 정의와 밀접하게 연동되어야 합니다.
**제안**: `packages/schema`의 내용을 `packages/core/src/schema`로 이동합니다. 이를 통해 TypeScript 타입과 런타임 검증용 JSON Schema를 함께 관리할 수 있습니다.

### (3) Provider 인터페이스 표준화
**문제**: `packages/providers` 하위의 어댑터들이 산재해 있습니다.
**제안**:
- `packages/core`에 명확한 `Provider` 인터페이스를 정의합니다.
- 모든 Provider는 다음을 구현해야 합니다:
    - `generatePrompt(role, input)`: 프롬프트 생성 로직
    - `parseOutput(rawOutput)`: 출력 파싱 및 JSON 변환
    - `getCommand(mode: 'assisted'|'headless')`: 실행 명령 생성

### (4) UI 컴포넌트의 원자화 (Atomic UI)
**문제**: Desktop UI 로직이 비대해질 수 있습니다.
**제안**: Electron 앱뿐만 아니라 향후 웹 뷰나 웹 앱에서도 공유할 수 있는 `packages/ui` (또는 디자인 시스템) 패키지 신설을 고려합니다.
> **참고**: 상세 UI 개선 계획은 `docs/UI_IMPROVEMENT_PLAN.md`를 참고하십시오.


## 3. 제안하는 디렉토리 구조

```
packages/
├── core/                  # [타입 및 계약]
│   ├── src/
│   │   ├── types/         # Workflow, Run, Node 관련 타입
│   │   ├── schema/        # Zod 또는 JSON 스키마 (packages/schema 통합)
│   │   └── interfaces/    # Provider 인터페이스 정의
├── orchestrator/          # [메인 엔진]
│   ├── src/
│   │   ├── engine/        # DAG 실행 로직
│   │   ├── agent/         # [NEW] Barista(Logical Agent) 상태 및 로직
│   │   ├── session/       # [NEW] Terminal(Provider Process) 세션 관리 (Pool)
│   │   ├── state/         # 상태 유지 및 .orch 관리
│   │   └── runner/        # (Legacy) -> session으로 대체 예정
├── providers/             # [어댑터]
│   ├── claude-code/
│   ├── codex/
│   └── common/            # Provider 공동 로직
├── cli/                   # [인터페이스: CLI]
│   └── src/commands/      # run, init, doctor 등
├── desktop/               # [인터페이스: GUI]
│   ├── src/
│   │   ├── main/          # Electron 메인 프로세스 (Orchestrator 호출)
│   │   └── renderer/      # React UI
├── roles/                   # [Role 레지스트리 (기본값)]
│   ├── planner.md
│   ├── coder.md
│   └── reviewer.md
├── git-worktree/          # [유틸리티]
```

## 4. 추가 고려사항 (Roles & Context)
-   **Context StoreImpl**: Worktree 내부의 `.codecafe/context/` 디렉토리를 파일 기반 DB처럼 활용하는 로직은 `orchestrator`에 포함되어야 합니다.
-   **Role Management**: `packages/roles` (또는 `core/roles`)에 기본 에이전트 템플릿(Plan/Code/Test/Review)을 포함하고, 사용자가 이를 오버라이드할 수 있는 구조가 필요합니다.

