# Phase 4: Maintenance 리팩토링 계획

> **기간**: Ongoing (지속적)
> **목표**: 코드 품질 유지 및 기술 부채 축적 방지
> **우선순위**: P3 (일상적인 유지보수)
> **선행 조건**: Phase 1-3 완료

---

## 1. ESLint 규칙 강화

### 1.1 규칙 설정

#### 체크리스트

- [ ] **ESLint 설정 파일 업데이트**
  - [ ] `.eslintrc.json` 또는 `eslint.config.js` 수정
  - [ ] TypeScript 플러그인 활성화

```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking"
  ],
  "rules": {
    "no-console": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/explicit-function-return-type": ["warn", {
      "allowExpressions": true,
      "allowTypedFunctionExpressions": true
    }],
    "@typescript-eslint/no-unused-vars": ["error", {
      "argsIgnorePattern": "^_"
    }],
    "max-lines": ["warn", {
      "max": 400,
      "skipBlankLines": true,
      "skipComments": true
    }],
    "max-lines-per-function": ["warn", {
      "max": 50,
      "skipBlankLines": true,
      "skipComments": true
    }],
    "complexity": ["warn", 10],
    "max-depth": ["warn", 4]
  }
}
```

- [ ] **패키지별 설정 오버라이드**
  - [ ] `packages/desktop/src/renderer` - React 규칙 추가
  - [ ] `packages/orchestrator/src/__tests__` - 테스트 규칙 완화

- [ ] **IDE 통합**
  - [ ] `.vscode/settings.json` ESLint 자동 수정 설정
  - [ ] 저장 시 자동 포맷팅

```json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": ["typescript", "typescriptreact"]
}
```

#### 완료 기준

```bash
# ESLint 실행 시 에러 0개
pnpm lint
# 결과: 0 errors, N warnings (경고는 점진적 해결)
```

---

### 1.2 Pre-commit Hook 설정

#### 체크리스트

- [ ] **Husky 설치 및 설정**
  - [ ] `pnpm add -D husky lint-staged`
  - [ ] `npx husky install`

- [ ] **.husky/pre-commit 생성**

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

- [ ] **lint-staged 설정**

```json
// package.json
{
  "lint-staged": {
    "packages/*/src/**/*.{ts,tsx}": [
      "eslint --fix --max-warnings=0",
      "prettier --write"
    ]
  }
}
```

- [ ] **커밋 메시지 검증 (선택)**
  - [ ] `commitlint` 설정
  - [ ] Conventional Commits 강제

#### 완료 기준

```bash
# console.log가 포함된 파일 커밋 시도
echo "console.log('test')" >> packages/core/src/test.ts
git add -A && git commit -m "test"
# 결과: ESLint 에러로 커밋 거부
```

---

## 2. CI 품질 게이트

### 2.1 GitHub Actions 워크플로우

#### 체크리스트

- [ ] **품질 검사 워크플로우 생성**
  - [ ] `.github/workflows/quality.yml` 생성

