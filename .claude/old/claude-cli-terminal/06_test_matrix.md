# CodeCafe Desktop - Claude CLI 통합 테스트 매트릭스 & 재현 스크립트 (OS/셸별)

## 1) 목적
CodeCafe Manager Desktop(Electron)에서 Order 실행 시 Claude CLI를 node-pty로 구동하고
프롬프트 초기화(waitForPrompt) → 출력 스트리밍(order:output) → 사용자 입력(sendInput)이
OS/셸 조합별로 정상 동작하는지 반복 검증한다.

문서 기준 핵심 흐름:
UI(Renderer) → IPC(Main) → Orchestrator → ExecutionManager → BaristaEngineV2 → Session/TerminalPool → ClaudeCodeAdapter → node-pty:contentReference[oaicite:2]{index=2}:contentReference[oaicite:3]{index=3}

특히 초기화 문제(현재 우선 장애)는 ClaudeCodeAdapter.spawn():
pty.spawn → 셸 준비 → `claude` 실행 write → waitForPrompt 감지:contentReference[oaicite:4]{index=4}

## 2) 사전 준비(모든 환경 공통)
### 2-1. Claude CLI 설치/로그인 상태
- Claude CLI 설치가 되어 있어야 함(환경별 설치 방식은 팀/사용자 표준에 따름)
- 최초 실행/로그인 필요 시: 앱 실행 전에 일반 터미널에서 1회 `claude` 실행 또는 `claude login` 등을 완료해두는 것을 권장
  - (초기 설정/로그인 프롬프트로 인해 앱 내 초기화가 멈추는 케이스를 분리하기 위함)

### 2-2. 환경변수/설정
- `CLAUDE_CODE_PATH` (선택): `claude` 바이너리 경로가 PATH에 없거나, 앱에서 띄우는 셸의 PATH가 달라서 찾지 못하는 경우 사용
- `CI` 토글(선택): CI=true 강제 설정이 CLI 동작을 바꿀 수 있어 A/B 테스트에 사용(어댑터 수정 후 옵션화될 수 있음):contentReference[oaicite:5]{index=5}

### 2-3. 테스트 대상 기능
- F1. 초기화: Claude CLI 프롬프트 준비 완료 감지(waitForPrompt 성공):contentReference[oaicite:6]{index=6}
- F2. 출력 스트리밍: order:output이 UI에 실시간 표시:contentReference[oaicite:7]{index=7}:contentReference[oaicite:8]{index=8}
- F3. 입력 전송: sendInput이 PTY.write까지 도달하고 출력 반응 확인:contentReference[oaicite:9]{index=9}
- F4. 실패 처리: PATH/타임아웃/권한/로그인 등 원인이 로그/에러로 명확히 분리됨(링버퍼/구조화 로그)

## 3) 테스트 레벨 정의
- L0: CLI 존재/실행 확인(외부 터미널에서)
- L1: 앱에서 CLI 초기화 성공 여부(프롬프트 감지)
- L2: 앱에서 출력 스트리밍 정상 여부
- L3: 앱에서 사용자 입력(sendInput) 정상 여부
- L4: 실패 시 fail-fast + 프로세스 정리(좀비 방지)

## 4) OS/셸 매트릭스
각 케이스는 최소 5회 반복 실행 권장(간헐 실패/레이스 탐지 목적).

| Case ID | OS | 셸/구동 방식 | 기대 주요 리스크 | 필수 레벨 |
|---|---|---|---|---|
| W-PS-01 | Windows 10/11 | PowerShell(기본) | `claude` 경로 탐지, `& "path"` 실행, 개행(\r/\r\n) | L1~L4 |
| W-PS-02 | Windows 10/11 | PowerShell + CLAUDE_CODE_PATH 지정 | PATH 분리(앱/셸 차이) 해결 여부 | L1~L4 |
| M-BASH-01 | macOS | bash login(-i) | 개행(\n vs \r), PATH(zsh 환경과 불일치) | L1~L4 |
| M-ZSH-01 | macOS | zsh(사용자 기본 셸) 환경에서 앱 실행 | 앱이 bash를 띄울 때 PATH가 달라질 수 있음 | L1~L4 |
| M-ZSH-02 | macOS | zsh + CLAUDE_CODE_PATH | PATH 불일치 우회 | L1~L4 |
| L-BASH-01 | Linux(Ubuntu 등) | /bin/bash --login -i | `\r`만 쓰면 명령 미실행 가능, PATH/권한 | L1~L4 |

참고:
- 현재 어댑터는 Windows는 PowerShell, Unix는 /bin/bash 기반으로 spawn하는 구조로 문서에 나옴:contentReference[oaicite:10]{index=10}.
- macOS에서 사용자가 zsh를 쓰더라도 앱이 bash를 띄우면 PATH가 달라질 수 있어 별도 케이스로 분리.

