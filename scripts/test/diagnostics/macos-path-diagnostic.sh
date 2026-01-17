#!/bin/bash
# macOS PATH 진단 스크립트
# 용도: zsh와 bash login shell 간 PATH 차이 분석
# 중요: CodeCafe 앱은 node-pty로 bash를 띄우므로 bash login PATH를 확인해야 함

set -e

echo ""
echo "========================================"
echo "  macOS PATH 진단 (zsh vs bash)"
echo "========================================"
echo ""

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. 현재 셸 확인
echo -e "${CYAN}[1/5]${NC} 현재 셸 환경..."
CURRENT_SHELL=$(echo $SHELL)
echo -e "  ${GRAY}• 현재 셸:${NC} $CURRENT_SHELL"
echo -e "  ${GRAY}• 사용자 기본 셸:${NC} $(dscl . -read /Users/$(whoami) UserShell | cut -d' ' -f2)"

# 2. zsh 환경 분석
echo ""
echo -e "${CYAN}[2/5]${NC} zsh 환경 분석..."

# zsh에서의 PATH (login shell)
echo -e "  ${BLUE}> zsh login shell PATH:${NC}"
ZSH_PATH=$(zsh -lc 'echo $PATH' 2>/dev/null || echo "ERROR")
if [ "$ZSH_PATH" != "ERROR" ]; then
    echo "$ZSH_PATH" | tr ':' '\n' | nl -w2 -s'. ' | sed 's/^/    /'

    # zsh에서의 Claude 위치
    echo ""
    echo -e "  ${GRAY}• zsh에서 Claude 위치:${NC}"
    ZSH_CLAUDE=$(zsh -lc 'which claude' 2>/dev/null || echo "NOT_FOUND")
    if [ "$ZSH_CLAUDE" != "NOT_FOUND" ]; then
        echo -e "    ${GREEN}✓ $ZSH_CLAUDE${NC}"
    else
        echo -e "    ${RED}✗ 찾을 수 없음${NC}"
    fi
else
    echo -e "    ${RED}zsh 실행 실패${NC}"
fi

# 3. bash login shell 환경 분석
echo ""
echo -e "${CYAN}[3/5]${NC} bash login shell 환경 분석..."
echo -e "  ${BLUE}> bash login shell PATH:${NC}"

# node-pty는 bash를 실행하므로 bash login 환경이 중요함
BASH_PATH=$(bash -lc 'echo $PATH' 2>/dev/null || echo "ERROR")
if [ "$BASH_PATH" != "ERROR" ]; then
    echo "$BASH_PATH" | tr ':' '\n' | nl -w2 -s'. ' | sed 's/^/    /'

    # bash에서의 Claude 위치
    echo ""
    echo -e "  ${GRAY}• bash login에서 Claude 위치:${NC}"
    BASH_CLAUDE=$(bash -lc 'which claude' 2>/dev/null || echo "NOT_FOUND")
    if [ "$BASH_CLAUDE" != "NOT_FOUND" ]; then
        echo -e "    ${GREEN}✓ $BASH_CLAUDE${NC}"
    else
        echo -e "    ${RED}✗ 찾을 수 없음${NC}"
    fi
else
    echo -e "    ${RED}bash 실행 실패${NC}"
fi

# 4. 차이점 분석
echo ""
echo -e "${CYAN}[4/5]${NC} zsh vs bash PATH 차이점 분석..."

