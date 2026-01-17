# P0 - Claude CLI 초기화 안정화: prompt 감지/개행/CI/PATH 개선

## 1) 목표
- CLI 초기화 성공률을 끌어올리고, 실패 시 빠르게 실패한다(fail fast).
- 프롬프트 감지/환경 영향/명령 실행 실패를 줄인다.

## 2) 우선 적용 순서(Commit 단위)
### C1. waitForPrompt 감지 로직 강건화 (최우선)
문서상 waitForPrompt는 특정 문자열로 준비 완료를 판단한다:contentReference[oaicite:24]{index=24}.
문제: 유니코드 프롬프트(›, ❯ 등), 대소문자/문구 변화에 취약.

해야 할 일:
- [ ] 감지 기준을 **정규식 + case-insensitive**로 통일
- [ ] “claude” + (>, ›, ❯, » 등) 조합 감지
- [ ] “Welcome”/“ready”는 case-insensitive로 처리
- [ ] 가능하면 readOutput의 프롬프트 복귀 감지 로직과 초기화 감지 로직을 재사용/공유:contentReference[oaicite:25]{index=25}

테스트:
- [ ] 링버퍼에 실제 프롬프트가 있는데 timeout 나던 케이스가 해결되는지 확인

### C2. 개행 처리(\r vs \n) OS별 분기
문서상 spawn과 sendPrompt에서 `\r`를 사용한다:contentReference[oaicite:26]{index=26}.
환경에 따라 “명령이 실행되지 않는” 문제가 있을 수 있으므로 OS별로 안전한 개행을 적용.

해야 할 일:
- [ ] Windows: 기존 유지(\r or \r\n)
- [ ] mac/linux: \n 우선 적용
- [ ] 최소한 claudeCmd 실행 write는 OS별 분기

테스트:
- [ ] mac/linux에서 “claude 실행이 안 됨”이 재현되면 분기 적용 후 해결되는지 확인

### C3. CI=true 영향 A/B 테스트 및 옵션화
문서상 env에 CI=true를 강제한다:contentReference[oaicite:27]{index=27}.
CLI가 CI 환경에서 출력/인터랙션 모드를 바꾸면 초기화 감지 실패 가능.

해야 할 일:
- [ ] CI=true 제거 빌드로 A/B 테스트
- [ ] 성공률 차이가 유의미하면:
  - (옵션1) 기본은 CI 미설정, 필요 시만 설정
  - (옵션2) 설정 플래그로 토글 가능하게(예: provider 설정)

테스트:
- [ ] 동일 머신/동일 명령에서 CI on/off 비교 로그 저장

### C4. PATH/claude 커맨드 선검증 (fail fast)
mac/linux는 `claude`가 PATH에 있다고 가정한다:contentReference[oaicite:28]{index=28}.
이 가정이 깨지면 “prompt 감지 timeout”으로만 보이는 문제가 발생.

해야 할 일:
- [ ] spawn 전에 `which claude`(unix) / `where.exe claude`(win) 실행
- [ ] 실패 시 즉시 명확한 에러 반환:
  - “Claude CLI not found in PATH. Set CLAUDE_CODE_PATH or install Claude CLI”
- [ ] (가능하면) 검증 결과를 로그로 남김

테스트:
- [ ] PATH 제거 환경에서 즉시 fail fast 되는지 확인(10초 기다리지 않게)

## 3) 변경 파일 후보
- packages/orchestrator/src/terminal/adapters/claude-code-adapter.ts:contentReference[oaicite:29]{index=29}
  - waitForPrompt 개선
  - write 개행 분기
  - CI 옵션화
  - which/where 선검증 로직
- (선택) provider 설정 스키마/설정 파일 (CI 토글/CLAUDE_CODE_PATH 안내)

## 4) 완료 기준
- [ ] 초기화 성공률 증가(테스트 20회 중 19회 이상 등 기준을 팀에서 정의)
- [ ] PATH 문제는 즉시 에러로 분리
- [ ] 프롬프트 변형에도 waitForPrompt가 성공
- [ ] CI on/off에서 최소 1개 이상 환경에서 개선 효과 확인
