# M2 수동 테스트 체크리스트

> 작성일: 2026-01-09
> 버전: M2
> 브랜치: main

## 테스트 환경 요구사항

- OS: Windows 11 / macOS / Linux
- Node.js: 20+
- Git: 2.20+
- Claude Code CLI: 설치됨
- Codex CLI: 설치됨 (선택적)

## 테스트 전 준비

```bash
# 프로젝트 빌드
pnpm install
pnpm -r build

# Doctor 명령 실행 (환경 점검)
cd packages/cli
node dist/index.js doctor
```

**예상 출력**:
```
🔍 CodeCafe Environment Check

Claude Code: ✅ OK
Codex CLI: ✅ OK (또는 ❌ Not Found)
Git: ✅ git version 2.x.x
Node.js: ✅ v20.x.x
```

---

## 1. CLI 기본 테스트

### 1.1 Doctor 명령 ✅

**체크리스트**:
- [ ] Claude Code 점검 결과 출력
- [ ] Codex CLI 점검 결과 출력
- [ ] Git 버전 출력 (2.20+ 권장)
- [ ] Node.js 버전 출력

---

### 1.2 Brew 명령 - 기본 실행 ✅

**테스트 레시피 생성**:
```yaml
name: test-simple
version: 0.1.0
defaults:
  provider: claude-code
  workspace:
    mode: in-place
inputs:
  counter: "."
vars: {}
steps:
  - id: step1
    type: ai.interactive
    prompt: "Say hello"
```

**실행**:
```bash
node dist/index.js brew --recipe test-simple.yaml --counter .
```

**체크리스트**:
- [ ] Recipe 로드 및 검증 통과
- [ ] Step 실행 시작 로그
- [ ] 실행 완료 후 결과 요약

---

### 1.3 Brew 명령 - Worktree 모드 ✅

**테스트 레시피**:
```yaml
name: test-worktree
version: 0.1.0
defaults:
  provider: claude-code
  workspace:
    mode: worktree
    baseBranch: main
    clean: false
inputs:
  counter: "."
vars: {}
steps:
  - id: step1
    type: ai.interactive
    prompt: "Test worktree"
```

**체크리스트**:
- [ ] `../codecafe-worktrees/{orderId}` 경로에 worktree 생성
- [ ] 새 브랜치 생성 확인
- [ ] 실행 완료 후 worktree 보존 (clean: false)

**검증**:
```bash
git worktree list
```

---

### 1.4 Brew 명령 - Parallel Step ✅

**테스트 레시피**:
```yaml
name: test-parallel
version: 0.1.0
defaults:
  provider: claude-code
inputs:
  counter: "."
steps:
  - id: parallel-group
    type: parallel
    steps:
      - id: step1
        type: ai.interactive
        prompt: "Task 1"
      - id: step2
        type: ai.interactive
        prompt: "Task 2"
      - id: step3
        type: ai.interactive
        prompt: "Task 3"
```

**체크리스트**:
- [ ] Parallel step 인식
- [ ] 배치 실행 로그 (바리스타 풀 크기에 따라)
- [ ] 모든 하위 step 실행 완료

---

## 2. Desktop UI 테스트

### 2.1 앱 실행 ✅

```bash
cd packages/desktop
pnpm start
```

**체크리스트**:
- [ ] Electron 앱 실행 (1200x800)
- [ ] 사이드바 네비게이션 표시
- [ ] Dashboard 기본 렌더링

---

### 2.2 Provider 선택 ✅

**단계**:
1. "New Order" 탭 클릭
2. Provider 드롭다운 확인

**체크리스트**:
- [ ] "Claude Code" 옵션 존재
- [ ] "Codex" 옵션 존재
- [ ] 기본값 선택됨

---

### 2.3 Worktree 목록 ✅

**준비**:
```bash
# 테스트용 worktree 생성
cd /tmp/test-repo
git worktree add ../test-worktrees/feature-1 -b feature-1
```

**단계**:
1. "Worktrees" 탭 클릭
2. Repository Path 입력
3. "Load" 버튼 클릭

**체크리스트**:
- [ ] Worktree 목록 테이블 표시
- [ ] Branch, Path, Commit 정보 표시
- [ ] "Export Patch", "Open Folder", "Delete" 버튼 존재

---

### 2.4 Worktree - Export Patch ✅

**체크리스트**:
- [ ] Base branch 입력 프롬프트
- [ ] Patch 파일 생성 성공
- [ ] Patch 파일 경로 표시

**검증**:
```bash
cat /tmp/test-worktrees/feature-1/feature-1.patch
```

---

### 2.5 Worktree - Delete ✅

