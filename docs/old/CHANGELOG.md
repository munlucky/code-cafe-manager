# Changelog

## v0.1.0 (2026-01-09) - M1 MVP 완료

### 🎉 첫 릴리스

CodeCafe M1 (MVP)이 완료되었습니다!

### Features

#### Core Infrastructure
- **도메인 모델**: Barista, Order, Recipe, Receipt 타입 정의
- **BaristaManager**: 바리스타 풀 관리 (생성/상태 변경/IDLE 찾기)
- **OrderManager**: 주문 큐 관리 (생성/할당/시작/완료/취소)
- **RecipeManager**: YAML 레시피 로드 및 검증
- **Orchestrator**: 통합 오케스트레이션 (바리스타+주문+저장+로그)
- **Storage**: JSON 기반 데이터 저장 (orders.json, baristas.json, receipts.json)
- **LogManager**: 주문별 로그 파일 관리 (tail 지원)

#### Schema & Validation
- Zod 기반 Recipe YAML 스키마 정의
- 안전한 검증 함수 (validateRecipe, safeValidateRecipe)

#### Provider: Claude Code
- node-pty 기반 PTY 프로세스 실행
- 실시간 로그 스트리밍
- 환경 검증 (타임아웃 처리 완료)
- 인증 힌트 제공

#### CLI Commands
- `codecafe init`: 전역 설정 초기화 (~/.codecafe/)
- `codecafe doctor`: 환경 점검 (git, Node.js, Claude CLI)
- `codecafe run`: 태스크 실행 (Provider 직접 호출)
- `codecafe status`: 바리스타/주문 상태 확인
- `codecafe ui`: Electron UI 실행 안내

#### Electron UI (CodeCafe Manager)
- **Dashboard**: 바리스타/주문 통계 및 최근 주문 목록
- **New Order**: 주문 생성 폼 (Recipe, Counter, Provider, Issue)
- **Orders**: 전체 주문 목록 (상태별 필터)
- **Order Detail**: 주문 상세 정보 + 실시간 로그 + 취소 기능
- **Baristas**: 바리스타 목록 + 생성 기능
- IPC 기반 Main-Renderer 통신
- 실시간 이벤트 업데이트

### Technical Details
- **Monorepo**: pnpm workspaces
- **Language**: TypeScript
- **Packages**: core, cli, desktop, provider-claude-code, schema
- **Cross-platform**: Windows, macOS, Linux 지원

### Known Limitations (M1)
- 레시피 기반 실행 엔진은 구조만 있고, 실제로는 Provider를 직접 호출
- Electron UI 실행 시 node-pty 네이티브 빌드 필요
- 병렬 실행은 Orchestrator에 준비되어 있으나, CLI/UI에서 활용 미비

### Next Steps (M2)
- Codex Provider 추가
- Git worktree 병렬 실행
- Recipe Studio (폼 기반 편집)
- 레시피 실행 엔진 강화 (DAG 기반)
- DAG 시각화
