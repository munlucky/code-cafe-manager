#!/bin/bash
# Claude CLI 진단 스크립트 (Linux)
# 용도: Linux 환경에서 Claude CLI 설치 상태 및 실행 가능성 진단

set -e

echo ""
echo "========================================"
echo "  Claude CLI 진단 (Linux)"
echo "========================================"
echo ""

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# 1. OS 및 배포판 정보
echo -e "${CYAN}[1/7]${NC} 시스템 정보 확인..."
if [ -f /etc/os-release ]; then
    . /etc/os-release
    echo -e "  ${GRAY}• OS:${NC} $PRETTY_NAME"
else
    echo -e "  ${GRAY}• OS:${NC} Unknown Linux"
fi

# 2. PATH에서 Claude CLI 검색
echo ""
echo -e "${CYAN}[2/7]${NC} Claude CLI PATH 검색 중..."
if command -v claude &> /dev/null; then
    CLAUDE_PATH=$(which claude)
    echo -e "  ${GREEN}✓ 발견:${NC} $CLAUDE_PATH"
else
    echo -e "  ${RED}✗ Claude CLI를 PATH에서 찾을 수 없습니다${NC}"
    echo -e "    ${GRAY}설치 방법: npm install -g @anthropic-ai/claude-code${NC}"
    exit 1
fi

# 3. 버전 확인
echo ""
echo -e "${CYAN}[3/7]${NC} 버전 확인 중..."
if VERSION=$(claude --version 2>&1); then
    echo -e "  ${GREEN}✓ 버전:${NC} $VERSION"
else
    echo -e "  ${RED}✗ 버전 확인 실패${NC}"
    echo -e "    ${GRAY}출력: $VERSION${NC}"
fi

# 4. 실행 권한 확인
echo ""
echo -e "${CYAN}[4/7]${NC} 실행 권한 확인 중..."
if [ -x "$CLAUDE_PATH" ]; then
    echo -e "  ${GREEN}✓ 실행 권한 있음${NC}"
else
    echo -e "  ${RED}✗ 실행 권한 없음${NC}"
    echo -e "    ${GRAY}수정: chmod +x $CLAUDE_PATH${NC}"
    echo -e "    ${GRAY}또는: sudo chmod +x $CLAUDE_PATH${NC}"
fi

# 5. bash login shell에서 PATH 확인
echo ""
echo -e "${CYAN}[5/7]${NC} bash login shell 환경 확인..."
BASH_LOGIN_PATH=$(/bin/bash -lc 'which claude' 2>/dev/null || echo "NOT_FOUND")
if [ "$BASH_LOGIN_PATH" != "NOT_FOUND" ]; then
    echo -e "  ${GREEN}✓ bash login PATH에서 Claude 발견:${NC} $BASH_LOGIN_PATH"
else
    echo -e "  ${YELLOW}! bash login PATH에서 Claude를 찾을 수 없음${NC}"
    echo -e "    ${GRAY}전체 PATH 확인:${NC}"
    /bin/bash -lc 'echo "      PATH=$PATH"' | head -c 200
    echo ""
fi

# 6. node-pty와의 호환성 확인
echo ""
echo -e "${CYAN}[6/7]${NC} node-pty 호환성 확인..."
# 개행 문자 처리 확인
echo -e "  ${GRAY}• 개행 문자 테스트:\${NC}"
printf "test\r\n" | od -An -tx1 | head -1 > /dev/null
if [ $? -eq 0 ]; then
    echo -e "    ${GREEN}✓ CRLF 처리 가능${NC}"
fi

# 7. CLAUDE_CODE_PATH 환경변수 확인
echo ""
echo -e "${CYAN}[7/7]${NC} CLAUDE_CODE_PATH 환경변수 확인..."
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

# 인터랙티브 모드 테스트 가이드
echo ""
echo -e "${CYAN}인터랙티브 모드 테스트${NC}"
echo -e "  ${GRAY}수동 테스트를 위해 아래 명령어를 실행하세요:${NC}"
echo -e "    claude"
echo -e "  ${GRAY}정상 동작 시 프롬프트(>, ›, », ❯)가 표시되어야 합니다${NC}"
echo -e "  ${GRAY}종료하려면: Ctrl+C 또는 exit 입력${NC}"

# 진단 요약
echo ""
echo "========================================"
echo "  진단 요약"
echo "========================================"

if command -v claude &> /dev/null; then
    echo -e "  ${GREEN}상태: ✓ 정상${NC}"
    echo -e "  ${NC}경로: $CLAUDE_PATH${NC}"
    echo ""
    echo -e "  ${YELLOW}다음 단계:${NC}"
    echo -e "    1. CodeCafe 앱 실행${NC}"
    echo -e "    2. Order 생성 및 실행${NC}"
    echo -e "    3. 초기화 로그 확인 (waitForPrompt 감지)${NC}"
    echo -e "    4. 개행 문자(\r) 처리 확인 필요 시 테스트${NC}"
else
    echo -e "  ${RED}상태: ✗ 설치 필요${NC}"
    echo ""
    echo -e "  ${YELLOW}설치 방법:${NC}"
    echo -e "    npm: npm install -g @anthropic-ai/claude-code${NC}"
    echo -e "    bun: bun add -g @anthropic-ai/claude-code${NC}"
    echo -e "    ${GRAY}또는: sudo npm install -g @anthropic-ai/claude-code${NC}"
fi

echo ""
echo "진단 완료"
echo ""
