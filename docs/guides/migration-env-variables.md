# Configuration Migration Guide

## Overview

CodeCafe v0.2.0부터 `~/.codecafe/config.json` 대신 환경 변수를 사용하여 설정합니다.
이 가이드는 기존 config.json 사용자를 위한 마이그레이션 방법을 설명합니다.

## Environment Variables

### Directory Configuration

| 환경 변수 | 설명 | 기본값 |
|----------|------|-------|
| `CODECAFE_CONFIG_DIR` | 설정 디렉터리 | `~/.codecafe` |
| `CODECAFE_DATA_DIR` | 데이터 저장 디렉터리 | `$CODECAFE_CONFIG_DIR/data` |
| `CODECAFE_LOGS_DIR` | 로그 디렉터리 | `$CODECAFE_CONFIG_DIR/logs` |

### Provider Configuration

| 환경 변수 | 설명 | 기본값 |
|----------|------|-------|
| `CODECAFE_DEFAULT_PROVIDER` | 기본 AI 제공자 | `claude-code` |
| `CODECAFE_CLAUDE_VERBOSE` | Claude 상세 로깅 활성화 (`1` 또는 `true`) | `false` |
| `CODECAFE_CLAUDE_STREAMING` | 스트리밍 출력 활성화 (`1` 또는 `true`) | `true` (미설정 시 활성화) |
| `CODECAFE_SKIP_BUN` | Bun 런타임 건너뛰기 (`1` 또는 `true`) | `false` |

> **참고**: Boolean 환경 변수는 `1` 또는 `true`로 활성화합니다. 다른 값이나 미설정 시 비활성화됩니다.
> 단, `CODECAFE_CLAUDE_STREAMING`은 미설정 시 기본 활성화됩니다. 비활성화하려면 `0` 또는 `false`로 설정하세요.

### Desktop Configuration

| 환경 변수 | 설명 | 기본값 |
|----------|------|-------|
| `CODECAFE_ORCH_DIR` | Orchestrator 디렉터리 | (앱 번들 내) |

## Migration Steps

### 1. 기존 config.json 백업

```bash
cp ~/.codecafe/config.json ~/.codecafe/config.json.bak
```

### 2. 환경 변수 설정

**Linux/macOS** (`~/.bashrc` 또는 `~/.zshrc`):

```bash
# CodeCafe Configuration
export CODECAFE_CONFIG_DIR="$HOME/.codecafe"
export CODECAFE_DATA_DIR="$HOME/.codecafe/data"
export CODECAFE_LOGS_DIR="$HOME/.codecafe/logs"
export CODECAFE_DEFAULT_PROVIDER="claude-code"
```

**Windows** (PowerShell Profile `$PROFILE`):

```powershell
# CodeCafe Configuration
$env:CODECAFE_CONFIG_DIR = "$env:USERPROFILE\.codecafe"
$env:CODECAFE_DATA_DIR = "$env:CODECAFE_CONFIG_DIR\data"
$env:CODECAFE_LOGS_DIR = "$env:CODECAFE_CONFIG_DIR\logs"
$env:CODECAFE_DEFAULT_PROVIDER = "claude-code"
```

**Windows** (시스템 환경 변수 - GUI):

1. 시스템 속성 > 환경 변수
2. 사용자 변수에 위 변수들 추가

### 3. 기존 config.json에서 값 마이그레이션

기존 `~/.codecafe/config.json` 예시:

```json
{
  "version": "0.1.0",
  "defaultProvider": "codex",
  "maxBaristas": 4,
  "menuSources": [...]
}
```

환경 변수로 변환:

```bash
export CODECAFE_DEFAULT_PROVIDER="codex"
# maxBaristas는 현재 환경 변수로 지원되지 않음 (기본값 4 사용)
```

### 4. 검증

```bash
# CLI 상태 확인
codecafe doctor

# 또는 직접 확인
echo $CODECAFE_CONFIG_DIR
echo $CODECAFE_DATA_DIR
```

## Config.json to Environment Variable Mapping

| config.json 필드 | 환경 변수 | 비고 |
|-----------------|----------|------|
| `defaultProvider` | `CODECAFE_DEFAULT_PROVIDER` | 직접 매핑 |
| `maxBaristas` | - | 환경 변수 미지원 (기본값: 4) |
| `menuSources` | - | 환경 변수 미지원 |

## Troubleshooting

### Q: 환경 변수가 적용되지 않습니다

**A:** 셸을 재시작하거나 설정 파일을 다시 로드하세요:

```bash
# Bash
source ~/.bashrc

# Zsh
source ~/.zshrc
```

### Q: Desktop 앱에서 환경 변수가 인식되지 않습니다

**A:** GUI 앱은 셸 환경을 상속하지 않을 수 있습니다. 해결 방법:

1. **시스템 환경 변수로 설정** (재부팅 필요)
2. **터미널에서 앱 실행**:
   ```bash
   # macOS
   open -a "CodeCafe"

   # Linux
   codecafe-desktop
   ```

### Q: 기존 데이터는 어떻게 되나요?

**A:** 데이터 파일(`orders.json`, `baristas.json`, `receipts.json`)은 동일한 위치에 유지됩니다.
환경 변수가 기존 경로를 가리키면 데이터가 자동으로 인식됩니다.

### Q: config.json을 삭제해도 되나요?

**A:** 환경 변수 설정 후 `~/.codecafe/config.json`은 더 이상 사용되지 않습니다.
백업 후 삭제해도 무방합니다.

## Deprecation Notice

- **v0.2.x**: 환경 변수 우선, config.json 폴백 (현재)
- **v0.3.0 (예정)**: config.json 지원 제거

마이그레이션을 완료하여 향후 버전 업그레이드에 대비하세요.
