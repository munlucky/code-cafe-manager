# @codecafe/orchestrator

CodeCafe를 위한 멀티 AI CLI 오케스트레이터입니다. 이 패키지는 여러 역할, 제공자, 단계가 포함된 복잡한 AI 워크플로우를 관리하기 위한 엔진과 CLI를 제공합니다.

## 주요 기능

- **워크플로우 엔진**: DAG를 지원하는 FSM 기반 워크플로우 실행 엔진.
- **다중 역할(Multi-Role)**: 각 단계에 서로 다른 AI 페르소나(기획자, 개발자, 테스터) 할당 가능.
- **제공자 불가지론(Provider Agnostic)**: `headless` 또는 `assisted` 모드를 통해 Claude Code, Codex 등 다양한 제공자 지원.
- **TUI**: 실행 상태를 모니터링할 수 있는 대화형 터미널 UI (`codecafe-orch run -i`).
- **Electron 통합**: 데스크톱 애플리케이션 통합을 위한 API 제공.

## 사용법

### CLI

```bash
# .orch 디렉토리 초기화
codecafe-orch init

# 워크플로우 실행
codecafe-orch run my-workflow

# 대화형 모드로 실행
codecafe-orch run my-workflow -i

# 할당(Assignment) 관리
codecafe-orch assign set plan claude-code planner

# 프로필(Profile) 관리
codecafe-orch profile set code deep-think
```

## 아키텍처

- **Engine**: `src/engine/` - FSM 및 DAG 실행 로직.
- **Storage**: `src/storage/` - 실행 상태 및 이벤트 로그 (JSON/JSONL).
- **UI**: `src/ui/` - Ink 기반 TUI 및 Electron IPC 핸들러.
- **CLI**: `src/cli/` - 명령어 정의.

## 통합 (Integration)

Electron 또는 기타 컨슈머와 통합하려면 `registerElectronHandlers`를 사용하세요:

```typescript
import { registerElectronHandlers } from '@codecafe/orchestrator';
registerElectronHandlers(ipcMain, orchDir);
```
