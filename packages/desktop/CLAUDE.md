# @codecafe/desktop

> Electron 기반 데스크톱 GUI 애플리케이션

## Flow

```
[Electron 앱 시작]
        │
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│  src/main/index.ts:185-203                                            │
│  app.whenReady()                                                      │
│  1. initExecutionFacade() → ExecutionFacade 초기화                     │
│     └─ initExecutionManager() → BaristaEngineV2 연동 (내부 호출)        │
│  2. setupIpcHandlers() → IPC 핸들러 등록                               │
│  3. createWindow() → BrowserWindow 생성                               │
└───────────────────────────────────────────────────────────────────────┘
        │
        ├──────────────────────────────────────────────────┐
        │                                                  │
        ▼                                                  ▼
┌─────────────────────────┐            ┌─────────────────────────────────┐
│  Main Process           │◀──IPC────▶│  Renderer Process               │
│                         │            │                                 │
│  ipc/*.ts               │            │  React UI                       │
│  - cafe.ts              │            │  - zustand store                │
│  - order.ts             │            │  - @radix-ui components         │
│  - workflow.ts          │            │  - tailwindcss                  │
│  - terminal.ts          │            │                                 │
│  - provider.ts          │            │  utils/terminal-log/            │
│  - worktree.ts          │            │  - parser.ts                    │
│  - skill.ts             │            │  - summarizer.ts                │
│  - dialog.ts            │            │  - tool-extractor.ts            │
│  - system.ts            │            │                                 │
│  - execution-facade.ts  │            │                                 │
└─────────────────────────┘            └─────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│  execution-manager.ts                                                 │
│  initExecutionManager()                                               │
│  - ExecutionFacade 생성 (from orchestrator)                            │
│  - Order 실행 관리                                                     │
│  - 이벤트 → Renderer 전달                                              │
└───────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│  @codecafe/orchestrator                                               │
│  ExecutionFacade                                                      │
└───────────────────────────────────────────────────────────────────────┘
```

## File Map

| 경로 | 역할 | 핵심 Export |
|------|------|-------------|
| **Main Process** | | |
| `src/main/index.ts` | Electron 메인 진입점 | app lifecycle |
| `src/main/execution-manager.ts` | 실행 관리 | `initExecutionManager()`, `getExecutionManager()`, `cleanupExecutionManager()` |
| `src/main/file-logger.ts` | 파일 로깅 | `setupMainProcessLogger()` |
| **IPC Handlers** | | |
| `src/main/ipc/cafe.ts` | Cafe 관리 | `registerCafeHandlers()` |
| `src/main/ipc/order.ts` | Order 관리 | `registerOrderHandlers()`, `cleanupOrderHandlers()` |
| `src/main/ipc/workflow.ts` | Workflow 관리 | `registerWorkflowHandlers()` |
| `src/main/ipc/terminal.ts` | Terminal 관리 | `registerTerminalHandlers()` |
| `src/main/ipc/provider.ts` | Provider 관리 | `registerProviderHandlers()` |
| `src/main/ipc/worktree.ts` | Worktree 관리 | `registerWorktreeHandlers()` |
| `src/main/ipc/skill.ts` | Skill 관리 | `registerSkillHandlers()` |
| `src/main/ipc/dialog.ts` | 다이얼로그 | `registerDialogHandlers()` |
| `src/main/ipc/system.ts` | 시스템 정보 | `registerSystemHandlers()` |
| `src/main/ipc/execution-facade.ts` | ExecutionFacade 연동 | `registerExecutionFacadeHandlers()` |
| `src/main/ipc/types.ts` | IPC 타입 | IPC handler types |
| `src/main/ipc/handlers/*.ts` | 핸들러 모듈 | `workflow.handler.ts`, `order.handler.ts` |
| `src/main/ipc/utils/*.ts` | IPC 유틸 | `output-interval-manager.ts` |
| **Services** | | |
| `src/main/services/index.ts` | 서비스 모듈 | Service exports |
| `src/main/services/workflow-service.ts` | Workflow 서비스 | Workflow operations |
| `src/main/services/order-service.ts` | Order 서비스 | Order operations |
| **Config** | | |
| `src/main/config/terminal-pool.config.ts` | Terminal Pool 설정 | Pool configuration |
| **Preload** | | |
| `src/preload/index.cjs` | Context Bridge | 보안 브리지 |
| **Renderer** | | |
| `src/renderer/utils/terminal-log/` | 로그 파싱 | `parser`, `summarizer`, `tool-extractor`, `formatter`, `content-detector` |
| `src/renderer/utils/terminal-log-parser.ts` | 로그 파서 | Legacy parser |
| `src/renderer/utils/converters.ts` | 변환 유틸 | Data converters |
| `src/renderer/utils/formatters.ts` | 포맷 유틸 | Data formatters |
| `src/renderer/utils/cn.ts` | 클래스 유틸 | `cn()` |
| `src/renderer/store/*.ts` | Zustand 스토어 | `useCafeStore`, `useOrderStore`, `useBaristaStore`, `useTerminalStore`, `useSettingsStore`, `useViewStore` |
| `src/renderer/hooks/*.ts` | React Hooks | `useBaristas`, `useOrders`, `useCafeHandlers`, `useOrderHandlers`, `useIpcEffect`, etc. |
| `src/renderer/i18n/*.ts` | 다국어 지원 | `useTranslation`, `translations` |
| `src/renderer/types/*.ts` | 타입 정의 | `models.ts`, `terminal.ts`, `design.ts` |
| `src/renderer/components/terminal/` | Terminal UI | Terminal components |
| `src/renderer/components/views/` | View UI | View components |
| **Common** | | |
| `src/common/ipc-types.ts` | IPC 타입 정의 | IPC 메시지 타입 |
| `src/common/output-markers.ts` | 출력 마커 | 마커 상수 |
| `src/common/output-utils.ts` | 출력 유틸 | Output utilities |

