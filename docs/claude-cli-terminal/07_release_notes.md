# CodeCafe Desktop - Claude CLI 터미널 개선 릴리즈 노트 (Flags/Env 포함)

## 1) 개요
이번 릴리즈는 Desktop(Electron) 앱에서 Order 실행 시 Claude CLI가 안정적으로 초기화되고,
출력 스트리밍/사용자 입력 상호작용이 정상 동작하도록 개선한다.

문서 기준 실행 구조:
UI(Renderer) → IPC(Main) → Orchestrator → ExecutionManager → BaristaEngineV2 → TerminalPool → ClaudeCodeAdapter → node-pty:contentReference[oaicite:14]{index=14}:contentReference[oaicite:15]{index=15}

핵심 개선 대상:
ClaudeCodeAdapter.spawn() 초기화(pty.spawn → claude 실행 → 프롬프트 감지):contentReference[oaicite:16]{index=16}

## 2) 사용자 영향(What’s improved)
### 2-1) 초기화 안정성 향상
- 프롬프트 감지(waitForPrompt)가 더 많은 프롬프트 형태(유니코드 화살표, 대소문자 변화 등)를 인식하도록 개선
- 특정 환경에서 `claude` 실행이 안 되던 케이스(개행 처리 등) 대응 강화
- 초기화 실패 시 더 명확한 에러/로그 제공(원인 분리)

### 2-2) PATH 문제에 대한 fail-fast 및 안내 강화
- `claude` 커맨드가 PATH에서 발견되지 않으면 빠르게 실패하고,
  해결 방법(예: CLAUDE_CODE_PATH 지정)을 안내하도록 개선

### 2-3) 실패 시 프로세스 정리(좀비 방지)
- 초기화 중 timeout/예외가 발생해도 PTY/claude 프로세스가 남지 않도록 정리 로직 강화

### 2-4) (해당되는 경우) sendInput/출력 스트리밍의 end-to-end 동작 확인 및 UI 상태 표시 강화
- 출력 스트리밍(order:output)이 UI에 확실히 나타나도록 관측/표시 개선:contentReference[oaicite:17]{index=17}:contentReference[oaicite:18]{index=18}
- 실행 단계 표시(Initializing → Running 등)로 “멈춤처럼 보이는” UX 개선

## 3) 신규/변경된 설정(Flags / Environment Variables)
> 아래 항목은 “문서 기준 어댑터/실행 흐름”을 토대로, 이번 개선 작업에서 제공(또는 옵션화)될 가능성이 높은 항목을 릴리즈 노트 형태로 정리한 것.
> 실제 적용 여부/키 이름은 코드 반영 시 확정 필요.

### 3-1) `CLAUDE_CODE_PATH` (환경변수)
**용도**
- Desktop 앱에서 띄운 셸 환경(bash/powershell)에서 `claude`를 PATH로 찾지 못하는 경우,
  `claude` 바이너리의 절대 경로를 지정해 실행 가능하게 함:contentReference[oaicite:19]{index=19}.

**예시**
- macOS/Linux:
  - `export CLAUDE_CODE_PATH="/usr/local/bin/claude"`
- Windows PowerShell:
  - `$env:CLAUDE_CODE_PATH="C:\Users\me\AppData\Local\Programs\claude\claude.exe"`

**변경점**
- 기존: PATH 가정 실패 시 waitForPrompt timeout으로만 보일 수 있었음
- 개선: 실행 전 검증/명확한 오류 메시지 제공 + `CLAUDE_CODE_PATH` 사용 안내

### 3-2) `CI` 처리(옵션화/정책 변경 가능)
**배경**
- 기존 어댑터는 `CI=true`를 강제하여 비대화형 모드로 유도하는 설정이 있음:contentReference[oaicite:20]{index=20}.
- 일부 환경에서 CLI 출력/프롬프트 형태가 달라져 초기화 감지 실패 가능성이 있어 A/B 테스트 후 정책 조정 가능.

**정책 예시(택1)**
- (A) 기본값: CI 미설정(혹은 false), 필요 시만 켜기
- (B) Provider 설정에서 토글 제공 (예: desktop 설정 UI/설정 파일)
- (C) 기존 유지 + 프롬프트 감지 로직 강화로 호환 확보

**유의**
- CI 설정은 CLI의 출력/인터랙션 방식에 영향을 줄 수 있으므로, 문제 재현 시 on/off 비교가 유효하다.

### 3-3) (선택) Debug Logging 플래그
**용도**
- 초기화 문제(3번) 원인 분리를 위해 ClaudeCodeAdapter의 startup output ring buffer, 단계별 로그를 활성화/비활성화.

**예시**
- `CODECAFE_TERMINAL_DEBUG=1` (가칭)
- Desktop 설정에서 “터미널 디버그 로그” 토글 제공(가칭)

**효과**
- timeout 시 “마지막으로 받은 출력”을 묶어서 확인 가능 → 원인 분리 속도 향상

## 4) 마이그레이션/운영 가이드
### 4-1) 업데이트 후 바로 해야 할 것(권장)
1) 외부 터미널에서 `claude --version` / `claude` 실행 확인(L0)
2) 앱에서 order 실행(L1~L2)
3) 입력 대기 시나리오에서 sendInput 확인(L3)

### 4-2) 자주 발생하는 문제와 해결
- 문제: “claude를 못 찾음”
  - 해결: PATH 확인 → `CLAUDE_CODE_PATH` 지정 → 재시도
- 문제: “초기화 timeout”
  - 해결: 디버그 로그 활성화(있다면) → startup chunk 확인(로그인/권한/프롬프트 형식)
  - 해결: CI on/off 비교
- 문제: “출력은 나오는데 UI가 느림”
  - 해결: 렌더링 버퍼링/가상화 옵션(프로젝트 적용 여부에 따라)

## 5) 변경 파일/영향 범위(개발자용 요약)
- Orchestrator/Terminal:
  - ClaudeCodeAdapter: spawn/waitForPrompt/개행/환경변수/선검증/정리 로직:contentReference[oaicite:21]{index=21}
  - TerminalPool: acquireLease/timeout 로깅 및 실패 처리 강화:contentReference[oaicite:22]{index=22}
- Desktop(Main/Renderer):
  - ExecutionManager: output 이벤트 관측/전송 로깅, 상태 표시 개선:contentReference[oaicite:23]{index=23}:contentReference[oaicite:24]{index=24}
  - IPC(order): sendInput 핸들러/브리지 존재 여부 점검 및 보완:contentReference[oaicite:25]{index=25}
  - Renderer(OrderTerminals): 출력 표시/입력 UI 연결 및 성능 개선:contentReference[oaicite:26]{index=26}

## 6) 호환성/리스크
- 프롬프트 감지 완화로 오탐 위험(“준비됨” 오판) → 테스트 매트릭스로 방지
- CI 정책 변경 시 출력 형태 변화/로그 증가 가능 → 옵션화로 롤백 가능하게
- 타임아웃 조정으로 체감 지연 가능 → 상태 표시로 보완

## 7) 테스트/검증 링크
- `docs/work-plan/claude-cli-terminal/06_test_matrix.md` 참고 (OS/셸별 테스트 + 재현 스크립트)
