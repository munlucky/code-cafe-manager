# @codecafe/providers-codex

> Codex CLI Provider 구현체

## Flow

```
[Orchestrator/TerminalPool 호출]
        │
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│  src/index.ts                                                         │
│  - CodexProvider export                                               │
└───────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│  src/provider.ts:19-311                                               │
│  CodexProvider extends EventEmitter implements IProvider              │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  run(config):30-78 - Interactive Mode                           │  │
│  │  1. pty.spawn(shell) → PTY 프로세스 생성                         │  │
│  │  2. ptyProcess.write(`codex "${prompt}"`)                       │  │
│  │  3. onData → emit('data')                                       │  │
│  │  4. onExit → emit('exit')                                       │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  executeWithSchema(config):168-244 - Headless Mode              │  │
│  │  1. promptPath 생성 (outputDir/prompt.txt)                      │  │
│  │  2. codex exec --json --output-schema <schema> -i <prompt>      │  │
│  │  3. JSON 파싱 → result.json 저장                                 │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  Static Methods                                                 │  │
│  │  - validateEnv():111-155 → which/where codex                    │  │
│  │  - getAuthHint():160-162 → "codex login" 안내                   │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│  Codex CLI                                                            │
│  - codex "<prompt>"                           (Interactive)           │
│  - codex exec --json --output-schema <s> -i <f>  (Headless)           │
└───────────────────────────────────────────────────────────────────────┘
```

## File Map

| 파일 | 역할 | 핵심 Export |
|------|------|-------------|
| `src/index.ts` | 패키지 진입점 | `CodexProvider` |
| `src/provider.ts` | Provider 구현 | `CodexProvider` class |

## API

```typescript
class CodexProvider extends EventEmitter implements IProvider {
  // Interactive Mode
  run(config: ProviderConfig): Promise<void>
  write(data: string): void
  stop(): void
  isActive(): boolean

  // Headless Mode
  executeWithSchema(config: SchemaExecutionConfig): Promise<SchemaExecutionResult>

  // Static
  static validateEnv(): Promise<ValidationResult>
  static getAuthHint(): string
}
```

## Events

| Event | Payload | 설명 |
|-------|---------|------|
| `data` | `string` | CLI 출력 데이터 (스트리밍) |
| `exit` | `{ exitCode, signal }` | 프로세스 종료 |
| `error` | `Error` | 에러 발생 (timeout 포함) |

## Dependencies

- **상위**: `orchestrator` (via adapter)
- **하위**: `@codecafe/providers-common`
- **외부**: `node-pty` (PTY 프로세스 관리)

## CLI Commands

| 모드 | 명령어 | 설명 |
|------|--------|------|
| Interactive | `codex "<prompt>"` | 대화형 실행 |
| Headless | `codex exec --json --output-schema <schema> -i <file>` | JSON 출력 |

## Review Checklist

이 패키지 변경 시 확인:
- [ ] PTY 옵션 변경 시 → Windows/Unix 호환성
- [ ] CLI 옵션 변경 시 → Codex 버전 호환성
- [ ] 이벤트 페이로드 변경 시 → orchestrator 어댑터 확인
- [ ] timeout 로직 변경 시 → 리소스 누수 확인

## Platform Notes

- **Windows**: `powershell.exe` + `\r` 줄바꿈
- **Unix**: `bash` + `\n` 줄바꿈
- **validateEnv**: `where` (Windows) / `which` (Unix)

## Difference from Claude Code Provider

| 항목 | Claude Code | Codex |
|------|-------------|-------|
| Interactive 명령 | `claude "<prompt>"` | `codex "<prompt>"` |
| Headless 명령 | `-p @file --output-format json` | `exec --json -i <file>` |
| Schema 옵션 | (미지원) | `--output-schema <path>` |
