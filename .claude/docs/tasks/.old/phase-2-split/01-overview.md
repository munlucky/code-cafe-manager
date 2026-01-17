# Phase 2: Terminal Pool & Role System - Implementation Plan v2

> **Context Builder Agent Output - Version 2**
> **Created**: 2026-01-12
> **Updated**: 2026-01-12 (Plan Reviewer Feedback Applied)
> **Phase**: Phase 2 - Terminal Pool & Role System
> **Parent Document**: `.claude/context.md`
> **Status**: IMPROVED - All 5 Critical Gaps Addressed

## Plan Reviewer Feedback Applied

This v2 plan addresses 5 critical gaps identified by the Plan Reviewer:

1. ✅ **Gap 1: Terminal Execution Contract & Provider Mapping** → Section 2.3 added
2. ✅ **Gap 2: TerminalPool Concurrency Model** → Section 2.4 added, Step 2 expanded
3. ✅ **Gap 3: IPC/UI API Contracts** → Section 2.5 added, Step 5 expanded
4. ✅ **Gap 4: Backward Compatibility & Migration** → Section 2.6 added
5. ✅ **Gap 5: Crash Recovery Behavior** → Section 2.7 added, Step 2 expanded

## Plan Reviewer v2 Feedback (REJECT) - Additional Gaps to Address:

**v2 Review Result:** REJECT with 4 additional critical gaps:

1. **Lease Concurrency Design Inconsistency**: Semaphore acquired on lease but release logic ambiguous, timeout cancellation path missing
2. **Crash/Timeout Cleanup Responsibilities**: Who kills process, releases lease token, releases semaphore on crash/timeout?
3. **Test Strategy Non-Deterministic**: Provider adapter tests require real CLI processes, not mockable
4. **Pool Size Ambiguity**: "Terminal Pool Size = 8" - total vs per-provider? Configuration enforcement needed

**FINAL v2 Review Result:** REJECT with 4 critical design flaws:

1. **Lease Acquisition Model Inconsistent**: Multiple conflicting `lease()` implementations, p-limit cannot enforce pool size limits
2. **Cancellation Path Missing**: p-limit doesn't support aborting queued tasks, timeout handling incomplete
3. **Cleanup Semantics Unclear**: No explicit `leaseManager.releaseToken()` and `cleanup()` calls in crash/timeout paths
4. **Test Strategy Still Non-Deterministic**: Adapter tests still rely on real CLI despite mock claims

**This document (v2) will be COMPLETELY REDESIGNED with a new lease concurrency model.**

---

## 1. Overview

### 1.1 목표
Phase 2는 CodeCafe Manager의 핵심 아키텍처 개선을 구현합니다:
- **Terminal Pool**: Provider 프로세스를 효율적으로 관리하는 풀 시스템
- **Role System**: Agent 역할을 템플릿화하여 재사용 가능하게 만드는 시스템
- **Barista Refactoring**: 논리적 Worker와 물리적 프로세스 분리

### 1.2 사용자 결정 사항 반영

**확정 사항:**
- **Terminal Pool Size**: 8개 **per-provider** (기본값, 사용자 결정)
  - 각 Provider별로 독립적인 8개 Terminal Pool
  - 예: claude-code 8개, codex 8개 (총 16개 가능)
  - **NEW**: Custom semaphore implementation to enforce pool size limits
  - Configuration: `perProvider[provider].size = 8`
- **Role Templates**: 4종 (generic, reusable)
  - `planner.md`: 계획 수립 전문가
  - `coder.md`: 코드 구현 전문가
  - `tester.md`: 테스트 작성 전문가
  - `reviewer.md`: 코드 리뷰 전문가

### 1.3 성공 기준
- [ ] Terminal Pool에서 8개 Terminal로 10개 Order 병렬 실행 (per-provider) **with pool size enforcement**
- [ ] Role Manager에서 기본 4종 Role 조회 및 Order에 할당
- [ ] Barista가 Terminal Pool에서 lease → execute → release 수행
- [ ] Order Creation Kiosk에서 Stage별 Role 선택 → Order 생성 성공
- [ ] 기존 Phase 1 Order가 새 시스템에서 정상 동작 (후방 호환성)
- [ ] Lease timeout 시 semaphore 정리 (no leaks) **with explicit cancellation**
- [ ] Crash recovery 시 process, lease token, semaphore 정리 (no leaks) **with explicit cleanup calls**
- [ ] Provider adapter tests are mockable/deterministic (CI-friendly) **using MockProviderAdapter**
- [ ] **NEW**: Custom semaphore implementation enforces pool size limits
- [ ] **NEW**: Cancellable queue for lease requests with timeout support

---

## 2. Architecture Changes

### 2.1 현재 구조 (Phase 1)

```
BaristaManager
  ├── Barista (논리적 상태만)
  │   ├── id, status, currentOrderId
  │   └── provider (type only)
  └── No physical process management
```

**문제점:**
- Barista와 Provider 프로세스가 1:1로 강하게 결합
- 프로세스 재사용 불가 → 메모리 오버헤드
- Role/Skill 개념 부재 → Agent 재사용성 낮음

### 2.2 목표 구조 (Phase 2)

```
TerminalPool (Provider별)
  ├── Terminal (물리적 프로세스)
  │   ├── id, provider, process (IPty)
  │   ├── status: idle | busy | crashed
  │   ├── currentBarista: string | undefined
  │   └── leaseToken: LeaseToken | undefined
  └── LeaseManager
      ├── Semaphore (p-limit, 동시성 제어)
      ├── LeaseTokens (추적용)
      └── WaitQueue (메트릭용)

RoleRegistry
  ├── Role (템플릿)
  │   ├── id, name, systemPrompt
  │   ├── skills: string[]
  │   ├── recommendedProvider: string
  │   └── variables: Variable[]
  └── Sources: packages/roles/*.md, ~/.codecafe/roles/*.md

Barista (Refactored)
  ├── id, role: Role
  ├── lease(pool) → Terminal + LeaseToken
  ├── execute(terminal, order, step)
  └── release(terminal, leaseToken)

BaristaEngineV2 (NEW)
  ├── executeWithAdapter(adapter, order, step)
  └── [Coexists with legacy Barista during migration]
```

**개선점:**
- Terminal 재사용 → 프로세스 생성 오버헤드 감소
- Role 기반 Agent → 재사용성, 확장성 향상
- 동시성 제어 → 안정적인 리소스 관리
- Provider Adapter → 실행 계약 명확화

---

**다음 문서:** [02-terminal-execution-contract.md](02-terminal-execution-contract.md) - Terminal Execution Contract & Provider Mapping