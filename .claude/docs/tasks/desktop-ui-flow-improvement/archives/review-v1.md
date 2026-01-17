# Plan Review v1 - Desktop UI 플로우 개선

**Reviewer**: Claude (Codex fallback)
**Date**: 2026-01-15
**Plan**: `.claude/docs/tasks/desktop-ui-flow-improvement/context.md` (v1.0)

## 판정: APPROVE (조건부)

### 평가 요약

| 기준 | 점수 | 평가 |
|------|------|------|
| Clarity (명확성) | ⭐⭐⭐⭐☆ | Phase별 명확한 구분, 코드 예시 포함. Terminal Pool API 불명확 |
| Verifiability (검증 가능성) | ⭐⭐⭐⭐⭐ | 체크포인트 명확, typecheck/build/테스트 단계 구체적 |
| Completeness (완성도) | ⭐⭐⭐⭐☆ | 파일 범위 명시, 보안 고려. Orchestrator API 확인 필수 |
| Big Picture (전체 구조) | ⭐⭐⭐⭐☆ | 사용자 플로우 개선 목표 명확. 기존 에러 수정 누락 |

**총점**: 4/5

## 강점

1. **명확한 Phase 구조**
   - Phase 1-3로 명확히 분리
   - 각 Phase별 목표 및 검증 방법 명시

2. **구체적인 구현 가이드**
   - 파일별 변경사항 명시
   - 코드 예시 포함으로 구현 방향 명확

3. **리스크 관리**
   - Risk & Alternatives 섹션으로 잠재적 문제 인식
   - 보안 고려사항 포함 (execFileNoThrow)

4. **검증 가능성**
   - 각 Phase마다 체크포인트 명시
   - typecheck, build, 수동 테스트 단계 구체적

## Critical Gaps (해결 필요)

### Gap 1: Orchestrator API 불명확 ❗ HIGH
**문제:**
- Phase 2의 핵심인 `orchestrator.getOrderTerminal()` API 존재 여부 불명확
- API 없으면 Phase 2 전체가 차단됨

**영향:**
- Phase 2 구현 불가능 또는 대폭 지연

**해결 방안:**
```markdown
Phase 0 추가:
1. `packages/core/src/orchestrator.ts` 읽고 API 확인
2. 없으면 Terminal Pool 아키텍처 리뷰 후 대안 결정:
   - 대안 A: Orchestrator에 API 추가 (별도 작업, 1-2일 소요)
   - 대안 B: 로그 파일 폴링 방식으로 Phase 2 구현 (실시간성 떨어짐)
```

### Gap 2: Cafe 설정 타입 불명확 ⚠️ MEDIUM
**문제:**
- `cafe.settings.worktreeRoot`, `cafe.settings.baseBranch` 필드 존재 여부 불명확

**해결 방안:**
```markdown
Phase 0 추가:
1. `packages/core/src/types.ts`에서 Cafe 타입 확인
2. 필드 없으면:
   - 타입 정의 추가
   - 기본값 설정 (`worktreeRoot: '.codecafe-worktrees'`, `baseBranch: 'main'`)
```

### Gap 3: 기존 타입 에러 미처리 ⚠️ MEDIUM
**문제:**
- Pre-flight에서 발견한 `OrderStatus` 타입 에러 (useIpcEffect.ts:31,41) 수정 계획 누락

**해결 방안:**
```markdown
Phase 0 추가:
1. `src/renderer/hooks/useIpcEffect.ts` 읽고 에러 원인 분석
2. OrderStatus 타입 정의 확인 및 수정
```

## 개선 권장사항

### 권장사항 1: Phase 0 추가 (필수) ✅
```markdown
### Phase 0: 사전 확인 및 준비 (1일)

#### Step 0.1: Orchestrator API 확인
- `packages/core/src/orchestrator.ts` 읽고 `getOrderTerminal` API 존재 확인
- Terminal Pool 아키텍처 리뷰 (`packages/core/src/executor/terminal-pool.ts`)
- 없으면 대안 결정 (API 추가 vs 로그 폴링)

#### Step 0.2: Cafe 설정 타입 확인
- `packages/core/src/types.ts`에서 Cafe 타입 확인
- `worktreeRoot`, `baseBranch` 필드 존재 확인
- 없으면 타입 및 기본값 추가

#### Step 0.3: 기존 타입 에러 수정
- `src/renderer/hooks/useIpcEffect.ts:31,41` OrderStatus 타입 불일치 수정
- typecheck 통과 확인

#### 검증:
- [ ] Orchestrator API 확인 완료 (존재 여부 + 대안 결정)
- [ ] Cafe 타입 확인 완료 (필요 시 타입 추가)
- [ ] `pnpm typecheck` 통과 (기존 에러 0개)
```

### 권장사항 2: UI 컴포넌트 대체 전략 명시 (선택사항) 💡
```markdown
Phase 1.4 수정:
- Dialog/Select 컴포넌트 없으면:
  - 대안 A: 기본 HTML <dialog> + CSS로 간단 구현
  - 대안 B: NewOrder.tsx 재사용 (모달 없이 진행)
```

### 권장사항 3: Phase 2 조건부 진행 (필수) ✅
```markdown
Phase 2 시작 조건:
- Phase 0.1 완료 (Orchestrator API 확인)
- getOrderTerminal API 존재하거나 대안 확정

Phase 2 불가 시:
- 로그 파일 폴링 방식으로 변경
- TerminalOutputPanel에서 `.orch/orders/{orderId}/logs.jsonl` 주기적 읽기
- 실시간성 떨어지지만 기능 구현 가능
```

## 결론

### 판정: APPROVE (조건부)

**승인 조건:**
1. **Phase 0 추가** - Orchestrator API, Cafe 타입, 기존 에러 확인
2. **Phase 0 완료 후** Phase 1 시작

**승인 이유:**
- 전반적으로 잘 구조화된 계획
- 검증 가능하고 단계적 진행 가능
- 리스크 인식 및 대안 고려
- **단, Critical dependency(Orchestrator API) 확인 필수**

**다음 조치:**
1. ✅ Phase 0 추가 (context.md 업데이트)
2. ✅ Phase 0 완료 확인
3. ➡️ Phase 1 시작

---

**리뷰 메타데이터:**
- Reviewer: Claude (codex-fallback)
- Review Date: 2026-01-15
- Plan Version: 1.0
- Review Version: 1
- Approval: CONDITIONAL (Phase 0 추가 필요)
