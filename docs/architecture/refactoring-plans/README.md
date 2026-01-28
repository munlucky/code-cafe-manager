# CodeCafe 리팩토링 로드맵

> 이 디렉토리는 프로젝트 전체 리팩토링을 위한 단계별 계획 문서를 포함합니다.

## 개요

리팩토링은 4개의 Phase로 구성되며, 각 Phase는 이전 단계의 완료를 전제로 합니다.

```
Phase 1 (Critical) ──► Phase 2 (High) ──► Phase 3 (Medium) ──► Phase 4 (Maintenance)
    1-2주                 2-3주              3-4주               Ongoing
```

---

## Phase 요약

| Phase | 우선순위 | 기간 | 주요 목표 |
|-------|---------|------|----------|
| [Phase 1](./phase-1-critical.md) | P0 Critical | 1-2주 | Console.log 제거, God class 분할, Memory leak 수정 |
| [Phase 2](./phase-2-high.md) | P1 High | 2-3주 | Type safety 강화, IPC 서비스 분리, Async 최적화 |
| [Phase 3](./phase-3-medium.md) | P2 Medium | 3-4주 | 모듈 분할, Facade 도입, 성능 최적화 |
| [Phase 4](./phase-4-maintenance.md) | P3 Ongoing | 지속 | ESLint 강화, CI 품질 게이트, 정기 리뷰 |

---

## 빠른 참조: 주요 이슈

### CRITICAL (Phase 1)

| 이슈 | 수량 | 대상 파일 |
|------|------|----------|
| Console.log | 516+ | orchestrator (306), desktop (210) |
| God Classes | 6개 | order-session.ts, workflow-executor.ts, ipc/order.ts 등 |
| Memory Leaks | 12+ | Event listener 미정리 |

### HIGH (Phase 2)

| 이슈 | 수량 | 대상 파일 |
|------|------|----------|
| `any` types | 68+ | catch blocks, event handlers, YAML parsing |
| Layer Violations | 4개 | desktop → orchestrator 직접 결합 |
| Waterfall Async | 5+ | skill loading, config loading |

---

## 진행 상황 대시보드

### Phase 1: Critical

- [ ] Console.log 제거 및 Logger 도입
  - [ ] Logger 인프라 구축
  - [ ] orchestrator 적용 (306 instances)
  - [ ] desktop 적용 (210 instances)
- [ ] order-session.ts 분할 (1113줄 → 5모듈)
  - [ ] SessionLifecycle 추출
  - [ ] StageCoordinator 추출
  - [ ] ContextManager 추출
  - [ ] EventPropagator 추출
- [ ] Event Listener 정리 패턴 적용
  - [ ] EventListenerManager 구현
  - [ ] barista-engine-v2.ts 적용
  - [ ] cafe-session-manager.ts 적용
  - [ ] order-session.ts 적용

### Phase 2: High

- [ ] `any` 타입 제거
  - [ ] Error 타입 정의
  - [ ] TypedEventEmitter 구현
  - [ ] Preload bridge 타입 강화
- [ ] Zod 검증 일관성 확보
- [ ] IPC 서비스 레이어 추출
  - [ ] OrderService 추출
  - [ ] WorkflowService 추출
- [ ] Waterfall async → Promise.all

### Phase 3: Medium

- [x] terminal-log-parser.ts 분할 (844줄 → 5모듈)
- [x] Provider adapter 인터페이스 분리
- [ ] ExecutionFacade 도입 (Phase 2 선행 조건 미충족)
- [x] 배열 연산 최적화
- [x] 스킬 캐싱 도입

### Phase 4: Maintenance

- [ ] ESLint 규칙 강화
- [ ] Pre-commit hook 설정
- [ ] CI 품질 게이트 구축
- [ ] Magic number 상수화
- [ ] TODO 이슈 전환
- [ ] 타입 커버리지 모니터링

---

## 완료 기준 요약

### 최종 품질 목표

| 메트릭 | 현재 | 목표 |
|--------|------|------|
| Console.log | 516 | **0** |
| Any types | 68+ | **0** |
| Files > 800 lines | 6 | **0** |
| Files > 400 lines | 61 | **< 10** |
| Test coverage | ? | **> 80%** |
| Type coverage | ? | **> 95%** |

### 자동화 검증

```bash
# Phase 1 완료 확인
grep -r "console\." packages/*/src --include="*.ts" | wc -l  # 0
wc -l packages/orchestrator/src/session/order-session.ts     # < 300

# Phase 2 완료 확인
grep -r "catch (error: any)" packages/*/src | wc -l          # 0
grep -r "yaml.load.*as any" packages/*/src | wc -l           # 0

# Phase 3 완료 확인
npx madge --circular packages/orchestrator/src/terminal/     # No circular

# Phase 4 완료 확인
pnpm lint                                                     # 0 errors
npx type-coverage --percentage-only                          # > 85%
```

---

## 담당자 및 일정

| Phase | 시작일 | 종료일 | 담당자 | 리뷰어 |
|-------|--------|--------|--------|--------|
| Phase 1 | TBD | TBD | TBD | TBD |
| Phase 2 | TBD | TBD | TBD | TBD |
| Phase 3 | TBD | TBD | TBD | TBD |
| Phase 4 | TBD | - | All | Tech Lead |

---

## 관련 문서

- [리팩토링 분석 보고서](../refactoring-analysis.md)
- [패키지 명세서](../package-specifications.md)
- [모듈 상호작용](../module-interactions.md)

---

*마지막 업데이트: 2026-01-27*
