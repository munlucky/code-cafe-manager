# @codecafe/core

> 도메인 모델, 타입 정의, 스키마 검증을 담당하는 기초 패키지

## Flow

```
[외부 패키지]
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│  index.ts:6-39                                              │
│  - types, managers, schemas 전체 export                     │
└─────────────────────────────────────────────────────────────┘
     │
     ├──────────────────────────────────────┐
     │                                      │
     ▼                                      ▼
┌─────────────────┐              ┌─────────────────────────┐
│  Domain Models  │              │       Managers          │
│                 │              │                         │
│  types.ts       │              │  barista.ts:8-131       │
│  :6-12 Enums    │◀─────────────│  BaristaManager         │
│  :37-45 Barista │              │  - create/remove/get    │
│  :50-82 Order   │              │  - status update        │
│  :87-97 Receipt │              │                         │
│                 │              │  order.ts:8-256         │
│                 │◀─────────────│  OrderManager           │
│                 │              │  - create/assign/update │
└─────────────────┘              └─────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│  Schema Validation (Zod)                                    │
│                                                             │
│  schema/cafe.ts       : Cafe 설정 스키마                     │
│  schema/terminal.ts   : Terminal 설정 스키마                 │
│  schema/role.ts       : Role 정의 스키마                     │
│  schema/workflow.ts   : Workflow 정의 스키마                 │
│  schema/provider.ts   : Provider 설정 스키마                 │
└─────────────────────────────────────────────────────────────┘
```

## File Map

| 파일 | 역할 | 핵심 Export |
|------|------|-------------|
| `src/index.ts` | 패키지 진입점 | 모든 public API |
| `src/types.ts` | 도메인 타입 | `Barista`, `Order`, `Receipt`, `BaristaStatus`, `OrderStatus` |
| `src/barista.ts` | Barista 관리 | `BaristaManager` |
| `src/order.ts` | Order 관리 | `OrderManager` |
| `src/storage.ts` | 저장소 인터페이스 | `Storage` |
| `src/log-manager.ts` | 로깅 | `LogManager` |
| `src/types/cafe.ts` | Cafe 타입 | `Cafe`, `CafeConfig` |
| `src/types/terminal.ts` | Terminal 타입 | `Terminal`, `TerminalPoolConfig` |
| `src/types/role.ts` | Role 타입 | `Role` |
| `src/types/step.ts` | Step 타입 | `Step`, `StageConfig` |
| `src/schema/*.ts` | Zod 스키마 | `CafeSchema`, `RoleSchema`, `WorkflowSchema`, `ProviderSchema`, etc. |
| `src/utils/index.ts` | 유틸리티 | `TypedEventEmitter`, `TypeGuards`, `EventListenerManager` |
| `src/errors/index.ts` | 에러 클래스 | `BaseError`, `ErrorCode`, specific errors |
| `src/constants/timeouts.ts` | 타임아웃 상수 | `TIMEOUTS` |
| `src/logging/index.ts` | 로깅 유틸 | `createLogger`, `Logger` |

## Domain Model

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Barista    │────────▶│    Order     │────────▶│   Receipt    │
│              │  1:N    │              │  1:1    │              │
│  - id        │         │  - id        │         │  - orderId   │
│  - status    │         │  - status    │         │  - status    │
│  - provider  │         │  - workflowId│         │  - logs      │
│  - role      │         │  - counter   │         │              │
└──────────────┘         │  - prompt    │         └──────────────┘
                         │  - worktree  │
                         └──────────────┘
```

## Dependencies

- **상위 (이 패키지를 사용)**: `orchestrator`, `cli`, `desktop`, `git-worktree`
- **하위 (이 패키지가 사용)**: `zod`, `yaml` (외부 라이브러리만)

## Review Checklist

이 패키지 변경 시 확인:
- [ ] `types.ts` 변경 시 → orchestrator, desktop 영향 확인
- [ ] `BaristaManager`/`OrderManager` API 변경 시 → orchestrator 호환성
- [ ] Schema 변경 시 → YAML/JSON 파싱 로직 확인
- [ ] Export 추가/제거 시 → index.ts 업데이트

## Naming Convention

- **Status Enum**: `{Entity}Status` (예: `BaristaStatus`, `OrderStatus`)
- **Manager Class**: `{Entity}Manager`
- **Schema**: `{Entity}Schema`
- **Type**: PascalCase (예: `Barista`, `Order`)
