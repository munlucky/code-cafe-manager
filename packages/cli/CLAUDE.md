# @codecafe/cli

> CodeCafe CLI 진입점 (codecafe 명령어)

## Flow

```
$ codecafe <command> [options]
        │
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│  src/index.ts:17-44                                                   │
│  main()                                                               │
│  - Commander program 생성                                             │
│  - 명령어 등록 (init, doctor, run, status, ui, orch)                   │
│  - program.parseAsync()                                               │
└───────────────────────────────────────────────────────────────────────┘
        │
        ├─────────────────────────────────────────────────────┐
        │                                                     │
        ▼                                                     ▼
┌─────────────────────────┐              ┌─────────────────────────────┐
│  commands/init.ts       │              │  commands/run.ts            │
│  registerInitCommand()  │              │  registerRunCommand()       │
│  - .orch 디렉토리 초기화  │              │  - workflow 실행             │
│  - cafe.yaml 생성        │              │  - provider 선택            │
└─────────────────────────┘              │  - worktree 옵션            │
                                         └─────────────────────────────┘
        │                                         │
        ▼                                         ▼
┌─────────────────────────┐              ┌─────────────────────────────┐
│  commands/doctor.ts     │              │  commands/status.ts         │
│  registerDoctorCommand()│              │  registerStatusCommand()    │
│  - Provider 환경 검증    │              │  - 실행 상태 조회            │
│  - CLI 설치 확인         │              └─────────────────────────────┘
└─────────────────────────┘
        │                                         │
        ▼                                         ▼
┌─────────────────────────┐              ┌─────────────────────────────┐
│  commands/ui.ts         │              │  commands/orch.ts           │
│  registerUiCommand()    │              │  registerOrchCommand()      │
│  - Electron UI 실행      │              │  - 내부 오케스트레이션 명령   │
│  - desktop 패키지 연동   │              └─────────────────────────────┘
└─────────────────────────┘
```

## File Map

| 파일 | 역할 | 핵심 Export |
|------|------|-------------|
| `src/index.ts` | CLI 진입점 | `main()` |
| `src/config.ts` | 설정 관리 | config utilities |
| `src/commands/init.ts` | init 명령어 | `registerInitCommand()` |
| `src/commands/doctor.ts` | doctor 명령어 | `registerDoctorCommand()` |
| `src/commands/run.ts` | run 명령어 | `registerRunCommand()` |
| `src/commands/status.ts` | status 명령어 | `registerStatusCommand()` |
| `src/commands/ui.ts` | ui 명령어 | `registerUiCommand()` |
| `src/commands/orch.ts` | orch 명령어 | `registerOrchCommand()` |

## Commands

| 명령어 | 설명 | 주요 옵션 |
|--------|------|----------|
| `codecafe init` | 프로젝트 초기화 | - |
| `codecafe doctor` | 환경 검증 | - |
| `codecafe run <workflow>` | 워크플로우 실행 | `--provider`, `--worktree`, `--prompt` |
| `codecafe status` | 실행 상태 조회 | `--run-id` |
| `codecafe ui` | GUI 실행 | - |
| `codecafe orch` | 내부 명령 | (내부용) |

## Dependencies

- **상위**: (최상위 패키지)
- **하위**: `@codecafe/core`, `@codecafe/orchestrator`, `@codecafe/git-worktree`, `@codecafe/provider-*`
- **외부**: `commander`, `chalk`, `inquirer`, `ora`

## Review Checklist

이 패키지 변경 시 확인:
- [ ] 새 명령어 추가 시 → `index.ts`에 register 호출
- [ ] 옵션 변경 시 → help 텍스트 업데이트
- [ ] orchestrator API 변경 시 → 명령어 로직 수정
- [ ] 에러 메시지 변경 시 → 사용자 친화적 메시지 유지

## CLI Pattern

```typescript
// 명령어 등록 패턴
export function registerXxxCommand(program: Command): void {
  program
    .command('xxx')
    .description('설명')
    .option('-o, --option <value>', '옵션 설명')
    .action(async (options) => {
      // 실행 로직
    });
}
```
