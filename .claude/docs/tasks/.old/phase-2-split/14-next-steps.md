# Next Steps

## 11. Next Steps

### 즉시 (Phase 2 시작 전)
1. **node-pty 빌드 검증**
   ```bash
   pnpm install
   pnpm rebuild node-pty --runtime=electron --target=<electron-version>
   ```
2. **Phase 1 완료 상태 확인**
   - Global Lobby 동작 확인
   - Cafe Registry JSON 존재 확인
   - IPC handlers 동작 확인

### Step 1 시작 (Day 1)
3. **Core Types 작성**
   - `terminal.ts`, `role.ts` 타입 정의
   - LeaseToken, PoolMetrics 추가 (Gap 2)
   - Zod 스키마 작성
   - typecheck 검증

### Step 2 시작 (Day 2)
4. **Terminal Pool 구현 + Provider Adapter (Gap 1)**
   - `provider-adapter.ts` 인터페이스
   - `claude-code-adapter.ts`, `codex-adapter.ts`
   - `terminal-pool.ts` (LeaseManager 통합, Gap 2)
   - Crash recovery 로직 (Gap 5)

### 지속 (전체 Phase 2)
5. **문서 동기화**
   - 각 Step 완료 시 `.claude/context.md` 업데이트
   - 변경사항 로그 기록
6. **일일 Checkpoint**
   - 매일 typecheck + test 실행
   - 문제 발생 시 즉시 기록 및 해결

---

## 12. References

### Parent Documents
- `.claude/context.md`: 전체 구현 계획
- `.claude/docs/requirements.md`: Requirements Analysis
- `.claude/PROJECT.md`: 프로젝트 규칙

### Related Files
- `packages/core/src/barista.ts`: 기존 Barista 구현
- `packages/core/src/types.ts`: 기존 타입 정의
- `packages/desktop/src/renderer/App.tsx`: 라우팅 설정

### External Dependencies
- [node-pty Documentation](https://github.com/microsoft/node-pty)
- [p-limit Documentation](https://github.com/sindresorhus/p-limit)
- [gray-matter Documentation](https://github.com/jonschlinkert/gray-matter)
- [Handlebars Documentation](https://handlebarsjs.com/)

---

## Appendix: Gap Resolution Summary

| Gap | Resolution | Files Added/Modified | Section |
|-----|------------|----------------------|---------|
| **Gap 1: Terminal Execution Contract** | IProviderAdapter + Concrete Adapters | 4 new files | 2.3 |
| **Gap 2: TerminalPool Concurrency** | LeaseToken + LeaseManager + p99 metrics | 2 new files, TerminalPool updated | 2.4 |
| **Gap 3: IPC/UI API Contracts** | Full IPC spec + Zod schemas + Error codes | IPC handlers updated | 2.5 |
| **Gap 4: Backward Compatibility** | BaristaEngineV2 + LegacyAdapter + generic-agent | 3 new files | 2.6 |
| **Gap 5: Crash Recovery** | State machine + Auto-restart + Caller retry | TerminalPool updated, 1 test file | 2.7 |

**Total New Files**: 34 (원본 27 + Gap 해결용 7)

---

**문서 버전**: v2.0
**작성자**: Context Builder Agent
**최종 업데이트**: 2026-01-12
**상태**: Ready for Re-Validation by Plan Reviewer