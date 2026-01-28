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
│  - cafe.ts              │            │  - zustand stores               │
│  - order.ts             │            │  - @radix-ui components         │
│  - workflow.ts          │            │  - tailwindcss                  │
│  - terminal.ts          │            │                                 │
│  - provider.ts          │            │  hooks/                         │
│  - worktree.ts          │            │  - useCafeHandlers              │
│  - skill.ts             │            │  - useOrderHandlers             │
│  - dialog.ts            │            │  - useRecipeHandlers            │
│  - system.ts            │            │                                 │
│  - execution-facade.ts  │            │  utils/terminal-log/            │
│                         │            │  - parser.ts                    │
│  services/              │            │  - summarizer.ts                │
│  - workflow-service.ts  │            │  - tool-extractor.ts            │
│  - order-service.ts     │            │                                 │
└─────────────────────────┘            └─────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│  execution-manager.ts                                                 │
│  initExecutionManager()                                               │
│  - ExecutionFacade 연동 (from orchestrator)                            │
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
| `src/main/execution-manager.ts` | 실행 관리 | `initExecutionManager()`, `getExecutionManager()` |
| `src/main/file-logger.ts` | 파일 로깅 | `setupMainProcessLogger()` |
| **Main Services** | | |
| `src/main/services/workflow-service.ts` | Workflow 서비스 | `WorkflowService` |
| `src/main/services/order-service.ts` | Order 서비스 | `OrderService` |
| **Main Config** | | |
| `src/main/config/terminal-pool.config.ts` | Terminal Pool 설정 | 풀 설정 |
| **IPC Handlers** | | |
| `src/main/ipc/cafe.ts` | Cafe 관리 | `registerCafeHandlers()` |
| `src/main/ipc/order.ts` | Order 관리 | `registerOrderHandlers()` |
| `src/main/ipc/workflow.ts` | Workflow 관리 | `registerWorkflowHandlers()` |
| `src/main/ipc/terminal.ts` | Terminal 관리 | `registerTerminalHandlers()` |
| `src/main/ipc/provider.ts` | Provider 관리 | `registerProviderHandlers()` |
| `src/main/ipc/worktree.ts` | Worktree 관리 | `registerWorktreeHandlers()` |
| `src/main/ipc/skill.ts` | Skill 관리 | `registerSkillHandlers()` |
| `src/main/ipc/dialog.ts` | 다이얼로그 | `registerDialogHandlers()` |
| `src/main/ipc/system.ts` | 시스템 정보 | `registerSystemHandlers()` |
| `src/main/ipc/execution-facade.ts` | ExecutionFacade 연동 | `registerExecutionFacadeHandlers()` |
| `src/main/ipc/types.ts` | IPC 타입 | 핸들러 타입 정의 |
| **IPC Handlers (subfolder)** | | |
| `src/main/ipc/handlers/order.handler.ts` | Order 핸들러 | Order IPC 핸들러 |
| `src/main/ipc/handlers/workflow.handler.ts` | Workflow 핸들러 | Workflow IPC 핸들러 |
| **IPC Utils** | | |
| `src/main/ipc/utils/output-interval-manager.ts` | 출력 인터벌 관리 | `OutputIntervalManager` |
| **Renderer Stores (zustand)** | | |
| `src/renderer/store/useCafeStore.ts` | Cafe 상태 | `useCafeStore` |
| `src/renderer/store/useOrderStore.ts` | Order 상태 | `useOrderStore` |
| `src/renderer/store/useBaristaStore.ts` | Barista 상태 | `useBaristaStore` |
| `src/renderer/store/useTerminalStore.ts` | Terminal 상태 | `useTerminalStore` |
| `src/renderer/store/useViewStore.ts` | View 상태 | `useViewStore` |
| `src/renderer/store/useSettingsStore.ts` | Settings 상태 | `useSettingsStore` |
| **Renderer Hooks** | | |
| `src/renderer/hooks/useCafeHandlers.ts` | Cafe 핸들러 | `useCafeHandlers` |
| `src/renderer/hooks/useOrderHandlers.ts` | Order 핸들러 | `useOrderHandlers` |
| `src/renderer/hooks/useRecipeHandlers.ts` | Recipe 핸들러 | `useRecipeHandlers` |
| `src/renderer/hooks/useSkillHandlers.ts` | Skill 핸들러 | `useSkillHandlers` |
| `src/renderer/hooks/useBaristas.ts` | Barista 관리 | `useBaristas` |
| `src/renderer/hooks/useOrders.ts` | Order 관리 | `useOrders` |
| `src/renderer/hooks/useIpcEffect.ts` | IPC 이펙트 | `useIpcEffect` |
| `src/renderer/hooks/useSmartScroll.ts` | 스마트 스크롤 | `useSmartScroll` |
| `src/renderer/hooks/useStageTracking.ts` | Stage 추적 | `useStageTracking` |
| **Renderer Utils** | | |
| `src/renderer/utils/terminal-log/parser.ts` | 로그 파싱 | `parseTerminalLog` |
| `src/renderer/utils/terminal-log/summarizer.ts` | 로그 요약 | `summarizeLog` |
| `src/renderer/utils/terminal-log/tool-extractor.ts` | 도구 추출 | `extractTools` |
| `src/renderer/utils/terminal-log/formatter.ts` | 로그 포맷 | `formatLog` |
| `src/renderer/utils/terminal-log/content-detector.ts` | 콘텐츠 감지 | `detectContent` |
| `src/renderer/utils/cn.ts` | 클래스명 유틸 | `cn` |
| `src/renderer/utils/formatters.ts` | 포맷터 | 포맷 유틸 |
| `src/renderer/utils/converters.ts` | 컨버터 | 변환 유틸 |
| **Renderer i18n** | | |
| `src/renderer/i18n/index.ts` | i18n 설정 | i18n 초기화 |
| `src/renderer/i18n/translations.ts` | 번역 리소스 | 번역 데이터 |
| `src/renderer/i18n/useTranslation.ts` | 번역 훅 | `useTranslation` |
| **Renderer Types** | | |
| `src/renderer/types/models.ts` | 모델 타입 | 도메인 모델 타입 |
| `src/renderer/types/terminal.ts` | Terminal 타입 | Terminal 관련 타입 |
| `src/renderer/types/design.ts` | 디자인 타입 | UI 디자인 타입 |
| **Common** | | |
| `src/common/ipc-types.ts` | IPC 타입 정의 | IPC 메시지 타입 |
| `src/common/output-markers.ts` | 출력 마커 | 마커 상수 |
| `src/common/output-utils.ts` | 출력 유틸 | 출력 관련 유틸 |

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
