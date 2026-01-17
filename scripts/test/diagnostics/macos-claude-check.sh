#!/bin/bash
# Claude CLI 진단 스크립트 (macOS)
# 용도: macOS 환경에서 Claude CLI 설치 상태 및 실행 가능성 진단

set -e

echo ""
echo "========================================"
echo "  Claude CLI 진단 (macOS)"
echo "========================================"
echo ""

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# 1. PATH에서 Claude CLI 검색
echo -e "${CYAN}[1/6]${NC} Claude CLI PATH 검색 중..."
if command -v claude &> /dev/null; then
    CLAUDE_PATH=$(which claude)
    echo -e "  ${GREEN}✓ 발견:${NC} $CLAUDE_PATH"
else
    echo -e "  ${RED}✗ Claude CLI를 PATH에서 찾을 수 없습니다${NC}"
    echo -e "    ${GRAY}설치 방법: npm install -g @anthropic-ai/claude-code${NC}"
    exit 1
fi

# 2. 버전 확인
echo ""
echo -e "${CYAN}[2/6]${NC} 버전 확인 중..."
if VERSION=$(claude --version 2>&1); then
    echo -e "  ${GREEN}✓ 버전:${NC} $VERSION"
else
    echo -e "  ${RED}✗ 버전 확인 실패${NC}"
    echo -e "    ${GRAY}출력: $VERSION${NC}"
fi

# 3. 실행 권한 확인
echo ""
echo -e "${CYAN}[3/6]${NC} 실행 권한 확인 중..."
if [ -x "$CLAUDE_PATH" ]; then
    echo -e "  ${GREEN}✓ 실행 권한 있음${NC}"
else
    echo -e "  ${RED}✗ 실행 권한 없음${NC}"
    echo -e "    ${GRAY}수정: chmod +x $CLAUDE_PATH${NC}"
fi

# 4. 기본 셸 확인
echo ""
echo -e "${CYAN}[4/6]${NC} 셸 환경 확인..."
USER_SHELL=$(echo $SHELL)
echo -e "  ${GRAY}• 기본 셸:${NC} $USER_SHELL"

# zsh vs bash 확인
if [[ "$USER_SHELL" == *"zsh"* ]]; then
    echo -e "  ${GRAY}• 사용자 셸: zsh${NC}"
    BASH_IN_ZSH_PATH=$(/bin/zsh -lc 'which claude' 2>/dev/null || echo "NOT_FOUND")
    if [ "$BASH_IN_ZSH_PATH" != "NOT_FOUND" ]; then
        echo -e "  ${GREEN}✓ zsh PATH에서 Claude 발견:${NC} $BASH_IN_ZSH_PATH"
    else
        echo -e "  ${YELLOW}! zsh PATH에서 Claude를 찾을 수 없음${NC}"
    fi
elif [[ "$USER_SHELL" == *"bash"* ]]; then
    echo -e "  ${GRAY}• 사용자 셸: bash${NC}"
fi

# bash login shell PATH 확인
BASH_PATH=$(/bin/bash -lc 'which claude' 2>/dev/null || echo "NOT_FOUND")
if [ "$BASH_PATH" != "NOT_FOUND" ]; then
    echo -e "  ${GREEN}✓ bash login PATH에서 Claude 발견:${NC} $BASH_PATH"
else
    echo -e "  ${YELLOW}! bash login PATH에서 Claude를 찾을 수 없음${NC}"
fi

# 5. CLAUDE_CODE_PATH 환경변수 확인
echo ""
echo -e "${CYAN}[5/6]${NC} CLAUDE_CODE_PATH 환경변수 확인..."
if [ -n "$CLAUDE_CODE_PATH" ]; then
    echo -e "  ${GRAY}• CLAUDE_CODE_PATH:${NC} $CLAUDE_CODE_PATH"
    if [ -f "$CLAUDE_CODE_PATH" ]; then
        echo -e "  ${GREEN}✓ 지정된 경로에 파일 존재${NC}"
    else
        echo -e "  ${RED}✗ 지정된 경로에 파일 없음${NC}"
    fi
else
    echo -e "  ${GRAY}• CLAUDE_CODE_PATH: 설정되지 않음 (PATH 사용)${NC}"
fi

# 6. 인터랙티브 모드 테스트 가이드
echo ""
echo -e "${CYAN}[6/6]${NC} 인터랙티브 모드 테스트"
echo -e "  ${GRAY}수동 테스트를 위해 아래 명령어를 실행하세요:${NC}"
echo -e "    claude"
echo -e "  ${GRAY}정상 동작 시 프롬프트(>, ›, », ❯)가 표시되어야 합니다${NC}"
echo -e "  ${GRAY}종료하려면: Ctrl+C 또는 exit 입력${NC}"

# 7. 진단 요약
echo ""
echo "========================================"
echo "  진단 요약"
echo "========================================"

if command -v claude &> /dev/null; then
    echo -e "  ${GREEN}상태: ✓ 정상${NC}"
    echo -e "  ${NC}경로: $CLAUDE_PATH${NC}"
    echo ""
    echo -e "  ${YELLOW}다음 단계:${NC}"
    echo -e "    1. zsh/bash PATH 불일치 확인 (별도 진단 스크립트 실행)${NC}"
    echo -e "    2. CodeCafe 앱 실행${NC}"
    echo -e "    3. Order 생성 및 실행${NC}"
    echo -e "    4. 초기화 로그 확인 (waitForPrompt 감지)${NC}"

    # zsh vs bash PATH 경고
    if [ "$BASH_PATH" != "$CLAUDE_PATH" ] && [ "$BASH_PATH" != "NOT_FOUND" ]; then
        echo ""
        echo -e "  ${YELLOW}주의: zsh와 bash login PATH가 다릅니다${NC}"
        echo -e "    ${GRAY}자세한 내용은 macos-path-diagnostic.sh 실행${NC}"
    fi
else
    echo -e "  ${RED}상태: ✗ 설치 필요${NC}"
    echo ""
    echo -e "  ${YELLOW}설치 방법:${NC}"
    echo -e "    npm: npm install -g @anthropic-ai/claude-code${NC}"
    echo -e "    bun: bun add -g @anthropic-ai/claude-code${NC}"
fi

echo ""
echo "진단 완료"
echo ""
