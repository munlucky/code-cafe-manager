# Phase 2: Terminal Pool & Role System - 분할된 구현 계획

## 개요

원본 `phase-2-implementation-plan-v2.md` 파일(약 3,800라인)을 작업 단위별로 14개의 파일로 분할했습니다.

## 파일 구조

### 1. 개요 및 아키텍처
- **01-overview.md** (133라인) - 전체 개요, 목표, 아키텍처 변경사항
- **02-terminal-execution-contract.md** (451라인) - Terminal 실행 계약 및 Provider Adapter (Gap 1 해결)

### 2. 핵심 구현
- **03-terminal-pool-concurrency.md** (603라인) - TerminalPool 동시성 모델 (Gap 2 해결)
- **04-ipc-ui-api-contracts.md** (483라인) - IPC/UI API 계약 (Gap 3 해결)
- **05-backward-compatibility.md** (236라인) - 후방 호환성 및 마이그레이션 (Gap 4 해결)
- **06-crash-recovery.md** (292라인) - Crash Recovery 동작 (Gap 5 해결)

### 3. 구현 시퀀스
- **07-implementation-sequence.md** (996라인) - 상세 구현 단계 (Day 1-10)
- **08-file-creation-summary.md** (84라인) - 파일 생성 요약

### 4. 테스트 및 검증
- **09-testing-strategy.md** (218라인) - 테스트 전략
- **10-verification-checkpoints.md** (95라인) - 검증 체크포인트

### 5. 프로젝트 관리
- **11-risk-mitigation.md** (102라인) - 리스크 완화 전략
- **12-implementation-timeline.md** (21라인) - 구현 타임라인
- **13-open-questions.md** (31라인) - 미해결 질문
- **14-next-steps.md** (76라인) - 다음 단계 및 참조

## 사용 방법

1. **전체 계획 이해**: 01-overview.md부터 시작
2. **구현 작업**: 07-implementation-sequence.md의 Day별 작업 수행
3. **Gap 해결 확인**: 각 Gap별 해결사항 확인 (02-06.md)
4. **검증**: 10-verification-checkpoints.md의 체크포인트 확인

## Gap 해결 요약

| Gap | 해결 문서 | 주요 내용 |
|-----|-----------|-----------|
| Gap 1: Terminal Execution Contract | 02-terminal-execution-contract.md | IProviderAdapter 인터페이스, MockProviderAdapter |
| Gap 2: TerminalPool Concurrency | 03-terminal-pool-concurrency.md | Custom Semaphore, LeaseToken, p99 metrics |
| Gap 3: IPC/UI API Contracts | 04-ipc-ui-api-contracts.md | Zod 스키마, Error codes, IPC handlers |
| Gap 4: Backward Compatibility | 05-backward-compatibility.md | generic-agent Role, BaristaEngineV2, LegacyAdapter |
| Gap 5: Crash Recovery | 06-crash-recovery.md | State machine, Auto-restart, Caller retry |

## 원본 파일

원본 파일: `.claude/docs/tasks/phase-2-implementation-plan-v2.md` (3,806라인)

분할된 파일들은 원본의 논리적 구조를 유지하면서 작업 단위별로 분리되었습니다.