## 5) 공통 테스트 시나리오(모든 Case에 적용)
### S1. “초기화 only” 테스트
목표: 3번 단계(claude 프롬프트 준비) 통과 여부 확인.
절차:
1) Desktop 앱 실행
2) 최소 주문(order) 생성 후 execute
3) 로그에서 spawn 단계: shell ready → claude 실행 write → waitForPrompt 성공 확인
기대:
- 10~30초 내(팀 기준) waitForPrompt 성공
- 실패 시 링버퍼에 원인 단서 출력(예: command not found, login required 등)

합격 조건:
- 5회 중 5회 초기화 성공(또는 목표 성공률 정의)

### S2. “출력 스트리밍” 테스트
목표: order:output이 UI로 흐르는지 확인:contentReference[oaicite:11]{index=11}:contentReference[oaicite:12]{index=12}.
절차:
1) 짧은 프롬프트: “한 줄만 출력해줘” 수준
2) UI 로그창/터미널 뷰에서 출력이 chunk 단위로 누적되는지 관찰
기대:
- order:output이 실행 중 지속적으로 도착
- 완료 후 종료 이벤트/상태 변경(프로젝트 표준에 맞게 확인)

합격 조건:
- 출력이 최소 1회 이상 UI에 표시되고, 완료까지 유실이 없음

### S3. “sendInput 상호작용” 테스트
목표: 실행 중 입력이 PTY에 전달되는지 확인:contentReference[oaicite:13]{index=13}.
절차(권장):
1) 프롬프트에서 “추가 질문이 있으면 물어봐” 또는 “내가 답하면 계속 진행해” 같이, CLI가 입력을 기다리는 상황을 유도
2) UI의 입력창(sendInput)으로 답변 전송
3) 이후 출력이 이어지는지 확인
기대:
- 입력이 전달되고 출력이 재개/변화
- 실행 중이 아닌 orderId에 입력 시 명확한 에러 반환

합격 조건:
- 3회 이상 입력→출력 반응이 확인됨

### S4. “실패 분리 + 정리” 테스트 (내구성)
목표: 실패 시 원인 분리 및 좀비 프로세스 방지.
절차 예시:
- PATH 실패 유도: 일부 케이스에서 임시로 `claude`를 PATH에서 제거하거나 `CLAUDE_CODE_PATH`를 잘못 지정
- 기대: fail-fast로 즉시 에러, 불필요한 10초 이상 대기 없음
- spawn timeout 유도: waitForPrompt를 일부러 엄격하게 하여 타임아웃 유발(개발 브랜치에서만)
- 기대: timeout 후 PTY kill/정리 로그 확인

합격 조건:
- 실패가 “원인 코드/메시지”로 분리됨
- 실패 후 남는 pty/claude 프로세스가 없음(수동 확인)

## 6) 환경별 재현 스크립트(권장)
아래 스크립트들은 “앱 외부에서 claude 실행 가능/프롬프트 형태 확인” 용도다.
(앱 통합 테스트 전 L0 진단으로 사용)

### 6-1) Windows PowerShell: claude 존재/버전/실행 확인
```powershell
# claude가 PATH에 있는지 확인
where.exe claude

# 버전/헬프(가능하면)
claude --version
claude --help

# 간단 실행 (인터랙티브)
claude

6-2) macOS/Linux: PATH 및 실행 확인
which claude
claude --version || true
claude --help || true

# 인터랙티브 실행
claude

6-3) macOS: zsh vs bash PATH 차이 진단
echo "ZSH PATH: $PATH"
zsh -lc 'echo "ZSH login PATH: $PATH"; which claude || true'

bash -lc 'echo "BASH login PATH: $PATH"; which claude || true'


기대: bash login에서 which claude가 실패하면 앱(어댑터)도 동일 문제를 가질 가능성이 큼.

6-4) CLAUDE_CODE_PATH 사용 진단
export CLAUDE_CODE_PATH="/absolute/path/to/claude"
"$CLAUDE_CODE_PATH" --version


Windows라면 PowerShell에서:

$env:CLAUDE_CODE_PATH="C:\path\to\claude.exe"
& $env:CLAUDE_CODE_PATH --version

7) 테스트 결과 기록 템플릿

각 케이스별로 아래를 기록:

OS / Shell / claude 설치 방식 / 로그인 여부

성공률: 초기화(L1), 스트리밍(L2), 입력(L3)

실패 로그 링버퍼 요약(상위 10줄)

재현 가능 여부 / 빈도 / 해결 가설

8) 통과 기준(권장)

초기화 성공률: 각 케이스 5회 중 5회(또는 95% 이상 목표)

스트리밍: 5회 중 5회 UI 출력 확인

입력: 3회 이상 입력 반응 확인

실패 시: 원인 분리 + 프로세스 정리 확인