# P2 - 내구성 개선: 프로세스 정리, 재시도, 타임아웃 정책, 좀비 방지

## 1) 목표
- 초기화 실패/타임아웃 시 프로세스가 남지 않고 정리된다.
- 일시적 실패는 1회 재시도로 회복 가능하게 한다.
- 타임아웃은 “활동 기반”으로 사용자 체감과 안정성을 균형 있게 맞춘다.

## 2) 작업 항목(Commit 단위)
### C1. spawn 실패 시 PTY kill/정리
- [ ] ClaudeCodeAdapter.spawn()에서 waitForPrompt timeout/예외 발생 시
  - ptyProcess.kill() 호출(가능하면 SIGKILL/SIGTERM 구분)
  - cleanup 수행
- [ ] 정리 실패 시에도 로그 남김

### C2. 1회 재시도(backoff) 정책
- [ ] 초기화 실패가 “timeout”인 경우만 1회 재시도
- [ ] backoff(예: 300~800ms 랜덤) 적용
- [ ] PATH 실패 등 명확한 실패는 재시도하지 않음(fail fast)

### C3. 타임아웃 정책 개선
- [ ] waitForPrompt: 고정 10초가 짧으면 20~30초로 상향(팀 기준 결정)
- [ ] “출력이 진행 중이면” 타임아웃 연장(단, 상한은 유지)
- [ ] UI에는 상태 표시(초기화 지연이 ‘멈춤’처럼 보이지 않게):contentReference[oaicite:51]{index=51}

### C4. Crash Recovery/TerminalPool 상호작용 점검
- [ ] TerminalPool의 자동 재생성 시도가 spawn hang 상황에도 적용되는지 확인:contentReference[oaicite:52]{index=52}
- [ ] 실패한 터미널을 풀에 남기지 않도록 처리(상태 플래그/제거)

## 3) 변경 파일 후보
- packages/orchestrator/src/terminal/adapters/claude-code-adapter.ts:contentReference[oaicite:53]{index=53}
- packages/orchestrator/src/terminal/terminal-pool.ts:contentReference[oaicite:54]{index=54}
- (선택) packages/desktop/src/main/execution-manager.ts:contentReference[oaicite:55]{index=55}

## 4) 테스트
- [ ] 초기화 timeout 인위 재현 -> kill 되었는지 프로세스 리스트로 확인(로컬)
- [ ] 재시도 1회로 성공 전환되는 케이스가 있는지 관찰
- [ ] 반복 실행(예: 50회)에서 좀비 프로세스 누적 없는지 확인

## 5) 완료 기준
- [ ] 초기화 실패 후 남는 PTY/claude 프로세스가 없다
- [ ] 재시도 정책이 불필요한 반복을 만들지 않는다
- [ ] 타임아웃/연장 정책이 UI 체감과 안정성에 도움 된다
