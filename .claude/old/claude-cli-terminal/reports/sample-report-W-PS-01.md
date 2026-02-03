# CodeCafe Desktop - Claude CLI 통합 테스트 리포트
## Case ID: W-PS-01

> 목적: OS/셸별 테스트 결과를 일관된 형식으로 기록하고,
> 초기화(3번) 실패 원인을 빠르게 분리하며,
> 출력 스트리밍/입력(sendInput) end-to-end 품질을 추적한다.
>
> 참고 문서:
> - 06_test_matrix.md (테스트 매트릭스/재현 스크립트)
> - 07_release_notes.md (변경점/플래그/환경변수)
>
> 문서 기준 실행 흐름:
> UI(Renderer) → IPC(Main) → Orchestrator → ExecutionManager → BaristaEngineV2 → Session/TerminalPool → ClaudeCodeAdapter → node-pty

---

## 1) 리포트 메타정보

- **작성자**: QA 팀 (샘플 데이터)
- **작성일**: 2026-01-18
- **브랜치/커밋**: `feat/08_test_report_template` / `bcffc61`
- **Desktop 버전**: v0.4.2 (dev)
- **Orchestrator(터미널/어댑터) 버전**: v1.2.0
- **테스트 실행 횟수(총)**: 15회 (각 레벨 5회 반복)
- **테스트 기간(시작~종료)**: 2026-01-18 09:00 ~ 11:30
- **이슈 트래커 링크**: [CODECAFE-412](https://jira.example.com/browse/CODECAFE-412)

---

## 2) 테스트 환경 정보 (필수)

### 2-1. OS/하드웨어
- **OS**:
  - [x] Windows 11 (23H2, Build 22631)
  - [ ] Windows 10
  - [ ] macOS (버전: )
  - [ ] Linux (배포판/버전: )
- **CPU**: Intel Core i7-12700K
- **RAM**: 32GB DDR5
- **디스크**: NVMe SSD 1TB (NTFS)
- **GPU**: NVIDIA RTX 3080 (테스트 무관)

### 2-2. 셸/터미널
- **앱에서 spawn되는 셸**:
  - Windows: PowerShell 5.1.22621.2506
  - macOS/Linux: bash (버전: )
- **사용자 기본 로그인 셸(참고)**:
  - [x] PowerShell
  - [ ] bash
  - [ ] zsh
  - [ ] fish
  - [ ] 기타:

### 2-3. Claude CLI 상태
- **설치 방식**:
  - [x] 공식 설치 (npm install -g @anthropic-ai/claude-code)
  - [ ] brew
  - [ ] pipx
  - [ ] 기타:
- **`claude --version` 결과**:
  ```text
  claude-code version 1.0.0
  ```
- **로그인 상태**:
  - [x] 로그인 완료
  - [ ] 로그인 필요(추정)
  - [ ] 불명(로그로 판단)

### 2-4. 환경변수/플래그
- **`CLAUDE_CODE_PATH`**:
  - 값: (미설정 - PATH 사용)
  - 적용 여부: [ ] 적용 [x] 미적용
- **`CI`**:
  - 값: true (어댑터 기본 설정)
  - 적용 여부: [x] 적용 [ ] 미적용
- **디버그 로그 플래그(있는 경우)**:
  - 키/값: `DEBUG=claude:*,orchestrator:*,terminal:*`
  - 적용 여부: [x] 적용 [ ] 미적용

---

## 3) 실행 시나리오(이번 테스트에서 사용한 프롬프트/조건)

### 3-1. 기본 실행 프롬프트(짧은 출력)
- **Prompt A**: "현재 날짜와 시간을 알려줘"
- **기대 출력(대략)**:
  ```text
  2026년 1월 18일 토요일입니다. 현재 시간은 오전 9시 30분입니다.
  ```

### 3-2. 대량 출력 프롬프트(스트리밍/성능)
- **Prompt B**: "리액트 컴포넌트 템플릿을 작성해줘. TypeScript, 타입 안전성 고려, 에러 핸들링 포함"
- **기대 출력(대략)**: 100~200줄의 코드 스니펫, 복수 차례 order:output 이벤트

### 3-3. 입력 대기(상호작용) 프롬프트
- **Prompt C**: "프로젝트 구조를 분석해줘. 추가 질문이 있으면 물어봐"
- **기대 흐름**:
  - CLI가 질문/입력을 요구 → sendInput 전송 → 출력 재개

---

## 4) 케이스별 테스트 결과 요약(필수)

> 06_test_matrix.md의 Case ID를 사용해 기록한다.

### 4-1. 테스트 케이스 정보
- **Case ID**: W-PS-01
- **OS/셸**: Windows 11 / PowerShell 5.1
- **실행 조건(특이사항)**:
  - (예: CI on/off, CLAUDE_CODE_PATH 설정, PATH 수정 등)
  - CI=true 기본 설정 적용 상태
  - PATH에 claude 바이너리 포함됨 (npm global)

### 4-2. 레벨별 결과(체크)

#### L0 (외부 터미널에서 claude 실행 가능)
- [x] PASS  [ ] FAIL
- **비고**: PowerShell에서 `claude --version` 정상 출력

#### L1 (앱에서 초기화 성공: waitForPrompt 통과)
- [ ] PASS  [x] FAIL
- **성공률**: 3 / 5 (60%)
- **비고**: 2회에서 timeout 발생, 3회에서 성공

#### L2 (출력 스트리밍: order:output UI 표시)
- [x] PASS  [ ] FAIL
- **성공률**: 5 / 5 (100%)
- **비고**: L1 성공 케이스에서 모두 정상 스트리밍 확인

#### L3 (입력 전송: sendInput → 출력 반응)
- [x] PASS  [ ] FAIL
- **성공률**: 4 / 5 (80%)
- **비고**: 1회에서 입력 후 응답 없음 (추정: 입력 타이밍 이슈)

#### L4 (실패 분리 + 프로세스 정리)
- [x] PASS  [ ] FAIL
- **성공률**: 5 / 5 (100%)
- **비고**: timeout 시 PTY 정상 정리됨, 좀비 프로세스 없음

### 4-3. 한 줄 결론(필수)
- **결론**: "CI=true로 인한 프롬프트 포맷 변경으로 waitForPrompt 감지 실패. CI 제거 후 100% 초기화 성공. 감지 로직 개선 필요"

---

## 5) 실행 로그/증거(필수)

### 5-1. 성공 케이스 로그 하이라이트

#### 초기화 구간(요약)
```text
[2026-01-18 09:15:32.456] INFO  [ClaudeCodeAdapter] Spawning pty: powershell.exe -NoLogo -NoProfile
[2026-01-18 09:15:33.123] DEBUG [ClaudeCodeAdapter] Shell ready detected
[2026-01-18 09:15:33.456] DEBUG [ClaudeCodeAdapter] Writing command: claude
[2026-01-18 09:15:35.789] DEBUG [ClaudeCodeAdapter] Output: "Claude 1.0.0 — Press Ctrl+C to exit"
[2026-01-18 09:15:36.012] INFO  [ClaudeCodeAdapter] waitForPrompt SUCCESS: pattern '>\s*$' matched
```

#### 출력 스트리밍(요약)
- **order:output 첫 chunk 시점**: 09:15:37.234
- **마지막 chunk 시점**: 09:15:42.567
- **총 chunk 수**: 12개
- **총 출력 바이트**: 2,345 bytes

#### 입력(sendInput) 관련
- **입력 전송 시점**: 09:16:10.123
- **입력 내용**: "src/components/ 폴더를 분석해줘"
- **출력 반응 증거**: 09:16:10.890부터 "src/components/ 폴더 분석 결과..." 출력 재개

### 5-2. 실패 케이스 로그 하이라이트 (링버퍼/초기화 chunk)

> timeout 또는 실패 시 "startup output ring buffer" 상위 N줄을 붙여넣는다.

#### 실패 시점
- **시각**: 2026-01-18 09:22:45.678
- **실패 유형**: waitForPrompt 감지 실패 (timeout 30초 경과)

#### 링버퍼(상위 20줄)
```text
[2026-01-18 09:22:15.123] INFO  [ClaudeCodeAdapter] Spawning pty: powershell.exe -NoLogo -NoProfile
[2026-01-18 09:22:15.890] DEBUG [ClaudeCodeAdapter] Shell ready detected
[2026-01-18 09:22:16.234] DEBUG [ClaudeCodeAdapter] Writing command: claude
[2026-01-18 09:22:16.567] DEBUG [ClaudeCodeAdapter] Output: "PowerShell 7.4.5"
[2026-01-18 09:22:17.123] DEBUG [ClaudeCodeAdapter] Output: "Copyright (c) Microsoft Corporation."
[2026-01-18 09:22:18.456] DEBUG [ClaudeCodeAdapter] Output: "https://aka.ms/powershell"
[2026-01-18 09:22:18.789] DEBUG [ClaudeCodeAdapter] Output: "Type 'help' to get help."
[2026-01-18 09:22:19.012] DEBUG [ClaudeCodeAdapter] Output: ""
[2026-01-18 09:22:19.345] DEBUG [ClaudeCodeAdapter] Output: "PS C:\\Users\\Test>"
[2026-01-18 09:22:19.678] DEBUG [ClaudeCodeAdapter] Output: "$?"
[2026-01-18 09:22:20.123] DEBUG [ClaudeCodeAdapter] Output: "True"
[2026-01-18 09:22:20.456] DEBUG [ClaudeCodeAdapter] Output: "PS C:\\Users\\Test>"
[2026-01-18 09:22:22.789] DEBUG [ClaudeCodeAdapter] Output: "In non-interactive mode..."
[2026-01-18 09:22:23.123] DEBUG [ClaudeCodeAdapter] Output: "Waiting for input..."
[2026-01-18 09:22:25.456] DEBUG [ClaudeCodeAdapter] Output: "[CI] Running in CI mode..."
[2026-01-18 09:22:26.789] DEBUG [ClaudeCodeAdapter] Output: "[CI] Auto-detect project..."
[2026-01-18 09:22:28.012] DEBUG [ClaudeCodeAdapter] Output: "[CI] Analyzing..."
[2026-01-18 09:22:30.345] DEBUG [ClaudeCodeAdapter] Output: "[CI] No prompt detected - entering batch mode"
[2026-01-18 09:22:45.678] ERROR [ClaudeCodeAdapter] waitForPrompt TIMEOUT after 30s
```

#### 실패 유형(선택)
- [ ] PATH/command not found
- [x] waitForPrompt 감지 실패(프롬프트는 보이는데 못 잡음)
- [ ] CLI hang(추정: 로그인/권한/초기 설정/업데이트)
- [ ] pty.spawn/shell 문제
- [ ] 기타: CI 모드에서 프롬프트 형식이 다름

### 5-3. 스크린샷/영상(있다면)
- **링크/경로**: (실제 테스트 시 첨부)

---

## 6) 원인 분석(필수)

### 6-1. 1차 원인(가장 유력한 것 1개)

#### 원인
**CI=true 환경변수로 인해 Claude CLI가 CI 모드로 실행되어 프롬프트 형식이 변경됨**

- 기대 프롬프트: `>\s*$` (인터랙티브 모드)
- 실제 프롬프트: 없음 (CI 모드는 입력 대기 없이 바로 실행)

#### 근거 로그/증거
1. 실패 로그에 `[CI] Running in CI mode...` 메시지 확인
2. `[CI] No prompt detected - entering batch mode` 메시지로 프롬프트 없음 확인
3. CI=false 설정 후 5회 연속 초기화 성공 (검증 완료)

#### 재현 조건
- Windows PowerShell 환경
- 어댑터/앱 기본 설정에 CI=true가 포함된 경우
- waitForPrompt가 인터랙티브 프롬프트(`>`)만 기대하는 경우

#### 빈도
- CI=true 설정 시: 100% 실패 (5/5회)
- CI=false 설정 후: 0% 실패 (0/5회)

### 6-2. 2차 원인(있다면)

#### 원인
**waitForPrompt 정규식이 유니코드/대소문자 변화를 고려하지 않음**

#### 근거
- 일부 케이스에서 유니코드 문자가 포함된 출력에서 감지 지연
- Windows PowerShell 한글 로케일 시 테스트 필요

#### 빈도
- 드물게 발생 (5회 중 1회, 약 20%)

### 6-3. 반증/제외된 가설

#### 가설
"PATH 문제로 claude 실행이 실패한다"

#### 왜 제외했는지(로그/테스트 근거)
1. 외부 PowerShell에서 `where.exe claude`로 PATH 확인 완료
2. 앱 로그에 `command not found` 메시지 없음
3. 모든 케이스에서 `claude` 실행 후 초기 출력 발생 확인

---

## 7) 조치/패치 제안(필수)

### 7-1. 즉시 조치(Hotfix 후보)

#### ✅ prompt 감지 로직 보완(정규식/대소문자/유니코드)
- 현재: `/>\s*$/`만 감지
- 개선: CI 모드 감지 + 인터랙티브 모드 프롬프트 다중 패턴 지원

#### ✅ CI 설정 변경/옵션화
- 현재: 기본 CI=true 강제
- 개선: 인터랙티브 모드 필요 시 CI=false 설정 또는 조건부 적용

#### ⏳ PATH 선검증 + fail-fast
- 구현 예정: v1.3.0

#### ⏳ timeout 정책 조정(활동 기반 연장)
- 구현 예정: v1.3.0

#### ✅ 실패 시 PTY kill/정리
- 현재 구현됨, 정상 동작 확인

#### 기타:
- 개행 처리(`\r` vs `\r\n`): Windows에서 `\r\n` 정상 처리됨

### 7-2. 코드 변경 포인트(파일/함수 레벨)

#### 파일 1: `src/terminal/ClaudeCodeAdapter.ts`

**변경 예상**:
```typescript
// 기존
private waitForPrompt(): Promise<void> {
  return this.awaitPattern(/>\s*$/, 30000);
}

// 개선
private waitForPrompt(): Promise<void> {
  // 인터랙티브 모드 프롬프트 (다양한 패턴)
  const interactivePatterns = [
    />\s*$/,                    // 표준 프롬프트
    /⟩\s*$/,                    // 유니코드 화살표
    /\$\s*$/,                   // bash 스타일
  ];

  // CI 모드 감지 (프롬프트 없이 진행)
  const ciModePatterns = [
    /\[CI\]/,
    /non-interactive/,
  ];

  // CI 모드가 감지되면 waitForPrompt를 스킵하거나
  // CI 전용 감지 로직 수행
  return this.awaitAnyPattern([
    ...interactivePatterns,
    ...ciModePatterns
  ], 30000);
}
```

#### 파일 2: `src/config/TerminalConfig.ts`

**변경 예상**:
```typescript
// 기존
export const DEFAULT_ENV = {
  CI: 'true',
  // ...
};

// 개선
export const DEFAULT_ENV = {
  // 인터랙티브 모드가 필요한 경우 CI 제거
  // CI: 'true',  // 옵션화
  // 또는
  CI: process.env.CLADE_INTERACTIVE ? 'false' : 'true',
};
```

### 7-3. 테스트 재검증 계획

#### 어떤 케이스를 재실행할지
1. **W-PS-01**: CI=false 설정 후 재테스트
2. **W-PS-02**: CLAUDE_CODE_PATH 설정 케이스 추가
3. 각 케이스별 10회 반복 (기존 5회에서 증가)

#### 성공 기준
- L1 초기화 성공률: 95% 이상 (10회 중 9회 이상)
- L2 스트리밍: 100% (10/10)
- L3 입력: 90% 이상 (9/10)

---

## 8) 최종 결론/다음 액션(필수)

### 결론
Windows PowerShell 환경에서 Claude CLI 초기화 실패의 주요 원인은 **CI=true 환경변수로 인한 CLI 모드 변경**임이 확인됨. CI 모드에서는 인터랙티브 프롬프트가 표시되지 않아 waitForPrompt가 타임아웃 발생.

**해결책**:
1. 단기: CI=false 설정으로 우회 (검증 완료, 100% 성공)
2. 장기: CI 모드 감지 및 대응 로직 구현 (v1.3.0 예정)

### 다음 액션(우선순위 순)

#### 1) [P0] CI 설정 옵션화 구현
- **담당자**: 터미널 팀
- **목표일**: 2026-01-25
- **내용**: ClaudeCodeAdapter에서 CI 환경변수 조건부 설정

#### 2) [P1] waitForPrompt 다중 패턴 지원
- **담당자**: 터미널 팀
- **목표일**: 2026-01-29
- **내용**: 인터랙티브/CI 모드 각각 감지 로직 분리

#### 3) [P2] W-PS-02 케이스 테스트 (CLAUDE_CODE_PATH)
- **담당자**: QA 팀
- **목표일**: 2026-02-01
- **내용**: PATH 분리 문제 우회 케이스 검증

---

### 담당자/기한(선택)

#### 담당자
- 개발: 김개발 (터미널 팀)
- 검증: 이테스트 (QA 팀)

#### 목표일
- Hotfix 배포: 2026-01-22
- 전체 기능 완료: 2026-02-05

---

## 9) 부록: 재현 커맨드 기록(선택)

### 9-1. Windows PowerShell

#### L0 진단 (외부 터미널)
```powershell
# claude가 PATH에 있는지 확인
where.exe claude
# 결과: C:\Users\Test\AppData\Roaming\npm\claude.cmd

# 버전 확인
claude --version
# 결과: claude-code version 1.0.0

# 간단 실행 (인터랙티브)
claude
```

#### CI 모드 영향 확인
```powershell
# CI=true로 실행
$env:CI = "true"
claude
# 결과: 프롬프트 없이 바로 종료 또는 입력 대기

# CI=false로 실행
$env:CI = "false"
claude
# 결과: 정상 프롬프트 ">" 표시
```

### 9-2. macOS/Linux
```bash
# PATH 확인
which claude
# 결과: /usr/local/bin/claude

# 버전 확인
claude --version || true

# 간단 실행
claude
```

### 9-3. macOS zsh vs bash PATH 비교
```bash
# ZSH PATH
zsh -lc 'echo "ZSH login PATH: $PATH"; which claude || true'

# BASH PATH
bash -lc 'echo "BASH login PATH: $PATH"; which claude || true'
```

---

## 문서 이력

| 버전 | 일자 | 변경 내용 | 작성자 |
|------|------|----------|--------|
| 1.0 | 2026-01-18 | 샘플 리포트 생성 (W-PS-01) | QA 팀 |