```yaml
name: Quality Gate

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Test
        run: pnpm test -- --coverage

      - name: Check console.log count
        run: |
          COUNT=$(grep -r "console\." packages/*/src --include="*.ts" --include="*.tsx" | wc -l)
          echo "Console statements found: $COUNT"
          if [ "$COUNT" -gt 0 ]; then
            echo "::error::Found $COUNT console statements in production code"
            exit 1
          fi

      - name: Check any type count
        run: |
          COUNT=$(grep -r ": any" packages/*/src --include="*.ts" | wc -l)
          echo "Explicit any types found: $COUNT"
          # 점진적 감소 목표 설정
          THRESHOLD=50
          if [ "$COUNT" -gt "$THRESHOLD" ]; then
            echo "::warning::Found $COUNT any types (threshold: $THRESHOLD)"
          fi

      - name: Check file sizes
        run: |
          for file in $(find packages/*/src -name "*.ts" -o -name "*.tsx"); do
            lines=$(wc -l < "$file")
            if [ "$lines" -gt 400 ]; then
              echo "::error::$file has $lines lines (max: 400, aligned with ESLint max-lines)"
              exit 1
            fi
          done

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

- [ ] **Branch Protection 설정**
  - [ ] main 브랜치: quality 워크플로우 필수
  - [ ] PR 승인 필수
  - [ ] 최신 브랜치 필수

#### 완료 기준

- [ ] PR 생성 시 자동으로 품질 검사 실행
- [ ] 품질 게이트 실패 시 머지 차단
- [ ] Coverage 리포트 자동 업로드

---

### 2.2 품질 메트릭 대시보드

#### 체크리스트

- [ ] **메트릭 수집 스크립트**
  - [ ] `scripts/collect-metrics.ts` 생성

```typescript
// 수집할 메트릭
interface QualityMetrics {
  consoleLogCount: number;
  anyTypeCount: number;
  totalLines: number;
  filesOver400Lines: number;
  functionsOver50Lines: number;
  testCoverage: number;
  eslintErrors: number;
  eslintWarnings: number;
}
```

- [ ] **메트릭 히스토리 저장**
  - [ ] `.quality-metrics/` 디렉토리
  - [ ] 일별 JSON 파일 저장

- [ ] **트렌드 리포트** (선택)
  - [ ] 주간 메트릭 비교
  - [ ] 개선/악화 추세 시각화

---

## 3. Magic Number 상수화

### 3.1 타임아웃 상수 추출

#### 체크리스트

- [ ] **상수 파일 생성**
  - [ ] `packages/core/src/constants/timeouts.ts`

```typescript
// 타임아웃 상수
export const TIMEOUTS = {
  /** 터미널 유휴 타임아웃 (ms) */
  TERMINAL_IDLE: 5_000,

  /** 명령 실행 타임아웃 (ms) */
  COMMAND_EXECUTION: 60_000,

  /** 세션 정리 임계값 (ms) - 1시간 */
  SESSION_CLEANUP: 3_600_000,

  /** PTY 스폰 타임아웃 (ms) */
  PTY_SPAWN: 10_000,

  /** 헬스체크 간격 (ms) */
  HEALTH_CHECK_INTERVAL: 30_000,
} as const;
```

- [ ] **사용처 교체**
  - [ ] `provider.ts:75` - `TIMEOUTS.COMMAND_EXECUTION`
  - [ ] `claude-code-adapter.ts:821` - `TIMEOUTS.COMMAND_EXECUTION`
  - [ ] `terminal-pool.ts` - 관련 타임아웃
  - [ ] 테스트 파일 - `TIMEOUTS.PTY_SPAWN`

#### 완료 기준

```bash
# 하드코딩된 타임아웃 숫자 검색
grep -rE "(1000|5000|10000|30000|60000|3600000)" packages/*/src --include="*.ts" | grep -v "constants"
# 결과: 최소화 (일부 허용)
```

---

### 3.2 출력 크기 상수 추출

#### 체크리스트

- [ ] **상수 파일 생성**
  - [ ] `packages/orchestrator/src/constants/thresholds.ts`

```typescript
// 출력 크기 임계값
export const OUTPUT_THRESHOLDS = {
  /** 실질적 출력으로 간주하는 최소 바이트 */
  SUBSTANTIAL_OUTPUT: 500,

  /** 매우 큰 출력으로 간주하는 바이트 */
  VERY_SUBSTANTIAL_OUTPUT: 10_000,

  /** 질문 밀도 임계값 */
  QUESTION_DENSITY: 1_000,

  /** 최대 로그 버퍼 크기 */
  MAX_LOG_BUFFER: 100_000,
} as const;
```

- [ ] **사용처 교체**
  - [ ] `stage-orchestrator.ts:175-176`

---

## 4. TODO 이슈 전환

### 4.1 TODO 스캔 및 이슈 생성

#### 체크리스트

- [ ] **TODO 스캔 스크립트**
  - [ ] `scripts/scan-todos.ts` 생성

```typescript
// TODO/FIXME 패턴 스캔
const patterns = [
  /\/\/\s*TODO:?\s*(.+)/gi,
  /\/\/\s*FIXME:?\s*(.+)/gi,
  /\/\/\s*HACK:?\s*(.+)/gi,
];

// 결과를 GitHub Issue 포맷으로 출력
```

- [ ] **현재 TODO 목록**
  - [ ] `cli/commands/role.ts:131` - "Add interactive confirmation"
  - [ ] `desktop/main/index.ts:171` - "Add run handlers if needed"
  - [ ] `cli/src/commands/ui.ts:12` - "Electron 앱 실행 경로 확인 필요"

- [ ] **GitHub Issue 생성**
  - [ ] 각 TODO에 대한 이슈 생성
  - [ ] 라벨: `tech-debt`, `good-first-issue`
  - [ ] 담당자 지정

- [ ] **TODO에 이슈 번호 추가**

```typescript
// Before
// TODO: Add interactive confirmation

// After
// TODO(#123): Add interactive confirmation
```

#### 완료 기준

- [ ] 모든 TODO에 이슈 번호 태그
- [ ] 이슈 없는 TODO 0개
- [ ] 분기별 TODO 리뷰 일정

---

## 5. 타입 커버리지 모니터링

### 5.1 type-coverage 설정

#### 체크리스트

- [ ] **type-coverage 설치**
  - [ ] `pnpm add -D type-coverage`

- [ ] **설정 및 실행**

```bash
# 전체 타입 커버리지 측정
npx type-coverage --detail --strict

