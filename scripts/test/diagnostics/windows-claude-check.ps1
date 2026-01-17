# Claude CLI 진단 스크립트 (Windows PowerShell)
# 용도: Windows 환경에서 Claude CLI 설치 상태 및 실행 가능성 진단

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Claude CLI 진단 (Windows PowerShell)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. PATH에서 Claude CLI 검색
Write-Host "[1/5] Claude CLI PATH 검색 중..." -ForegroundColor Yellow
try {
    $claudePath = where.exe claude 2>$null
    if ($claudePath) {
        Write-Host "  ✓ 발견:" -ForegroundColor Green -NoNewline
        Write-Host " $claudePath"
    } else {
        Write-Host "  ✗ Claude CLI를 PATH에서 찾을 수 없습니다" -ForegroundColor Red
        Write-Host "    설치 방법: npm install -g @anthropic-ai/claude-code" -ForegroundColor Gray
        exit 1
    }
} catch {
    Write-Host "  ✗ 검색 실패: $_" -ForegroundColor Red
    exit 1
}

# 2. 버전 확인
Write-Host ""
Write-Host "[2/5] 버전 확인 중..." -ForegroundColor Yellow
try {
    $versionOutput = & claude --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ 버전:" -ForegroundColor Green -NoNewline
        Write-Host " $versionOutput"
    } else {
        Write-Host "  ✗ 버전 확인 실패" -ForegroundColor Red
        Write-Host "    출력: $versionOutput" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ✗ 실행 실패: $_" -ForegroundColor Red
}

# 3. PATH 환경변수 확인
Write-Host ""
Write-Host "[3/5] PATH 환경변수 분석..." -ForegroundColor Yellow
$pathDirs = $env:PATH -split ';'
$claudeInPath = $pathDirs | Where-Object { Test-Path (Join-Path $_ "claude.exe") } | Select-Object -First 1

if ($claudeInPath) {
    Write-Host "  ✓ Claude CLI가 포함된 PATH:" -ForegroundColor Green -NoNewline
    Write-Host " $claudeInPath"
} else {
    Write-Host "  ! PATH에 Claude CLI가 없습니다 (별도 경로 지정 필요)" -ForegroundColor Yellow
}

# 4. PowerShell 버전 및 실행 정책 확인
Write-Host ""
Write-Host "[4/5] PowerShell 환경 확인..." -ForegroundColor Yellow
$psVersion = $PSVersionTable.PSVersion
Write-Host "  • PowerShell 버전:" -ForegroundColor Gray -NoNewline
Write-Host " $psVersion" -ForegroundColor Cyan

$executionPolicy = Get-ExecutionPolicy
Write-Host "  • 실행 정책:" -ForegroundColor Gray -NoNewline
Write-Host " $executionPolicy" -ForegroundColor Cyan

if ($executionPolicy -eq "Restricted") {
    Write-Host "  ! 실행 정책이 Restricted입니다. 스크립트 실행이 제한될 수 있습니다." -ForegroundColor Yellow
}

# 5. 인터랙티브 모드 테스트 가이드
Write-Host ""
Write-Host "[5/5] 인터랙티브 모드 테스트" -ForegroundColor Yellow
Write-Host "  수동 테스트를 위해 아래 명령어를 실행하세요:" -ForegroundColor Gray
Write-Host "    claude" -ForegroundColor White
Write-Host "  정상 동작 시 프롬프트(>, ›, », ❯)가 표시되어야 합니다" -ForegroundColor Gray
Write-Host "  종료하려면: Ctrl+C 또는 exit 입력" -ForegroundColor Gray

# 6. 진단 요약
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  진단 요약" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($claudePath) {
    Write-Host "  상태: ✓ 정상" -ForegroundColor Green
    Write-Host "  경로: $claudePath" -ForegroundColor White
    Write-Host ""
    Write-Host "  다음 단계:" -ForegroundColor Yellow
    Write-Host "    1. CodeCafe 앱 실행" -ForegroundColor White
    Write-Host "    2. Order 생성 및 실행" -ForegroundColor White
    Write-Host "    3. 초기화 로그 확인 (waitForPrompt 감지)" -ForegroundColor White
} else {
    Write-Host "  상태: ✗ 설치 필요" -ForegroundColor Red
    Write-Host ""
    Write-Host "  설치 방법:" -ForegroundColor Yellow
    Write-Host "    npm: npm install -g @anthropic-ai/claude-code" -ForegroundColor White
    Write-Host "    bun: bun add -g @anthropic-ai/claude-code" -ForegroundColor White
}

Write-Host ""
Write-Host "진단 완료" -ForegroundColor Cyan
Write-Host ""
