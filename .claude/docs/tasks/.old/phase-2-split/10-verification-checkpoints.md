# Verification Checkpoints

## 7. Verification Checkpoints

### Checkpoint 1: Core Types (Day 1 End)
```bash
cd packages/core
pnpm typecheck
```
- [ ] All type files compile without errors
- [ ] Zod schemas validate correctly
- [ ] LeaseToken and PoolMetrics types defined (Gap 2)

### Checkpoint 2: Terminal Pool (Day 3 End)
```bash
cd packages/orchestrator
pnpm typecheck
pnpm test src/terminal
```
- [ ] Terminal spawn/lease/release works with adapters (Gap 1)
- [ ] LeaseToken tracking works correctly (Gap 2)
- [ ] p99 wait time measurement works (Gap 2)
- [ ] Semaphore concurrency control works
- [ ] Crash recovery works (Gap 5)
- [ ] Unit tests pass (>90% coverage)

### Checkpoint 3: Role Registry (Day 5 End)
```bash
cd packages/orchestrator
pnpm typecheck
pnpm test src/role
node -e "import { RoleRegistry } from './dist/role/role-registry.js'; const r = new RoleRegistry(); await r.load(); console.log(r.list());"
```
- [ ] 5 default roles load successfully (4 + generic-agent, Gap 4)
- [ ] Frontmatter validation works
- [ ] Handlebars template rendering works
- [ ] Unit tests pass

### Checkpoint 4: Barista Refactoring (Day 7 End)
```bash
cd packages/orchestrator
pnpm typecheck
pnpm test src/barista
```
- [ ] Barista can lease/release terminal with adapter protocol (Gap 1)
- [ ] BaristaEngineV2 works with Terminal Pool (Gap 4)
- [ ] LegacyBaristaAdapter handles old orders (Gap 4)
- [ ] Prompt rendering with Handlebars works
- [ ] Crash retry logic works (Gap 5)
- [ ] Unit tests pass

### Checkpoint 5: UI Components (Day 10 End)
```bash
cd packages/desktop
pnpm dev
```
- [ ] Role Manager shows 5 default roles (4 + generic-agent, Gap 4)
- [ ] Order Creation Kiosk allows role selection
- [ ] Terminal Pool status visible in UI
- [ ] IPC handlers respond correctly with error handling (Gap 3)
- [ ] Error messages display properly (Gap 3)

### Final Checkpoint: Phase 2 Complete
```bash
# Full build
pnpm build

# Type check all packages
pnpm typecheck

# Run all tests
pnpm test

# Manual E2E test
cd packages/desktop
pnpm dev
# 1. Navigate to /roles → see 5 roles (including generic-agent)
# 2. Navigate to /orders/new → create order with roles
# 3. Execute order → verify terminal lease/release in logs
# 4. Simulate terminal crash → verify auto-recovery
# 5. Check metrics → verify p99 wait time < 1s
```

**Success Criteria (Updated with Gap 해결 확인):**
- [ ] Terminal Pool에서 8개 Terminal로 10개 Order 병렬 실행
- [ ] p99 lease wait time < 1s (Gap 2 검증)
- [ ] Terminal crash during lease → auto-recovery 성공 (Gap 5 검증)
- [ ] Role Manager에서 기본 5종 Role 조회 (Gap 4 확인)
- [ ] Order Creation Kiosk에서 Stage별 Role 선택 → Order 생성
- [ ] Barista가 Terminal Pool에서 lease → execute (adapter 사용) → release 수행 (Gap 1 검증)
- [ ] IPC error handling 동작 (Gap 3 검증)
- [ ] Legacy Order 실행 (Gap 4 검증)

---

**다음 문서:** [11-risk-mitigation.md](11-risk-mitigation.md) - Risk Mitigation