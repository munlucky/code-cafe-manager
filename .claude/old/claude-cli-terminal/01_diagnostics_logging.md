# P0 - Claude CLI 초기화 원인 분리: 로깅/진단 강화

## 1) 목표
- “3번 초기화 단계에서 어디서 멈추는지”를 1회 실행 로그만으로 확정한다.
- 실패 원인을 분류한다: PATH/명령 실행 실패, 프롬프트 감지 실패, CI 영향, 권한/로그인/초기 설정 대기 등.

## 2) 대상 흐름(참조)
ClaudeCodeAdapter.spawn()의 주요 단계:
1) pty.spawn(shell, args, {cwd, env, cols/rows})
2) waitForShellReady()
3) pty.write(claudeCmd + lineEnding)
4) waitForPrompt() 준비 완료 감지:contentReference[oaicite:17]{index=17}

## 3) 변경(추가)할 로깅 포인트 (Commit 단위 권장)
### C1. spawn() 단계별 “구조화 로그” 추가
- [ ] spawn 시작: provider, baristaId(있다면), orderId(있다면), cwd
- [ ] shell/args 출력(Windows/Unix 분기 포함)
- [ ] env 요약: CI, TERM, PATH length 정도(민감정보 제외)
- [ ] claudeCmd 실제 문자열 출력(윈도우 `& "..."` 포함):contentReference[oaicite:18]{index=18}
- [ ] waitForShellReady 진입/탈출 로그 + 소요(ms)
- [ ] `write(claudeCmd)` 직전/직후 로그
- [ ] `waitForPrompt` 시작 로그 + timeoutMs

권장 로그 형식(JSON-like):
{
  scope: "claude-adapter",
  step: "waitForPrompt",
  orderId,
  provider,
  elapsedMs,
  details: { ... }
}

### C2. “startup output ring buffer” 추가
- [ ] waitForPrompt에서 수신한 데이터 chunk를 N개(예: 50개)까지 링버퍼에 저장
- [ ] timeout 발생 시 링버퍼를 한 번에 덤프(최대 길이 제한)

이렇게 하면:
- “command not found”, “login required”, “permission prompt” 등이 명확히 남는다.

### C3. TerminalPool.acquireLease 대기/실패 로그 강화
- [ ] semaphore acquire 시작/종료(대기시간)
- [ ] timeout 발생 시 provider/cwd/timeoutMs 출력:contentReference[oaicite:19]{index=19}

## 4) 변경 파일 후보
- packages/orchestrator/src/terminal/adapters/claude-code-adapter.ts (spawn/waitForPrompt 로깅):contentReference[oaicite:20]{index=20}
- packages/orchestrator/src/terminal/terminal-pool.ts (acquireLease/timeout 로깅):contentReference[oaicite:21]{index=21}
- (선택) packages/desktop/src/main/execution-manager.ts (상태 이벤트 로깅):contentReference[oaicite:22]{index=22}:contentReference[oaicite:23]{index=23}

## 5) 검증 시나리오
- T1. 정상 케이스: claude가 즉시 뜨는 환경에서 “준비 완료 감지”까지 로그로 확인
- T2. PATH 실패 케이스: 의도적으로 PATH에서 claude 제거 후 실행
  - 기대: 링버퍼에 “not found” 또는 유사 메시지
- T3. 프롬프트 감지 실패 케이스(의도): waitForPrompt 패턴을 임시로 엄격하게 두어 timeout 유도
  - 기대: 링버퍼에 실제 프롬프트 출력이 남는지 확인

## 6) 완료 기준
- [ ] timeout 시 “왜 준비 완료로 판단 못 했는지”를 링버퍼로 파악 가능
- [ ] 최소 1개의 실패 케이스에서 원인 분류 라벨링 가능
  - PATH / CI / 개행 / 감지패턴 / 권한/로그인 / 기타
