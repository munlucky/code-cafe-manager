# CodeCafe

> AI CLI Orchestrator - Manage multiple AI CLI instances (baristas) in parallel

CodeCafe는 Claude Code, Codex 등 AI CLI를 "바리스타"로 여러 개 띄워 워크플로우로 병렬 실행/관측/관리하는 크로스플랫폼 오케스트레이터입니다.

## 아키텍처

- **CLI 코어**: `codecafe` 명령줄 도구
- **Desktop UI**: Electron 기반 CodeCafe Manager (운영/관측)
- **Provider**: AI CLI 연동 플러그인 (claude-code, codex, ...)

## 카페 컨셉 용어

- **Manager**: CodeCafe Manager (Electron UI)
- **Barista**: 독립 실행 유닛 (CLI 엔진 1개)
- **Menu**: 워크플로우 템플릿 목록
- **Workflow**: YAML 워크플로우 정의
- **Order**: 워크플로우 실행 1회 인스턴스
- **Beans**: Provider (claude-code, codex, ...)
- **Counter**: 실행 대상 프로젝트
- **Receipt**: 실행 결과 요약

## 설치

```bash
# 의존성 설치
pnpm install

# 빌드
pnpm build

# CLI 링크 (개발 모드)
cd packages/cli
pnpm link --global
```

## 사용법

### 1. 초기화

```bash
codecafe init
```

### 2. 환경 점검

```bash
codecafe doctor
```

### 3. 실행

```bash
# 기본 실행
codecafe run --issue "배치 관리 구현"

# 특정 프로젝트에서 실행
codecafe run --counter ./my-project --issue "버그 수정"
```

### 4. UI 실행 (M2+)

```bash
codecafe ui
```

## 개발

### 패키지 구조

```
codecafe/
├── packages/
│   ├── core/              # 도메인 모델, 오케스트레이터
│   ├── cli/               # codecafe CLI
│   ├── desktop/           # Electron UI (M2+)
│   ├── orchestrator/      # 워크플로우 엔진
│   ├── providers/
│   │   ├── claude-code/   # Claude Code Provider
│   │   └── codex/         # Codex Provider (M2)
│   └── schema/            # YAML/JSON 스키마
└── docs/
```

### 빌드

```bash
# 전체 빌드
pnpm build

# 개발 모드 (watch)
pnpm dev

# 타입 체크
pnpm typecheck

# 클린
pnpm clean
```

## Milestone

### M1 (✅ 완료)
- [x] CLI 코어 (init, run, doctor, status, ui)
- [x] Provider: claude-code (PTY 기반)
- [x] Core 패키지 (도메인 모델, 오케스트레이터)
- [x] Schema 패키지 (YAML 검증)
- [x] Barista Pool 구현
- [x] Orchestrator (통합 관리)
- [x] 저장/관측 시스템 (JSON + 로그)
- [x] Electron UI (Dashboard, New Order, Order Detail, Baristas)

### M2 (진행 중)
- [x] Workflow 엔진 (FSM 기반)
- [x] Git worktree 병렬 실행
- [x] 워크플로우 UI (실행/모니터링)
- [ ] Codex Provider 추가
- [ ] DAG 시각화

### M3
- Provider 플러그인 확장 (Gemini/Grok)
- API 모드
- 템플릿 레지스트리

## 라이선스

MIT
