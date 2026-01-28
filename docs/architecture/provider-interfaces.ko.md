# Provider 인터페이스 아키텍처

## 개요

CodeCafe는 Provider 실행을 위한 두 계층 추상화를 사용합니다:

1. **IProvider** (고수준) - CLI 실행 프로세스 추상화
2. **IProviderAdapter** (저수준) - PTY 기반 터미널 실행 추상화

## IProvider 인터페이스

**위치**: `@codecafe/providers-common`

**목적**: CLI 기반 AI Provider 실행 추상화 (Claude Code, Codex 등)

```typescript
interface IProvider {
  /**
   * 주어진 옵션으로 Provider 실행
   */
  run(options: ProviderRunOptions): Promise<void>;

  /**
   * 실행 중인 Provider에 입력 전송
   */
  sendInput(message: string): Promise<void>;

  /**
   * Provider 프로세스 종료
   */
  kill(): Promise<void>;

  /**
   * 프로세스 이벤트를 위한 이벤트 이미터
   */
  on(event: 'data', handler: (data: string) => void): void;
  on(event: 'exit', handler: (info: { exitCode: number; signal?: number }) => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
}
```

**책임**:
- CLI 프로세스 생성 (`claude`, `codex` 등)
- 프로세스 라이프사이클 관리 (시작, 종료, 정리)
- stdout/stderr를 데이터 이벤트로 발행
- 프로세스 종료 코드 및 시그널 처리

**구현**:
- `ClaudeCodeProvider` - `claude` CLI 실행
- `CodexProvider` - `codex` CLI 실행

## IProviderAdapter 인터페이스

**위치**: `@codecafe/orchestrator/src/terminal`

**목적**: 다중 터미널 오케스트레이션을 위한 PTY 기반 터미널 실행 추상화

```typescript
interface IProviderAdapter {
  /**
   * PTY로 명령어 실행
   */
  execute(context: ExecutionContext): Promise<ExecutionResult>;

  /**
   * PTY 프로세스 종료
   */
  kill(process: ProcessHandle): Promise<void>;

  /**
   * PTY 인스턴스 생성
   */
  createPty(): Promise<PtyInstance>;
}
```

**책임**:
- PTY (pseudo-terminal) 인스턴스 생성
- 터미널 I/O 처리 (PTY 통한 stdin/stdout/stderr)
- 프로세스 그룹 관리 (시그널 전파)
- 다중 터미널 조정 지원

**구현**:
- `ClaudeCodeAdapter` - Claude Code용 PTY 어댑터
- `CodexAdapter` - Codex용 PTY 어댑터

## 아키텍처 비교

| 측면 | IProvider | IProviderAdapter |
|------|-----------|------------------|
| **추상화 레벨** | 높음 (CLI 프로세스) | 낮음 (PTY 터미널) |
| **사용 사례** | 단일 Provider 실행 | 다중 터미널 오케스트레이션 |
| **이벤트 모델** | 이벤트 이미터 (data, exit, error) | Promise 기반 (execute, kill) |
| **터미널 제어** | 표준 프로세스 I/O | 완전한 PTY 제어 |
| **다중 터미널** | 아니오 (단일 프로세스) | 예 (조정된 그룹) |
| **세션 관리** | 아니오 | 예 (CafeSessionManager 통해) |

## 각각을 사용해야 할 때

### IProvider를 사용할 때:
- 단일 AI Provider 명령 실행
- 간단한 CLI 상호작용 필요
- 이벤트 기반 출력 처리로 충분
- 예: `codecafe run --issue "버그 수정"`

### IProviderAdapter를 사용할 때:
- 여러 터미널 오케스트레이션
- PTY 수준 제어 필요
- 세션 기반 실행 필요
- 예: 여러 스테이지가 있는 Moonshot 워크플로우

## 데이터 흐름

```
┌─────────────────────────────────────────────────────────────────────┐
│                         IProvider 계층                              │
│  (CLI 프로세스 실행 - 단일 Provider)                                │
│                                                                      │
│  [ClaudeCodeProvider.run()]  ──►  spawn('claude', [args])          │
│         │                                                            │
│         ├──► stdout.pipe(process.stdout)                             │
│         ├──► 'data' event → CLI 출력                                 │
│         └──► 'exit' event → 정리                                    │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       IProviderAdapter 계층                          │
│  (PTY 터미널 실행 - 다중 터미널 오케스트레이션)                       │
│                                                                      │
│  [ClaudeCodeAdapter.execute()]  ──►  node-pty.spawn('claude')       │
│         │                                                            │
│         ├──► Pty 데이터 → OrderSession.output 이벤트                │
│         ├──► TerminalGroup 조정                                     │
│         └──► 다중 터미널 공유 컨텍스트                              │
└─────────────────────────────────────────────────────────────────────┘
```

## 통합 지점

### CLI 명령 (IProvider)
```typescript
// packages/cli/src/commands/run.ts
const provider = new ClaudeCodeProvider();
provider.on('data', (data) => console.log(data));
await provider.run({ workingDirectory, prompt });
```

### Orchestrator (IProviderAdapter)
```typescript
// packages/orchestrator/src/terminal/
const adapter = ProviderAdapterFactory.get('claude-code');
await adapter.execute(context, { cwd, env });
```

## 마이그레이션 참고 사항

- **IProvider**는 간단한 CLI 명령을 위한 인터페이스로 유지됩니다
- **IProviderAdapter**는 워크플로우 오케스트레이션을 위해 `CafeSessionManager`에서 사용됩니다
- 두 인터페이스는 서로 다른 사용 사례를 위해 공존합니다
- 향후 Provider는 두 인터페이스를 모두 구현해야 합니다

## 관련 파일

- `packages/providers/common/src/provider.ts` - IProvider 인터페이스
- `packages/orchestrator/src/terminal/provider-adapter.ts` - IProviderAdapter 인터페이스
- `packages/orchestrator/src/terminal/adapters/claude-code-adapter.ts` - Claude 어댑터
- `packages/orchestrator/src/terminal/adapters/codex-adapter.ts` - Codex 어댑터
