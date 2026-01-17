# CodeCafe Desktop - Claude CLI 터미널 개선 릴리즈 노트 (v1.1.0)

## 1) 개요
이번 릴리즈는 Desktop(Electron) 앱에서 Order 실행 시 Claude CLI가 안정적으로 초기화되고,
출력 스트리밍/사용자 입력 상호작용이 정상 동작하도록 개선한다.

**구현 완료일:** 2026-01-18

문서 기준 실행 구조:
UI(Renderer) → IPC(Main) → Orchestrator → ExecutionManager → BaristaEngineV2 → TerminalPool → ClaudeCodeAdapter → node-pty

핵심 개선 대상:
ClaudeCodeAdapter.spawn() 초기화(pty.spawn → claude 실행 → 프롬프트 감지)

## 2) 사용자 영향(What's improved)

### 2-1) 초기화 안정성 향상
- **타임아웃 증가**: waitForPrompt 타임아웃이 10초에서 20초로 증가하여 느린 환경에서도 안정적으로 초기화
- **Activity-based 연장**: 데이터가 도착할 때마다 타임아웃이 리셋되어, 활성화된 세션은 중단 없이 계속 실행
- **프롬프트 감지 개선**: 유니코드 화살표(›, », ❯)와 대소문자 무시 패턴으로 더 강력한 프롬프트 감지

### 2-2) CI 정책 변경 (대화형 모드 기본 활성화)
- **기본값 변경**: `CI=false`가 기본값이 되어 대화형 모드가 활성화됨
- **명시적 설정**: `forceCI=true` 옵션을 통해 비대화형 모드로 명시적으로 전환 가능
- 이로 인해 CLI의 자연스러운 프롬프트 형식을 유지하여 초기화 감지 안정성 향상

### 2-3) 실패 시 프로세스 정리(좀비 방지)
- spawn 실패 시 PTY 프로세스가 자동으로 정리되어 좀비 프로세스 방지
- 정리 실패 시에도 로그가 남아 문제 추적 가능

### 2-4) 1회 재시도 정책
- 초기화 타임아웃 발생 시 1회 자동 재시도 (300~800ms 랜덤 backoff)
- PATH 오류, 인증 오류 등 명확한 실패는 즉시 실패 처리(fail-fast)

### 2-5) PATH 문제에 대한 fail-fast
- `claude` 커맨드가 PATH에서 발견되지 않으면 빠르게 실패하고 명확한 오류 메시지 제공
- `CLAUDE_CODE_PATH` 환경변수 사용 안내

## 3) 신규/변경된 설정(Flags / Environment Variables)

### 3-1) `CLAUDE_CODE_PATH` (환경변수)
**용도**
- Desktop 앱에서 띄운 셸 환경(bash/powershell)에서 `claude`를 PATH로 찾지 못하는 경우,
  `claude` 바이너리의 절대 경로를 지정해 실행 가능하게 함.

**예시**
- macOS/Linux:
  - `export CLAUDE_CODE_PATH="/usr/local/bin/claude"`
- Windows PowerShell:
  - `$env:CLAUDE_CODE_PATH="C:\\Users\\me\\AppData\\Local\\Programs\\claude\\claude.exe"`

**변경점**
- 기존: PATH 가정 실패 시 waitForPrompt timeout으로만 보일 수 있었음
- 개선: 실행 전 검증/명확한 오류 메시지 제공 + `CLAUDE_CODE_PATH` 사용 안내

### 3-2) `CI` 처리 정책 변경
**변경 내용**
- 기존: `CI=true`가 강제로 설정되어 비대화형 모드
- 변경: `CI=false`가 기본값 (대화형 모드)
- 설정: `forceCI=true` 옵션으로 비대화형 모드 명시적 사용 가능

**유의**
- 대화형 모드 기본 활성화로 CLI의 자연스러운 출력/프롬프트 형식 유지
- 문제 발생 시 `forceCI=true`로 비교 테스트 가능

## 4) 마이그레이션/운영 가이드
### 4-1) 업데이트 후 바로 해야 할 것(권장)
1) 외부 터미널에서 `claude --version` / `claude` 실행 확인
2) 앱에서 order 실행 및 정상 작동 확인
3) 입력 대기 시나리오에서 sendInput 확인

### 4-2) 자주 발생하는 문제와 해결
- **문제**: "claude를 못 찾음"
  - **해결**: PATH 확인 → `CLAUDE_CODE_PATH` 지정 → 재시도
- **문제**: "초기화 timeout"
  - **해결**: 로그 확인하여 startup chunk 분석(로그인/권한/프롬프트 형식)
  - **해결**: `forceCI=true`로 비대교형 모드 시도
- **문제**: "출력은 나오는데 UI가 느림"
  - **해결**: 렌더링 최적화 (별도 이슈로 추적)

## 5) 변경 파일/영향 범위(개발자용 요약)
### Orchestrator/Terminal
- **ClaudeCodeAdapter** (`packages/orchestrator/src/terminal/adapters/claude-code-adapter.ts`):
  - `WAIT_TIMEOUT`: 10초 → 20초로 증가
  - `waitForPrompt`: Activity-based 타임아웃 연장 추가
  - `spawn`: PTY 정리 로직 추가, 1회 재시도 정책 구현
  - `forceCI`: 기본값 `false`로 변경 (`CI=true` 강제 제거)
  - 재시도 backoff: 300~800ms 랜덤

### Core Schema
- **ProviderTerminalConfigSchema** (`packages/core/src/schema/terminal.ts`):
  - `maxRetries`: 3 → 1로 변경 (1회 재시도 정책)

## 6) 호환성/리스크
- **CI 정책 변경**: 대화형 모드 기본 활성화로 출력 형태가 변경될 수 있음
  - 롤백 필요 시 `forceCI=true` 옵션 사용
- **타임아웃 증가**: 실패 감지까지 최대 40초 (20초 × 2회) 소요 가능
- **프롬프트 감지**: 오탐 가능성은 낮지만, 테스트 매트릭스로 검증 필요

## 7) 테스트/검증 링크
- `docs/claude-cli-terminal/06_test_matrix.md` 참고 (OS/셸별 테스트 + 재현 스크립트)