## IPC Channels

| Channel | 방향 | 설명 |
|---------|------|------|
| `cafe:*` | Main ↔ Renderer | Cafe CRUD |
| `order:*` | Main ↔ Renderer | Order 실행/관리 |
| `workflow:*` | Main ↔ Renderer | Workflow 관리 |
| `terminal:*` | Main ↔ Renderer | Terminal Pool 상태 |
| `provider:*` | Main ↔ Renderer | Provider 설정 |
| `worktree:*` | Main ↔ Renderer | Git Worktree 관리 |
| `skill:*` | Main ↔ Renderer | Skill 조회 |
| `dialog:*` | Main ↔ Renderer | 파일/폴더 선택 |
| `system:*` | Main ↔ Renderer | 시스템 정보 |

## Event Flow (Order Execution)

```
ExecutionFacade                  Main Process              Renderer
      │                               │                        │
      ├──'order:started'─────────────▶│                        │
      │                               ├──mainWindow.send()────▶│
      │                               │                        │
      ├──'order:output'──────────────▶│                        │
      │                               ├──mainWindow.send()────▶│
      │                               │                        │
      ├──'stage:completed'───────────▶│                        │
      │                               ├──mainWindow.send()────▶│
      │                               │                        │
      ├──'order:completed'───────────▶│                        │
      │                               ├──mainWindow.send()────▶│
```

## Dependencies

- **상위**: (최상위 UI 패키지)
- **하위**: `@codecafe/core`, `@codecafe/orchestrator`, `@codecafe/git-worktree`
- **외부**: `electron`, `react`, `react-dom`, `zustand`, `@radix-ui/*`, `tailwindcss`, `i18next`

## Review Checklist

이 패키지 변경 시 확인:
- [ ] IPC 채널 추가 시 → `ipc-types.ts` 업데이트, preload 노출
- [ ] ExecutionFacade API 변경 시 → execution-manager 수정
- [ ] 이벤트 페이로드 변경 시 → Renderer 핸들러 확인
- [ ] Context Bridge 변경 시 → 보안 검토 (nodeIntegration: false 유지)

## Security

```typescript
// preload.ts: 안전한 API만 노출
contextBridge.exposeInMainWorld('api', {
  // 허용된 IPC 메서드만 노출
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, callback) => ipcRenderer.on(channel, callback),
});
```

- `nodeIntegration: false` 필수
- `contextIsolation: true` 필수
- 민감한 Node.js API 직접 노출 금지
