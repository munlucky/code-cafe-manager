# CodeCafe Desktop - Claude CLI 터미널 초기화/상호작용 개선 작업 계획 (Overview)

## 1) 배경/문제정의
CodeCafe Manager의 Desktop(Electron) 앱에서 Order 실행 시 터미널을 띄우고 Claude CLI와 상호작용해야 하는데,
현재는 "3) Claude CLI 초기화/프롬프트 준비" 단계에서 제대로 진행되지 않아 1) 입력, 2) 출력 스트리밍도 검증 불가 상태.

문서 기준 실행 흐름(핵심):
UI(Renderer) -> IPC(Main) -> Orchestrator -> ExecutionManager -> BaristaEngineV2 -> Session/TerminalPool -> ClaudeCodeAdapter -> node-pty:contentReference[oaicite:2]{index=2}:contentReference[oaicite:3]{index=3}

특히 문제 집중 구간:
- ClaudeCodeAdapter.spawn(): pty.spawn -> 셸 준비 -> `claude` 실행 write -> `waitForPrompt` 준비 완료 감지:contentReference[oaicite:4]{index=4}

## 2) 목표 (Goals)
- G1. Claude CLI가 안정적으로 실행되어 “준비 완료 프롬프트”를 감지한다.
- G2. 실행 출력이 order:output으로 UI에 스트리밍된다:contentReference[oaicite:5]{index=5}:contentReference[oaicite:6]{index=6}.
- G3. 실행 중 사용자 입력(sendInput)이 PTY.write()까지 도달한다:contentReference[oaicite:7]{index=7}.
- G4. 실패 시 원인이 사용자에게/로그에 명확히 남고(예: PATH, 타임아웃, 권한/로그인), 프로세스가 정리된다.

## 3) 비목표 (Non-goals)
- N1. “입력 1회 -> 응답 1회” 같은 RPC 스타일 InputWaiter 설계는 필수 목표가 아님.
  (현재 구조는 스트리밍 이벤트 + 단순 pty.write 기반 상호작용 모델:contentReference[oaicite:8]{index=8})
- N2. 워크플로우(Stage) 병렬 실행, Provider 추가 등 대규모 기능 확장은 범위 밖.

## 4) 가설/우선순위
P0 원인 후보(3번 단계에서 막히는 주요 원인):
- H1. waitForPrompt 감지 패턴이 실제 Claude 프롬프트 형식(유니코드, 대소문자, 문구 변화)을 못 잡는다:contentReference[oaicite:9]{index=9}.
- H2. CI=true 등 환경변수 강제가 CLI 출력/모드를 바꿔 프롬프트 감지 실패를 유발할 수 있다:contentReference[oaicite:10]{index=10}.
- H3. 개행(\r vs \n) 처리로 명령 실행이 일부 OS/셸에서 실패한다:contentReference[oaicite:11]{index=11}.
- H4. PATH 문제로 `claude` 실행이 실패(“command not found”)하지만 이를 빠르게 식별하지 못한다:contentReference[oaicite:12]{index=12}.
- H5. 초기 설정/권한/로그인/업데이트 프롬프트 등 추가 입력을 기다리며 멈춘다:contentReference[oaicite:13]{index=13}.

## 5) 완료 정의 (Definition of Done)
- D0. 초기화: Order 실행 시 95% 이상 케이스에서 CLI 준비 완료까지 도달.
- D1. 출력: 최소 1개의 order 실행에서 order:output 스트리밍이 UI에 표시됨:contentReference[oaicite:14]{index=14}:contentReference[oaicite:15]{index=15}.
- D2. 입력: 실행 중 sendInput으로 보낸 메시지가 CLI 반응을 유발하고 출력 스트리밍으로 확인됨:contentReference[oaicite:16]{index=16}.
- D3. 실패: 실패 시 원인이 logs + UI(또는 error payload)에 명확히 드러남.
- D4. 정리: spawn 실패/타임아웃 시 PTY 프로세스/리소스 정리로 좀비 프로세스 방지.

## 6) 단계별 작업 파일 안내
- 01_diagnostics_logging.md : 초기화 원인 분리용 로깅/진단 (P0)
- 02_init_stabilization.md : waitForPrompt/개행/CI/PATH 등 초기화 안정화 (P0)
- 03_output_streaming_verify.md : 출력 스트리밍 검증/개선 (P1)
- 04_sendinput_end_to_end.md : sendInput 경로 구현/검증 (P1)
- 05_hardening_cleanup_retry.md : 정리/재시도/타임아웃 정책 등 내구성 (P2)

## 7) 리스크/롤백
- R1. 감지 로직 완화로 오탐(“준비됨”으로 착각) 가능 -> 테스트 케이스로 방지.
- R2. CI 제거 시 출력이 복잡해질 수 있음 -> 옵션화/플래그로 롤백 가능하게.
- R3. 타임아웃 증가로 사용자 체감 지연 -> UI에 상태 표시 + 활동 기반 연장 방식으로 보완.
