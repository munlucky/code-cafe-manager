# CodeCafe Desktop - Claude CLI 통합 테스트 리포트 템플릿

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

- 작성자:
- 작성일:
- 브랜치/커밋:
- Desktop 버전:
- Orchestrator(터미널/어댑터) 버전:
- 테스트 실행 횟수(총):
- 테스트 기간(시작~종료):
- 이슈 트래커 링크(있다면):

---

## 2) 테스트 환경 정보 (필수)

### 2-1. OS/하드웨어
- OS:
  - [ ] Windows 10
  - [ ] Windows 11
  - [ ] macOS (버전: )
  - [ ] Linux (배포판/버전: )
- CPU:
- RAM:
- 디스크:
- GPU(있다면):

### 2-2. 셸/터미널
- 앱에서 spawn되는 셸:
  - Windows: PowerShell (버전: )
  - macOS/Linux: bash (버전: )
- 사용자 기본 로그인 셸(참고):
  - [ ] bash
  - [ ] zsh
  - [ ] fish
  - [ ] 기타:

### 2-3. Claude CLI 상태
- 설치 방식:
  - [ ] 공식 설치
  - [ ] brew
  - [ ] pipx
  - [ ] 기타:
- `claude --version` 결과:
- 로그인 상태:
  - [ ] 로그인 완료
  - [ ] 로그인 필요(추정)
  - [ ] 불명(로그로 판단)

### 2-4. 환경변수/플래그
- `CLAUDE_CODE_PATH`:
  - 값:
  - 적용 여부: [ ] 적용 [ ] 미적용
- `CI`:
  - 값:
  - 적용 여부: [ ] 적용 [ ] 미적용
- 디버그 로그 플래그(있는 경우):
  - 키/값:
  - 적용 여부: [ ] 적용 [ ] 미적용

---

## 3) 실행 시나리오(이번 테스트에서 사용한 프롬프트/조건)

### 3-1. 기본 실행 프롬프트(짧은 출력)
- Prompt A:
- 기대 출력(대략):

### 3-2. 대량 출력 프롬프트(스트리밍/성능)
- Prompt B:
- 기대 출력(대략):

### 3-3. 입력 대기(상호작용) 프롬프트
- Prompt C:
- 기대 흐름:
  - CLI가 질문/입력을 요구 → sendInput 전송 → 출력 재개

---

## 4) 케이스별 테스트 결과 요약(필수)

> 06_test_matrix.md의 Case ID를 사용해 기록한다.
> 예: W-PS-01, M-BASH-01, M-ZSH-02, L-BASH-01 등

### 4-1. 테스트 케이스 정보
- Case ID:
- OS/셸:
- 실행 조건(특이사항):
  - (예: CI on/off, CLAUDE_CODE_PATH 설정, PATH 수정 등)

### 4-2. 레벨별 결과(체크)
- L0 (외부 터미널에서 claude 실행 가능):
  - [ ] PASS  [ ] FAIL
  - 비고:
- L1 (앱에서 초기화 성공: waitForPrompt 통과):
  - [ ] PASS  [ ] FAIL
  - 성공률: __ / __
- L2 (출력 스트리밍: order:output UI 표시):
  - [ ] PASS  [ ] FAIL
  - 성공률: __ / __
- L3 (입력 전송: sendInput → 출력 반응):
  - [ ] PASS  [ ] FAIL
  - 성공률: __ / __
- L4 (실패 분리 + 프로세스 정리):
  - [ ] PASS  [ ] FAIL
  - 성공률: __ / __

### 4-3. 한 줄 결론(필수)
- 예: “PATH 문제로 fail-fast 정상 동작, CLAUDE_CODE_PATH로 해결됨”
- 예: “프롬프트는 뜨나 유니코드 prompt 감지 실패로 timeout 발생(감지 로직 보완 필요)”

---

## 5) 실행 로그/증거(필수)

### 5-1. 성공 케이스 로그 하이라이트
- 초기화 구간(요약):
  - shell ready까지:
  - claude 실행 write 이후:
  - waitForPrompt 성공 근거(출력 일부):
- 출력 스트리밍(요약):
  - order:output 첫 chunk 시점:
  - 마지막 chunk 시점:
- 입력(sendInput) 관련:
  - 입력 전송 시점:
  - 출력 반응 증거:

### 5-2. 실패 케이스 로그 하이라이트 (링버퍼/초기화 chunk)
> timeout 또는 실패 시 “startup output ring buffer” 상위 N줄을 붙여넣는다.

- 실패 시점:
- 실패 유형(선택):
  - [ ] PATH/command not found
  - [ ] waitForPrompt 감지 실패(프롬프트는 보이는데 못 잡음)
  - [ ] CLI hang(추정: 로그인/권한/초기 설정/업데이트)
  - [ ] pty.spawn/shell 문제
  - [ ] 기타:
- 링버퍼(상위 10~30줄):
```text
(여기에 붙여넣기)

5-3. 스크린샷/영상(있다면)

링크/경로:

6) 원인 분석(필수)
6-1. 1차 원인(가장 유력한 것 1개)

원인:

근거 로그/증거:

재현 조건:

빈도:

6-2. 2차 원인(있다면)

원인:

근거:

빈도:

6-3. 반증/제외된 가설

가설:

왜 제외했는지(로그/테스트 근거):

7) 조치/패치 제안(필수)
7-1. 즉시 조치(Hotfix 후보)

 prompt 감지 로직 보완(정규식/대소문자/유니코드)

 개행 처리(OS별 \n/\r\n)

 CI 설정 변경/옵션화

 PATH 선검증 + fail-fast

 timeout 정책 조정(활동 기반 연장)

 실패 시 PTY kill/정리

기타:

7-2. 코드 변경 포인트(파일/함수 레벨)

파일:

변경 예상:

파일:

변경 예상:

7-3. 테스트 재검증 계획

어떤 케이스를 재실행할지:

성공 기준:

8) 최종 결론/다음 액션(필수)

결론:

다음 액션(우선순위 순):
1)
2)
3)

담당자/기한(선택):

담당자:

목표일:

9) 부록: 재현 커맨드 기록(선택)
9-1. Windows PowerShell
where.exe claude
claude --version
claude

9-2. macOS/Linux
which claude
claude --version || true
claude

9-3. macOS zsh vs bash PATH 비교
zsh -lc 'echo "ZSH login PATH: $PATH"; which claude || true'
bash -lc 'echo "BASH login PATH: $PATH"; which claude || true'