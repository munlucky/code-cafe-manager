# CodeCafe Orchestrator 사용자 가이드

## 소개

CodeCafe Orchestrator는 복잡한 AI 코딩 워크플로우를 관리하기 위해 설계된 강력한 엔진입니다. 작업을 단계별(Plan, Code, Test, Check)로 나누고, 각 단계에 고유한 AI 역할을 할당하여 자동 또는 대화형으로 실행할 수 있습니다.

## 시작하기

### 설치

Orchestrator는 CodeCafe에 통합되어 있습니다. 최신 버전이 설치되어 있는지 확인하세요.

### 초기화

워크플로우를 실행하기 전에 Orchestrator 구성을 초기화해야 합니다:

```bash
codecafe-orch init
```

이 명령은 현재 폴더에 `.orch` 디렉토리를 생성하며 다음을 포함합니다:
- `workflows/`: 워크플로우 정의
- `config/`: 설정 파일 (`assignments.yml`)
- `roles/`: 역할 템플릿

## 워크플로우 실행

### 기본 실행

워크플로우(예: `feature-dev`)를 실행하려면:

```bash
codecafe-orch run feature-dev
```

### 대화형 모드 (TUI)

실시간 시각화를 포함한 더 나은 경험을 위해:

```bash
codecafe-orch run feature-dev -i
```

이 명령은 다음을 보여주는 터미널 UI를 엽니다:
- 현재 단계 및 반복(Iteration)
- 각 노드의 상태 (실행 중, 완료, 실패)
- 실시간 로그 및 이벤트

### 실행 재개 (Resuming)

실행이 실패하거나 일시 중지된 경우 Run ID를 사용하여 재개할 수 있습니다:

```bash
codecafe-orch resume <RUN_ID>
```

## 구성 (Configuration)

### 할당 (Assignments)

각 단계에 다른 제공자(Claude, Codex)와 프로필을 할당할 수 있습니다.

**할당 목록 보기:**
```bash
codecafe-orch assign list
```

**할당 설정:**
```bash
# 'plan' 단계를 'claude-code' 제공자와 'planner' 역할로 설정
codecafe-orch assign set plan claude-code planner
```

### 프로필 (Profiles)

프로필은 단계의 그래프 복잡도(예: `simple`, `committee`)를 정의합니다.

**프로필 설정:**
```bash
codecafe-orch profile set code simple
```

## 로그

로그는 `.orch/runs/<RUN_ID>/events.jsonl`에 저장됩니다. CLI를 통해 확인할 수 있습니다:

```bash
codecafe-orch logs <RUN_ID>
```