**체크리스트**:
- [ ] 확인 다이얼로그 표시
- [ ] 미커밋 변경사항 있으면 실패 + Force 옵션
- [ ] 삭제 성공 시 목록 새로고침

---

### 2.6 Recipe Studio - 기본 ✅

**단계**:
1. "Recipe Studio" 탭 클릭

**체크리스트**:
- [ ] 좌측 Recipe 목록 표시
- [ ] 우측 에디터 영역 표시
- [ ] "New Recipe" 버튼 존재

---

### 2.7 Recipe Studio - 레시피 로드 ✅

**체크리스트**:
- [ ] 레시피 클릭 시 로드
- [ ] JSON 에디터에 내용 표시
- [ ] [Save] [Validate] [Copy YAML] 버튼 표시

---

### 2.8 Recipe Studio - Validate ✅

**체크리스트**:
- [ ] 유효한 레시피: ✓ 성공 메시지 (초록색)
- [ ] 무효한 레시피: 에러 목록 표시 (빨간색)

---

### 2.9 Recipe Studio - Save ✅

**체크리스트**:
- [ ] 저장 성공 알림
- [ ] `~/.codecafe/recipes/` 폴더에 YAML 저장

---

## 3. 통합 시나리오

### 시나리오 1: E2E Worktree 병렬 실행 ✅

1. Desktop에서 parallel + worktree 레시피 생성
2. CLI로 실행
3. Desktop에서 worktree 목록 확인
4. 각 worktree 패치 내보내기

**체크리스트**:
- [ ] 전체 워크플로우 정상 동작
- [ ] 원본 repo 깨끗한 상태 유지

---

### 시나리오 2: Provider 전환 ✅

1. Claude Code로 주문 생성
2. Codex로 주문 생성
3. 각 로그 확인

**체크리스트**:
- [ ] 두 Provider 모두 정상 동작 (설치된 경우)

---

## 4. 에러 처리

### 4.1 Provider 미설치 ✅

**테스트**: Codex 없이 Codex provider 사용

**예상 동작**:
- [ ] Doctor에서 미설치 경고
- [ ] Brew 실행 시 명확한 에러

---

### 4.2 Recipe 검증 실패 ✅

**테스트**: 필수 필드 누락 레시피

**예상 동작**:
- [ ] Zod 에러 메시지 표시
- [ ] 실행 중단

---

## 5. 크로스플랫폼

### Windows ✅
- [ ] Git 명령어 (PowerShell/Git Bash)
- [ ] 경로 구분자 처리

### macOS ✅
- [ ] Shell (bash/zsh) 호환성

### Linux ✅
- [ ] Git 2.20+ 버전 확인

---

## 6. 보안

### Command Injection 방지 ✅

**테스트**: 악의적인 경로 입력
```bash
codecafe brew --counter "; rm -rf /"
```

**예상 동작**:
- [ ] execFile 사용으로 차단
- [ ] 안전하게 처리

---

## 필수 테스트 요약

| 테스트 | 상태 |
|--------|------|
| CLI Doctor | ⬜ |
| CLI Brew 기본 | ⬜ |
| CLI Brew Worktree | ⬜ |
| CLI Brew Parallel | ⬜ |
| Desktop 실행 | ⬜ |
| Provider 선택 | ⬜ |
| Worktree 관리 | ⬜ |
| Recipe Studio | ⬜ |
| 통합 시나리오 | ⬜ |

---

## M2 수용 기준 검증

| # | 수용 기준 | 상태 |
|---|----------|------|
| 1 | Codex Provider로 주문 실행/로그 스트리밍 | ⬜ |
| 2 | worktree 모드로 3개 주문 병렬 실행 | ⬜ |
| 3 | 주문 종료 후 patch export, 원본 repo 깨끗 유지 | ⬜ |
| 4 | Recipe Studio에서 레시피 YAML 저장, CLI 실행 | ⬜ |
| 5 | Parallel step이 바리스타 풀 크기만큼 병렬 실행 | ⬜ |
| 6 | Retry/Timeout 설정대로 동작 | ⬜ |

---

## 빠른 테스트 스크립트

```bash
#!/bin/bash
# M2 Quick Test

echo "=== M2 Quick Test ==="

# Build
pnpm -r build

# Doctor
cd packages/cli
node dist/index.js doctor

# Simple test
cat > /tmp/test.yaml <<'EOF'
name: test
version: 0.1.0
defaults:
  provider: claude-code
inputs:
  counter: "."
steps:
  - id: s1
    type: ai.interactive
    prompt: "Hello"
EOF

node dist/index.js brew --recipe /tmp/test.yaml --counter .

echo "=== Complete ==="
```

---

**문서 버전**: M2 Final
**최종 업데이트**: 2026-01-09
