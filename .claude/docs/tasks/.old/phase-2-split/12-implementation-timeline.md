# Implementation Timeline

## 9. Implementation Timeline

| Day | Task | Deliverable | Checkpoint |
|-----|------|-------------|------------|
| 1 | Step 1: Core Types & Interfaces | 5개 타입 파일, 2개 스키마, LeaseToken/PoolMetrics 추가 | typecheck 통과 |
| 2 | Step 2-1: Terminal Pool (Core + Adapter) | terminal-pool.ts, provider-adapter.ts, adapters | spawn/lease/release 동작 (Gap 1) |
| 3 | Step 2-2: Terminal Pool (Tests + Crash) | terminal-pool.test.ts, crash recovery | 단위 테스트 통과 (Gap 2, 5) |
| 4 | Step 3-1: Role Templates | 5개 .md 파일 (generic-agent 포함) | Markdown 검증 (Gap 4) |
| 5 | Step 3-2: Role Registry | role-parser.ts, role-registry.ts | 5개 Role 로드 성공 |
| 6 | Step 4-1: Barista Refactoring | barista-engine-v2.ts, legacy-adapter.ts | typecheck 통과 (Gap 4) |
| 7 | Step 4-2: Barista Integration | Integration test | Barista + Terminal + Adapter 통합 동작 |
| 8 | Step 5-1: IPC Handlers | role.ts, terminal.ts (with error handling) | IPC 응답 + 에러 처리 확인 (Gap 3) |
| 9 | Step 5-2: UI Store & Components | useRoleStore, RoleManager, OrderCreationKiosk | UI 렌더링 확인 |
| 10 | Step 5-3: UI Integration & Polish | App.tsx 업데이트, 라우팅, 에러 표시 | E2E 테스트 |

**Total**: 10 working days (~2 weeks)

---

**다음 문서:** [13-open-questions.md](13-open-questions.md) - Open Questions