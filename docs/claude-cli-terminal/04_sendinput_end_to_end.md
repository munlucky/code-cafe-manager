# P1 - 사용자 입력(sendInput) End-to-End 구현/검증

## 1) 목표
- 실행 중 사용자 입력이 CLI로 전달되어, 실제 출력 변화로 확인된다.
- 문서상 입력 경로(UI->IPC->Orchestrator->Engine->Session->TerminalGroup->PTY.write)가 실제 코드에도 존재/동작하는지 확인한다:contentReference[oaicite:37]{index=37}.

## 2) 체크 포인트(“구조 문제” vs “구현 누락” 빠른 판별)
문서에는 sendInput 흐름이 정의돼 있음:contentReference[oaicite:38]{index=38}.
따라서 문제는 대개:
- Desktop IPC 핸들러가 실제로 없음
- preload에서 api 노출이 없음
- renderer에서 호출 UI/로직이 없음
- or engine/session routing이 끊김
중 하나(=구현 completeness)일 가능성이 큼.

## 3) 작업 항목(Commit 단위)
### C1. Desktop Main IPC: order:sendInput 핸들러 존재 확인/추가
- [ ] packages/desktop/src/main/ipc/order.ts에 `ipcMain.handle('order:sendInput', ...)` 구현 확인
- [ ] 없다면 추가:
  - orchestrator.sendInput(orderId, message) 또는 적절한 경로 호출:contentReference[oaicite:39]{index=39}

### C2. Preload: window.api.order.sendInput 노출 확인/추가
- [ ] packages/desktop/src/preload/... 에 API 브리지 추가
- [ ] 타입 정의/인텔리센스 반영

### C3. Renderer: 입력 UI + 호출 연결
- [ ] OrderTerminals 또는 OrderDetail에서 입력 UI(텍스트박스/전송버튼) 추가
- [ ] 실행 중인 orderId에 대해 sendInput 호출
- [ ] 입력 후 출력이 order:output으로 이어지는지 확인:contentReference[oaicite:40]{index=40}

### C4. Engine/Session 라우팅 점검
- [ ] BaristaEngineV2.sendInput(orderId, message)가 activeExecutions(session/lease)에 라우팅되는지 확인:contentReference[oaicite:41]{index=41}
- [ ] session 존재 시: session.sendInput -> terminalGroup.sendInput -> pty.write 동작 확인:contentReference[oaicite:42]{index=42}
- [ ] session 부재(legacy 모드) 시: lease.terminal.process.write(message + '\n') 동작 확인:contentReference[oaicite:43]{index=43}

### C5. 오류 처리/UX
- [ ] 실행 중이 아닌 orderId에 입력하면 명확한 에러 반환("Order not running")
- [ ] 입력 전송 성공 시 UI에 “sent” 표시(옵션)

## 4) 변경 파일 후보
- packages/desktop/src/main/ipc/order.ts:contentReference[oaicite:44]{index=44}:contentReference[oaicite:45]{index=45}
- packages/desktop/src/preload/index.ts (또는 api bridge 파일):contentReference[oaicite:46]{index=46}
- packages/desktop/src/renderer/components/terminal/OrderTerminals.tsx:contentReference[oaicite:47]{index=47}
- packages/orchestrator/src/barista/barista-engine-v2.ts:contentReference[oaicite:48]{index=48}
- packages/orchestrator/src/session/order-session.ts, terminal-group.ts:contentReference[oaicite:49]{index=49}

## 5) 완료 기준
- [ ] 실행 중 입력 1회가 CLI에 전달되고
- [ ] 이에 대한 반응 출력이 order:output으로 UI에 표시됨:contentReference[oaicite:50]{index=50}
- [ ] 실행 중이 아니면 올바른 에러를 반환
