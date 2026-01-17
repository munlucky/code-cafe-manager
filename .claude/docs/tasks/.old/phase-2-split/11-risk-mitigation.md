# Risk Mitigation

## 8. Risk Mitigation

### R-1: Terminal Pool 동시성 Race Condition (MEDIUM → LOW, Gap 2 해결)
**리스크**: Lease/Release 시 상태 불일치

**완화 전략:**
- ✅ **p-limit Semaphore** (검증된 라이브러리)
- ✅ **LeaseToken 명시적 추적** (Gap 2 해결)
- ✅ 원자적 상태 전이 (idle → busy → idle)
- 단위 테스트 + 부하 테스트 철저히

**검증 방법:**
- 동시성 테스트: 10개 Order, 8개 Terminal
- 99%ile lease wait time < 1s
- No deadlock, no leaked processes

---

### R-2: Role Template 파싱 오류 (LOW)
**리스크**: 손상된 Markdown, 잘못된 Frontmatter

**완화 전략:**
- Zod 스키마 검증
- Handlebars 템플릿 파싱 검증
- 에러 발생 시 해당 Role만 스킵, 전체 로드는 계속

**검증 방법:**
- 단위 테스트: 잘못된 Frontmatter 처리
- 단위 테스트: 필수 변수 누락 시 검증 실패

---

### R-3: node-pty Native Module Build (HIGH)
**리스크**: Electron에서 node-pty 빌드 실패 (OS별 차이)

**완화 전략:**
- Phase 2 시작 전 검증:
  ```bash
  npm install --global node-gyp
  pnpm install
  pnpm rebuild node-pty --runtime=electron --target=<electron-version> --disturl=https://electronjs.org/headers
  ```
- CI/CD 자동화:
  - Windows: Visual Studio Build Tools 2019+
  - macOS: Xcode Command Line Tools
  - Linux: build-essential, python3

**검증 방법:**
- 3개 OS에서 Electron 앱 실행 + Terminal spawn 성공
- 빌드 실패 시: electron-rebuild 재실행 + 로그 수집

---

### R-4: Barista-Terminal 분리 후 호환성 (LOW → RESOLVED, Gap 4 해결)
**리스크**: 기존 Order 실행 로직이 새 구조에서 깨질 수 있음

**완화 전략:**
- ✅ **Phase 2a-2c Migration Plan** (Gap 4 해결)
- ✅ **BaristaEngineV2 병행 실행**
- ✅ **LegacyBaristaAdapter** 제공
- ✅ **generic-agent Role** 기본 제공
- E2E 테스트로 회귀 검증

**검증 방법:**
- 기존 Order 샘플로 회귀 테스트
- 새 Role 기반 Order 생성 → 실행 → 검증

---

### R-5: Provider Adapter Protocol 불일치 (MEDIUM → LOW, Gap 1 해결)
**리스크**: Provider별 프로토콜 차이로 통신 실패

**완화 전략:**
- ✅ **IProviderAdapter Interface** (Gap 1 해결)
- ✅ **ClaudeCodeAdapter, CodexAdapter 구현**
- ✅ stdin/stdout 프로토콜 명세화
- Adapter별 단위 테스트

**검증 방법:**
- 각 Provider Adapter 단위 테스트
- 실제 Provider 프로세스로 통합 테스트

---

### R-6: Crash Recovery 실패 시 리스 누수 (MEDIUM → LOW, Gap 5 해결)
**리스크**: Terminal crash 후 리스가 해제되지 않음

**완화 전략:**
- ✅ **Crash Recovery State Machine** (Gap 5 해결)
- ✅ **Auto-restart 로직** (maxRetries 이내)
- ✅ **Caller retry logic** (Barista)
- Crash simulation 테스트

**검증 방법:**
- Terminal crash 테스트 (exit code !== 0)
- Crash recovery 성공 확인
- Retry 실패 시 에러 throw 확인

---

**다음 문서:** [12-implementation-timeline.md](12-implementation-timeline.md) - Implementation Timeline