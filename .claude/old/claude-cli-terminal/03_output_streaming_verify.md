# P1 - 출력 스트리밍(order:output) 검증/개선

## 1) 목표
- 초기화가 성공한 뒤, Claude CLI 출력이 order:output으로 UI까지 스트리밍되는지 end-to-end로 확인한다.
- 끊김/유실/성능 문제(대량 출력, 빠른 chunk 연속)를 조기에 발견한다.

## 2) 흐름(참조)
BaristaEngineV2 -> ExecutionManager -> Renderer로 출력 이벤트 전달:contentReference[oaicite:30]{index=30}:contentReference[oaicite:31]{index=31}
- Main -> Renderer Push 채널: order:output:contentReference[oaicite:32]{index=32}

## 3) 작업 항목(Commit 단위)
### C1. Main에서 order:output 이벤트 발생/전송 로깅
- [ ] ExecutionManager가 받은 output 이벤트 로그(주기적으로/샘플링)
- [ ] IPC 전송 횟수/초당 chunk 수 측정(대략)

변경 파일 후보:
- packages/desktop/src/main/execution-manager.ts:contentReference[oaicite:33]{index=33}:contentReference[oaicite:34]{index=34}

### C2. Renderer에서 수신/렌더링 로깅 및 UI 상태 표시
- [ ] Renderer(예: OrderTerminals)에서 order:output 수신 로그(샘플링)
- [ ] “Initializing Claude CLI…” -> “Running…” 상태 표시
- [ ] 렌더링 성능(대량 출력) 문제 있으면:
  - 버퍼링 + requestAnimationFrame 단위 렌더
  - 로그 뷰 virtualization 고려(옵션)

변경 파일 후보:
- packages/desktop/src/renderer/components/terminal/OrderTerminals.tsx (또는 출력 표시 컴포넌트):contentReference[oaicite:35]{index=35}
- packages/desktop/src/renderer/store/useTerminalStore.ts (출력 누적 구조 점검):contentReference[oaicite:36]{index=36}

### C3. 출력 유실/순서 테스트
- [ ] 대량 출력 프롬프트(긴 답변) 실행
- [ ] UI에 chunk 순서가 뒤섞이지 않는지
- [ ] 중간 끊김 없이 마지막까지 도달하는지 확인

## 4) 완료 기준
- [ ] order 실행 시 UI에서 출력이 실시간으로 누적됨
- [ ] 대량 출력에서도 렌더가 멈추지 않음(최소 기준을 정의)
- [ ] 출력 유실/순서 문제 없음(또는 발견 시 이슈화)