# 패키지별 측정
npx type-coverage packages/core/src --detail
npx type-coverage packages/orchestrator/src --detail
npx type-coverage packages/desktop/src --detail
```

- [ ] **CI 통합**
  - [ ] 최소 커버리지 임계값 설정 (예: 85%)
  - [ ] 커버리지 감소 시 경고

```yaml
- name: Type coverage
  run: |
    COVERAGE=$(npx type-coverage --percentage-only)
    echo "Type coverage: $COVERAGE%"
    if (( $(echo "$COVERAGE < 85" | bc -l) )); then
      echo "::error::Type coverage is below 85%"
      exit 1
    fi
```

- [ ] **점진적 개선 목표**
  - [ ] 현재 → 85% (Phase 4 시작 시)
  - [ ] 85% → 90% (3개월 후)
  - [ ] 90% → 95% (6개월 후)

#### 완료 기준

```bash
npx type-coverage --percentage-only
# 결과: 85.00% 이상
```

---

## 6. 정기 리뷰 프로세스

### 6.1 월간 코드 품질 리뷰

#### 체크리스트

- [ ] **리뷰 체크리스트 템플릿**

```markdown
## 월간 코드 품질 리뷰 - YYYY-MM

### 메트릭 현황
- [ ] Console.log count: _____ (목표: 0)
- [ ] Any type count: _____ (목표: < 50)
- [ ] Files > 400 lines: _____ (목표: 0)
- [ ] Test coverage: _____% (목표: > 80%)
- [ ] Type coverage: _____% (목표: > 85%)

### 신규 기술 부채
- [ ] 새로운 TODO/FIXME: _____개
- [ ] 새로운 suppressions: _____개

### 액션 아이템
1.
2.
3.

### 다음 리뷰 예정: YYYY-MM-DD
```

- [ ] **캘린더 설정**
  - [ ] 매월 첫째 주 금요일
  - [ ] 참석: Tech Lead + 2명 이상

---

### 6.2 분기별 아키텍처 리뷰

#### 체크리스트

- [ ] **리뷰 체크리스트**

```markdown
## 분기별 아키텍처 리뷰 - YYYY-QN

### 패키지 의존성
- [ ] 순환 의존성 없음 확인
- [ ] 불필요한 의존성 제거
- [ ] 패키지 경계 위반 검토

### God Class 현황
- [ ] 500줄 초과 파일 목록
- [ ] 분할 계획 수립

### 성능
- [ ] 메모리 사용량 추세
- [ ] 빌드 시간 추세
- [ ] 테스트 실행 시간 추세

### 다음 분기 목표
1.
2.
3.
```

---

## 7. 진행 상황 추적

### 7.1 월간 체크포인트

| 월 | 목표 | 완료 여부 |
|---|------|----------|
| Month 1 | ESLint 규칙 설정 + Pre-commit hook | [ ] |
| Month 1 | CI 품질 게이트 구축 | [ ] |
| Month 2 | Magic number 상수화 완료 | [ ] |
| Month 2 | TODO 이슈 전환 완료 | [ ] |
| Month 3 | Type coverage 85% 달성 | [ ] |
| Ongoing | 월간 코드 품질 리뷰 실시 | [ ] |
| Ongoing | 분기별 아키텍처 리뷰 실시 | [ ] |

### 7.2 장기 품질 목표

| 메트릭 | 현재 | 3개월 | 6개월 | 1년 |
|--------|------|-------|-------|-----|
| Console.log | 516 | 0 | 0 | 0 |
| Any types | 68 | 30 | 15 | 0 |
| Files > 400 lines | 61 | 20 | 5 | 0 |
| Test coverage | ? | 70% | 80% | 85% |
| Type coverage | ? | 85% | 90% | 95% |

---

## 8. 자동화 도구 목록

| 도구 | 용도 | 설정 파일 |
|------|------|----------|
| ESLint | 정적 분석 | `.eslintrc.json` |
| Prettier | 코드 포맷팅 | `.prettierrc` |
| Husky | Git hooks | `.husky/` |
| lint-staged | Pre-commit 린트 | `package.json` |
| type-coverage | 타입 커버리지 | CLI |
| madge | 순환 의존성 | CLI |
| Codecov | 테스트 커버리지 | `codecov.yml` |

---

*문서 작성일: 2026-01-27*
*담당자: TBD*
*리뷰어: TBD*
