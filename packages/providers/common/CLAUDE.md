# @codecafe/providers-common

> Provider 공통 인터페이스 정의

## Flow

```
[Provider 구현체]
        │
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│  src/index.ts                                                         │
│  - IProvider 인터페이스 export                                         │
└───────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│  src/provider-interface.ts:34-86                                      │
│  IProvider (EventEmitter 확장)                                        │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  Methods                                                        │  │
│  │  - run(config): Promise<void>    // CLI 실행                    │  │
│  │  - write(data): void             // 입력 전송                    │  │
│  │  - stop(): void                  // 프로세스 중지                 │  │
│  │  - isActive(): boolean           // 상태 확인                    │  │
│  │  - executeWithSchema?(): Promise // Schema 기반 실행 (옵셔널)    │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │  Events                                                         │  │
│  │  - 'data': 로그 데이터 스트리밍                                   │  │
│  │  - 'exit': 프로세스 종료                                         │  │
│  │  - 'error': 에러 발생                                            │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────┘
```

## File Map

| 파일 | 역할 | 핵심 Export |
|------|------|-------------|
| `src/index.ts` | 패키지 진입점 | 모든 인터페이스 |
| `src/provider-interface.ts` | 인터페이스 정의 | `IProvider`, `IProviderStatic`, `ProviderConfig`, etc. |

## Interfaces

```typescript
// Provider 설정
interface ProviderConfig {
  workingDirectory: string;
  prompt?: string;
  timeout?: number;
}

// Schema 기반 실행 설정
interface SchemaExecutionConfig extends ProviderConfig {
  schemaPath: string;
  outputDir: string;
  env?: Record<string, string>;
}

// Schema 기반 실행 결과
interface SchemaExecutionResult {
  success: boolean;
  output?: any;
  rawText?: string;
  error?: string;
}

// Provider 인터페이스
interface IProvider extends EventEmitter {
  run(config: ProviderConfig): Promise<void>;
  write(data: string): void;
  stop(): void;
  isActive(): boolean;
  executeWithSchema?(config: SchemaExecutionConfig): Promise<SchemaExecutionResult>;
}

// Provider 정적 메서드
interface IProviderStatic {
  validateEnv(): Promise<ValidationResult>;
  getAuthHint(): string;
}

// 환경 검증 결과
interface ValidationResult {
  valid: boolean;
  message?: string;
}
```

## Dependencies

- **상위**: `provider-claude-code`, `providers-codex`, `orchestrator`
- **하위**: (없음 - 순수 타입/인터페이스 패키지)

## Review Checklist

이 패키지 변경 시 확인:
- [ ] `IProvider` 메서드 추가/변경 시 → 모든 Provider 구현체 업데이트
- [ ] 타입 변경 시 → orchestrator 어댑터 호환성 확인
- [ ] 새 이벤트 추가 시 → 이벤트 문서화

## Implementation Contract

Provider 구현체가 준수해야 하는 규약:

1. **EventEmitter 상속**: `data`, `exit`, `error` 이벤트 필수
2. **run()**: 중복 실행 방지 (`isRunning` 체크)
3. **stop()**: 안전한 종료 (프로세스 kill)
4. **validateEnv()**: 정적 메서드로 CLI 설치 확인
5. **getAuthHint()**: 인증 가이드 문자열 반환
