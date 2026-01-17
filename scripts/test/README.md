# Claude CLI 통합 테스트 가이드

CodeCafe Desktop 앱에서 Claude CLI 통합 기능을 테스트하기 위한 진단 스크립트와 E2E 테스트 스펙입니다.

---

## 목차

1. [개요](#개요)
2. [디렉토리 구조](#디렉토리-구조)
3. [진단 스크립트 사용법](#진단-스크립트-사용법)
4. [E2E 테스트](#e2e-테스트)
5. [테스트 결과 기록](#테스트-결과-기록)
6. [문제 해결](#문제-해결)

---

## 개요

### 테스트 목표

CodeCafe Desktop(Electron) 앱에서 Order 실행 시 Claude CLI를 node-pty로 구동하고 다음 흐름이 정상 동작하는지 검증합니다:

1. **프롬프트 초기화** (waitForPrompt 감지)
2. **출력 스트리밍** (order:output 이벤트)
3. **사용자 입력** (sendInput 전송)
4. **실패 처리** (fail-fast + 프로세스 정리)

### 테스트 레벨

| 레벨 | 설명 | 검증 항목 |
|------|------|-----------|
| **L0** | CLI 존재/실행 확인 (앱 외부 터미널) | 바이너리 존재, PATH, 버전 |
| **L1** | 앱에서 CLI 초기화 성공 (프롬프트 감지) | waitForPrompt 완료 |
| **L2** | 앱에서 출력 스트리밍 정상 | order:output UI 표시 |
| **L3** | 앱에서 사용자 입력(sendInput) 정상 | 입력→출력 반응 |
| **L4** | 실패 시 fail-fast + 프로세스 정리 | 좀비 프로세스 방지 |

### 지원 OS/셸 조합

| Case ID | OS | 셸/구동 방식 | 주요 리스크 |
|---------|-------|--------------|-------------|
| **W-PS-01** | Windows 10/11 | PowerShell(기본) | 경로 탐지, `& "path"` 실행, `\r\n` 처리 |
| **W-PS-02** | Windows 10/11 | PowerShell + CLAUDE_CODE_PATH | PATH 분리 해결 |
| **M-BASH-01** | macOS | bash login(-i) | `\n` vs `\r`, PATH(zsh 불일치) |
| **M-ZSH-01** | macOS | zsh 환경에서 앱 실행(bash 띄움) | 앱/셸 PATH 달라짐 |
| **M-ZSH-02** | macOS | zsh + CLAUDE_CODE_PATH | PATH 불일치 우회 |
| **L-BASH-01** | Linux(Ubuntu) | /bin/bash --login -i | `\r`만 쓰면 명령 미실행 |

---

## 디렉토리 구조

```
scripts/test/
├── diagnostics/               # L0 진단 스크립트
│   ├── windows-claude-check.ps1
│   ├── macos-claude-check.sh
│   ├── linux-claude-check.sh
│   └── macos-path-diagnostic.sh
├── e2e/                       # E2E 테스트 스펙
│   ├── initialization.spec.js
│   ├── streaming.spec.js
│   ├── input.spec.js
│   └── failure-handling.spec.js
├── results/                   # 테스트 결과
│   ├── TEMPLATE.md
│   ├── W-PS-01.md
│   ├── M-BASH-01.md
│   └── ...
└── README.md                  # 이 파일
```

---

## 진단 스크립트 사용법

### L0 진단 스크립트

앱 외부 터미널에서 Claude CLI 설치 상태 및 실행 가능성을 진단합니다.

#### Windows PowerShell

```powershell
# PowerShell 실행
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process  # 필요시

# 진단 스크립트 실행
.\scripts\test\diagnostics\windows-claude-check.ps1
```

**출력 예시**:
```
========================================
  Claude CLI 진단 (Windows PowerShell)
========================================

[1/5] Claude CLI PATH 검색 중...
  ✓ 발견: C:\Users\user\.local\bin\claude.exe

[2/5] 버전 확인 중...
  ✓ 버전: Claude Code CLI v1.0.0

...
```

#### macOS

```bash
# 실행 권한 부여 (최초 1회)
chmod +x scripts/test/diagnostics/macos-claude-check.sh

# 진단 스크립트 실행
./scripts/test/diagnostics/macos-claude-check.sh
```

#### Linux

```bash
# 실행 권한 부여 (최초 1회)
chmod +x scripts/test/diagnostics/linux-claude-check.sh

# 진단 스크립트 실행
./scripts/test/diagnostics/linux-claude-check.sh
```

#### macOS PATH 진단 (특수 케이스)

macOS에서 zsh 사용자가 앱을 실행할 때 앱은 bash를 띄우므로 PATH 불일치 문제가 발생할 수 있습니다.

```bash
# 실행 권한 부여 (최초 1회)
chmod +x scripts/test/diagnostics/macos-path-diagnostic.sh

# PATH 차이 분석
./scripts/test/diagnostics/macos-path-diagnostic.sh
```

**출력 예시**:
```
========================================
  macOS PATH 진단 (zsh vs bash)
========================================

[1/5] 현재 셸 환경...
  • 현재 셸: /bin/zsh
  • 사용자 기본 셸: /bin/zsh

[2/5] zsh 환경 분석...
  > zsh login shell PATH:
     1./opt/homebrew/bin
     2./usr/local/bin
     ...
  • zsh에서 Claude 위치:
     ✓ /opt/homebrew/bin/claude

[3/5] bash login shell 환경 분석...
  > bash login shell PATH:
     1./usr/bin
     2./bin
     ...
  • bash login에서 Claude 위치:
     ✗ 찾을 수 없음
```

---

## E2E 테스트

### 테스트 프레임워크 설정

현재 E2E 테스트 스펙은 Jest 기반으로 작성된 플레이스홀더입니다. 실제 실행을 위해서는 Electron 앱 구동 인프라가 필요합니다.

### 테스트 스펙 목록

#### 1. 초기화 테스트 (S1, L1)
**파일**: `scripts/test/e2e/initialization.spec.js`

**검증 항목**:
- Claude CLI 프롬프트 준비 완료 감지 (waitForPrompt)
- 5회 반복 실행 시 95% 이상 성공률
- 실패 시 링버퍼에 원인 로그 출력

#### 2. 출력 스트리밍 테스트 (S2, L2)
**파일**: `scripts/test/e2e/streaming.spec.js`

**검증 항목**:
- order:output 이벤트가 UI로 실시간 스트리밍
- 출력 누락 없음

#### 3. 입력 전송 테스트 (S3, L3)
**파일**: `scripts/test/e2e/input.spec.js`

**검증 항목**:
- UI 입력창(sendInput)으로 입력 전송
- 입력→출력 반응 확인

#### 4. 실패 처리 테스트 (S4, L4)
**파일**: `scripts/test/e2e/failure-handling.spec.js`

**검증 항목**:
- PATH 실패 시 fail-fast
- 타임아웃 시 좀비 프로세스 없음

### CI 토글 기능 사용

테스트 시 CI 환경변수 강제 설정을 끌 수 있습니다:

```typescript
import { ClaudeCodeAdapter, ClaudeCodeAdapterConfig } from './claude-code-adapter';

// 기본 동작: CI=true 강제 (비대화형 모드)
const adapter1 = new ClaudeCodeAdapter();

// CI=false로 설정 (대화형 모드 테스트용)
const adapter2 = new ClaudeCodeAdapter({ forceCI: false });

// 실행 중 설정 변경
adapter1.setConfig({ forceCI: false });
```

---

## 테스트 결과 기록

### 결과 기록 템플릿 사용

1. `scripts/test/results/TEMPLATE.md`을 복사하여 새 파일 생성:
   ```bash
   cp scripts/test/results/TEMPLATE.md scripts/test/results/W-PS-01.md
   ```

2. 템플릿의 `[대괄호]` 부분을 실제 테스트 결과로 채웁니다.

3. 필수 섹션:
   - 환경 정보 (OS, 셸, CLI 버전)
   - 테스트 결과 요약 (성공률)
   - 상세 테스트 결과 (L1~L4)
   - 문제점 및 해결 방안
   - 결론

### 결과 파일 명명 규칙

- `W-PS-01.md`: Windows PowerShell Case 1
- `M-BASH-01.md`: macOS bash Case 1
- `M-ZSH-01.md`: macOS zsh Case 1
- `L-BASH-01.md`: Linux bash Case 1

---

## 문제 해결

### 자주 발생하는 문제

#### 1. "Claude CLI를 찾을 수 없습니다"

**증상**: L0 진단에서 PATH 검색 실패

**해결 방법**:
1. Claude CLI 설치 확인:
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

2. Windows: PowerShell을 재시작하여 PATH 갱신

3. macOS/Linux: 셸 설정 파일 재로드:
   ```bash
   source ~/.zshrc   # zsh
   source ~/.bashrc  # bash
   ```

#### 2. macOS에서 앱은 Claude를 못 찾는데 터미널에서는 됨

**증상**: 터미널(zsh)에서는 `which claude`가 되는데 앱에서 초기화 실패

**원인**: zsh와 bash login PATH가 다름

**해결 방법**:
1. `macos-path-diagnostic.sh` 실행으로 차이 확인
2. **방법 1** (권장): bash 프로필에 PATH 추가
   ```bash
   # ~/.bash_profile 또는 ~/.bashrc
   export PATH="/opt/homebrew/bin:$PATH"
   ```
3. **방법 2**: 심볼릭 링크 생성
   ```bash
   sudo ln -s /opt/homebrew/bin/claude /usr/local/bin/claude
   ```

#### 3. 초기화 타임아웃 (waitForPrompt 실패)

**증상**: L1 테스트에서 10초 내 프롬프트 감지 실패

**해결 방법**:
1. 링버퍼 로그 확인 (로그 파일 또는 콘솔 출력)
2. 흔한 원인:
   - `command not found`: CLI 설치 또는 PATH 문제
   - `login required`: 로그인 필요 (사전에 로그인 수행)
   - `update required`: CLI 업데이트 필요

#### 4. 좀비 프로세스 남음

**증상**: 테스트 종료 후에도 claude 프로세스가 남음

**확인 방법**:
```bash
# Windows
tasklist | findstr claude

# macOS/Linux
ps aux | grep claude
```

**해결 방법**:
1. 수동 정리:
   ```bash
   # macOS/Linux
   pkill -9 claude
   ```

2. L4 테스트로 정리 로직 검증 필요

---

## 참고 자료

- [프로젝트 개요](../../docs/claude-cli-terminal/00_overview.md)
- [테스트 매트릭스 상세](../../docs/claude-cli-terminal/06_test_matrix.md)
- [구현 계획](../../.claude/docs/tasks/claude-cli-test-matrix/context.md)

---

**마지막 업데이트**: 2026-01-17