if [ "$ZSH_PATH" != "ERROR" ] && [ "$BASH_PATH" != "ERROR" ]; then
    # PATH를 배열로 변환하여 비교
    IFS=':' read -ra ZSH_DIRS <<< "$ZSH_PATH"
    IFS=':' read -ra BASH_DIRS <<< "$BASH_PATH"

    # zsh에만 있는 디렉토리
    echo -e "  ${GRAY}• zsh에만 있는 PATH:${NC}"
    ZSH_ONLY=()
    for dir in "${ZSH_DIRS[@]}"; do
        if [[ ! ":$BASH_PATH:" == *":$dir:"* ]]; then
            echo -e "    ${YELLOW}+$dir${NC}"
            ZSH_ONLY+=("$dir")
        fi
    done

    if [ ${#ZSH_ONLY[@]} -eq 0 ]; then
        echo -e "    ${GREEN}없음 (일반적인 경우)${NC}"
    fi

    # bash에만 있는 디렉토리
    echo ""
    echo -e "  ${GRAY}• bash에만 있는 PATH:${NC}"
    BASH_ONLY=()
    for dir in "${BASH_DIRS[@]}"; do
        if [[ ! ":$ZSH_PATH:" == *":$dir:"* ]]; then
            echo -e "    ${YELLOW}+$dir${NC}"
            BASH_ONLY+=("$dir")
        fi
    done

    if [ ${#BASH_ONLY[@]} -eq 0 ]; then
        echo -e "    ${GREEN}없음 (일반적인 경우)${NC}"
    fi

    # Claude CLI 경로 차이
    echo ""
    echo -e "  ${GRAY}• Claude CLI 경로:${NC}"
    if [ "$ZSH_CLAUDE" != "NOT_FOUND" ] && [ "$BASH_CLAUDE" != "NOT_FOUND" ]; then
        if [ "$ZSH_CLAUDE" == "$BASH_CLAUDE" ]; then
            echo -e "    ${GREEN}✓ zsh와 bash가 동일한 경로 사용${NC}"
            echo -e "      $ZSH_CLAUDE"
        else
            echo -e "    ${RED}✗ zsh와 bash가 다른 경로 사용${NC}"
            echo -e "      zsh:  $ZSH_CLAUDE"
            echo -e "      bash: $BASH_CLAUDE"
        fi
    elif [ "$ZSH_CLAUDE" == "NOT_FOUND" ] && [ "$BASH_CLAUDE" == "NOT_FOUND" ]; then
        echo -e "    ${RED}✗ 두 환경 모두에서 Claude를 찾을 수 없음${NC}"
    elif [ "$ZSH_CLAUDE" == "NOT_FOUND" ]; then
        echo -e "    ${YELLOW}! zsh에서만 Claude를 찾을 수 없음${NC}"
    else
        echo -e "    ${YELLOW}! bash에서만 Claude를 찾을 수 없음 (앱 실행 실패 원인)${NC}"
    fi
else
    echo -e "    ${RED}PATH 비교 불가 (쉘 실행 실패)${NC}"
fi

# 5. 해결 방안 가이드
echo ""
echo -e "${CYAN}[5/5]${NC} 해결 방안 가이드..."

if [ "$BASH_CLAUDE" == "NOT_FOUND" ]; then
    echo ""
    echo -e "  ${RED}❌ 문제: bash login shell에서 Claude를 찾을 수 없음${NC}"
    echo ""
    echo -e "  ${YELLOW}해결 방법:${NC}"
    echo -e "  1. ${GREEN}CLAUDE_CODE_PATH 환경변수 사용 (권장)${NC}"
    echo -e "     앱 설정에서 Claude CLI 경로를 직접 지정"
    echo ""
    echo -e "  2. bash 프로필에 PATH 추가"
    echo -e "     ~/.bash_profile 또는 ~/.bashrc에 다음 추가:"
    echo -e "     ${GRAY}export PATH=\"\$PATH:$(dirname "$ZSH_CLAUDE" 2>/dev/null || echo '/path/to/claude')\"${NC}"
    echo ""
    echo -e "  3. zsh와 동일한 경로에 심볼릭 링크 생성"
    echo -e "     ${GRAY}sudo ln -s '$ZSH_CLAUDE' /usr/local/bin/claude${NC}"
elif [ "$ZSH_CLAUDE" != "$BASH_CLAUDE" ]; then
    echo ""
    echo -e "  ${YELLOW}⚠️  주의: zsh와 bash가 다른 Claude CLI 사용${NC}"
    echo -e "  앱은 bash를 사용하므로 bash 버전이 실행됩니다"
    echo ""
    echo -e "  ${YELLOW}권장 사항:${NC}"
    echo -e "  • CLAUDE_CODE_PATH로 명시적으로 경로 지정"
    echo -e "  • 또는 bash 프로필에서 PATH 조정"
else
    echo ""
    echo -e "  ${GREEN}✓ PATH 환경 정상 (zsh와 bash가 동일)${NC}"
    echo -e "  앱에서 정상적으로 Claude CLI를 실행할 수 있습니다"
fi

# 6. 테스트 명령어 가이드
echo ""
echo "========================================"
echo "  테스트 명령어"
echo "========================================"
echo ""
echo "zsh에서 Claude 테스트:"
echo "  zsh -lc 'claude --version'"
echo ""
echo "bash에서 Claude 테스트 (앱과 동일 환경):"
echo "  bash -lc 'claude --version'"
echo ""
echo "인터랙티브 모드 테스트 (bash):"
echo "  bash -lc 'claude'"
echo ""
echo "진단 완료"
echo ""
