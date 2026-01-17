/**
 * Order IPC Handlers
 * 오더 생성 + 워크트리 자동 생성 통합
 */

import { ipcMain } from 'electron';
import { join } from 'path';
import { Orchestrator } from '@codecafe/core';
import { WorktreeManager } from '@codecafe/git-worktree';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { promises as fs } from 'fs';

/**
 * ANSI escape 코드를 HTML로 변환
 * 터미널 출력의 색상/스타일을 유지하고 제어 시퀀스는 제거
 */
function convertAnsiToHtml(text: string): string {
  // 1. 먼저 모든 ANSI CSI 시퀀스를 처리 (ESC [ ... final_byte)
  // final byte는 0x40-0x7E (@-~) 범위
  // 색상 코드(m으로 끝남)만 유지하고 나머지 제어 코드는 제거
  const allCsiRegex = /\x1b\[[0-9;?]*[@-~]/g;
  let cleanedText = text.replace(allCsiRegex, (match) => {
    // 색상 코드 (m으로 끝남)는 유지
    if (match.endsWith('m')) {
      return match;
    }
    // 나머지 제어 코드 (H, J, K, X, C, A, B, D, h, l 등)는 제거
    return '';
  });

  // 2. 색상 코드를 HTML로 변환
  const ansiColorRegex = /\x1b\[([0-9;?]*)m/g;

  let result = '';
  let lastIndex = 0;
  let currentStyles: string[] = [];

  const styleMap: Record<string, string> = {
    '0': '',           // Reset
    '1': 'font-weight:bold',  // Bold
    '2': 'opacity:0.7',  // Dim
    '3': 'font-style:italic',  // Italic
    '4': 'text-decoration:underline',  // Underline
    '30': 'color:black',
    '31': 'color:#ef5350',  // Red
    '32': 'color:#a5d6a7',  // Green
    '33': 'color:#ffca28',  // Yellow
    '34': 'color:#42a5f5',  // Blue
    '35': 'color:#ab47bc',  // Magenta
    '36': 'color:#26c6da',  // Cyan
    '37': 'color:#ffffff',  // White
    '90': 'color:#616161',  // Bright Black (Dark Gray)
    '91': 'color:#ef5350',  // Bright Red
    '92': 'color:#a5d6a7',  // Bright Green
    '93': 'color:#ffca28',  // Bright Yellow
    '94': 'color:#42a5f5',  // Bright Blue
    '95': 'color:#ab47bc',  // Bright Magenta
    '96': 'color:#26c6da',  // Bright Cyan
    '97': 'color:#ffffff',  // Bright White
  };

  cleanedText.replace(ansiColorRegex, (match, codes, offset) => {
    result += cleanedText.slice(lastIndex, offset);

    const codeList = codes.split(';');
    for (const code of codeList) {
      if (code === '0') {
        while (currentStyles.length > 0) {
          result += '</span>';
          currentStyles.pop();
        }
      } else if (code.startsWith('38') || code.startsWith('48')) {
        continue;
      } else if (styleMap[code]) {
        const style = styleMap[code];
        if (style && !currentStyles.includes(style)) {
          result += `<span style="${style}">`;
          currentStyles.push(style);
        }
      }
    }

    lastIndex = offset + match.length;
    return '';
  });

  result += cleanedText.slice(lastIndex);

  while (currentStyles.length > 0) {
    result += '</span>';
    currentStyles.pop();
  }

  return result;
}

/**
 * Cafe Registry 타입 (간소화)
 */
interface Cafe {
  id: string;
  name: string;
  path: string;
  settings: {
    baseBranch: string;
    worktreeRoot: string;
  };
}

/**
 * 로그 청크 타입
 */
interface LogChunk {
  timestamp: string;
  message: string;
}

/**
 * 로그 파일 내용을 타임스탬프 기준으로 청크 분리
 * 여러 줄 메시지를 올바르게 처리
 *
 * 형식: [YYYY-MM-DDTHH:mm:ss.sssZ] message (여러 줄 가능)
 */
function parseLogChunks(content: string): LogChunk[] {
  const chunks: LogChunk[] = [];
  // ISO 타임스탬프 패턴: [2026-01-17T10:30:45.123Z]
  const timestampPattern = /^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]\s*/;

  const lines = content.split('\n');
  let currentChunk: LogChunk | null = null;

  for (const line of lines) {
    const match = line.match(timestampPattern);

    if (match) {
      // 이전 청크 저장
      if (currentChunk) {
        chunks.push(currentChunk);
      }

      // 새 청크 시작
      currentChunk = {
        timestamp: match[1],
        message: line.slice(match[0].length),
      };
    } else if (currentChunk) {
      // 여러 줄 메시지: 현재 청크에 추가
      currentChunk.message += '\n' + line;
    } else if (line.trim()) {
      // 타임스탬프 없는 첫 줄 (비정상적인 경우)
      chunks.push({
        timestamp: new Date().toISOString(),
        message: line,
      });
    }
  }

  // 마지막 청크 저장
  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Cafe Registry 로드
 */
async function loadCafeRegistry(): Promise<Cafe[]> {
  const registryPath = join(homedir(), '.codecafe', 'cafes.json');
  if (!existsSync(registryPath)) {
    return [];
  }

  try {
    const content = await fs.readFile(registryPath, 'utf-8');
    const data = JSON.parse(content);
    return data.cafes || [];
  } catch (error) {
    console.error('[Order IPC] Failed to load cafe registry:', error);
    return [];
  }
}

/**
 * Cafe 조회
 */
async function getCafe(cafeId: string): Promise<Cafe | null> {
  const cafes = await loadCafeRegistry();
  return cafes.find((c) => c.id === cafeId) || null;
}

/**
 * 오더 생성 + 워크트리 자동 생성 요청 파라미터
 */
export interface CreateOrderWithWorktreeParams {
  cafeId: string;
  workflowId: string;
  workflowName: string;
  provider?: string; // Provider는 이제 workflow의 stageConfigs에서 결정됨 (선택적)
  vars?: Record<string, string>;
  createWorktree: boolean;
  worktreeOptions?: {
    baseBranch?: string;
    branchPrefix?: string;
  };
}

/**
 * 오더 생성 + 워크트리 자동 생성 결과
 */
export interface CreateOrderWithWorktreeResult {
  order: any; // Order 타입 (Orchestrator에서 반환)
  worktree?: {
    path: string;
    branch: string;
  };
}

/**
 * IPC Response 타입
 */
interface IpcResponse<T = void> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Standardized IPC handler wrapper
 */
async function handleIpc<T>(
  handler: () => Promise<T>,
  context: string
): Promise<IpcResponse<T>> {
  try {
    const data = await handler();
    return {
      success: true,
      data,
    };
  } catch (error: any) {
    console.error(`[IPC] Error in ${context}:`, error);

    return {
      success: false,
      error: {
        code: error.code || 'UNKNOWN',
        message: error.message || 'Unknown error',
        details: error.details,
      },
    };
  }
}

/**
 * Order Manager (Interval 관리)
 */
class OrderManager {
  private static outputIntervals = new Map<string, NodeJS.Timeout>();
  // Track which orders have already received history (prevent duplicate on Strict Mode remount)
  private static historySent = new Set<string>();

  /**
   * Register Order IPC Handlers
   */
  static registerHandlers(orchestrator: Orchestrator): void {
  /**
   * 오더 생성 + 워크트리 자동 생성
   */
  ipcMain.handle(
    'order:createWithWorktree',
    async (_, params: CreateOrderWithWorktreeParams) =>
      handleIpc(async () => {
        const cafe = await getCafe(params.cafeId);
        if (!cafe) {
          throw new Error(`Cafe not found: ${params.cafeId}`);
        }

        // 1. 오더 생성
        const order = await orchestrator.createOrder(
          params.workflowId,
          params.workflowName,
          cafe.path, // counter: 카페 경로
          params.provider as any,
          params.vars ? { ...params.vars, PROJECT_ROOT: cafe.path } : { PROJECT_ROOT: cafe.path }
        );

        let worktreeInfo = null;

        // 2. 워크트리 생성 (선택적)
        if (params.createWorktree) {
          try {
            const baseBranch = params.worktreeOptions?.baseBranch || cafe.settings.baseBranch;
            const branchPrefix = params.worktreeOptions?.branchPrefix || 'order';
            const branchName = `${branchPrefix}-${order.id}`;

            // worktreeRoot가 상대 경로인 경우 절대 경로로 변환
            const worktreeRoot = cafe.settings.worktreeRoot.startsWith('/')
              ? cafe.settings.worktreeRoot
              : join(cafe.path, cafe.settings.worktreeRoot);

            const worktreePath = join(worktreeRoot, branchName);

            await WorktreeManager.createWorktree({
              repoPath: cafe.path,
              baseBranch,
              newBranch: branchName,
              worktreePath,
            });

            worktreeInfo = { path: worktreePath, branch: branchName };

            console.log('[Order IPC] Worktree created:', worktreeInfo);
          } catch (wtError: any) {
            console.error('[Order IPC] Failed to create worktree:', wtError);
            // 워크트리 생성 실패해도 오더는 유지
          }
        }

        const result: CreateOrderWithWorktreeResult = {
          order,
          worktree: worktreeInfo || undefined,
        };

        return result;
      }, 'order:createWithWorktree')
  );

    /**
     * 오더 생성 (단순)
     */
    ipcMain.handle(
      'order:create',
      async (_, params: { workflowId: string; workflowName: string; counter: string; provider?: string; vars?: Record<string, string> }) =>
        handleIpc(async () => {
          // counter is the cafe path directly
          const order = orchestrator.createOrder(
            params.workflowId,
            params.workflowName,
            params.counter, // Use counter as cafe path
            params.provider as any,
            params.vars ? { ...params.vars, PROJECT_ROOT: params.counter } : { PROJECT_ROOT: params.counter }
          );

          return order;
        }, 'order:create')
    );

    /**
     * 단일 오더 조회
     */
    ipcMain.handle('order:get', async (_, orderId: string) =>
      handleIpc(async () => {
        return orchestrator.getOrder(orderId);
      }, 'order:get')
    );

    /**
     * 모든 오더 조회
     */
    ipcMain.handle('order:getAll', async () =>
      handleIpc(async () => {
        return orchestrator.getAllOrders();
      }, 'order:getAll')
    );

    /**
     * 오더 취소
     */
    ipcMain.handle('order:cancel', async (_, orderId: string) =>
      handleIpc(async () => {
        await orchestrator.cancelOrder(orderId);
        return { cancelled: true };
      }, 'order:cancel')
    );

    /**
     * 오더 삭제 (단일)
     */
    ipcMain.handle('order:delete', async (_, orderId: string) =>
      handleIpc(async () => {
        const deleted = await orchestrator.deleteOrder(orderId);
        return { deleted };
      }, 'order:delete')
    );

    /**
     * 오더 삭제 (다중)
     */
    ipcMain.handle('order:deleteMany', async (_, orderIds: string[]) =>
      handleIpc(async () => {
        return await orchestrator.deleteOrders(orderIds);
      }, 'order:deleteMany')
    );

    /**
     * 오더 실행
     */
    ipcMain.handle(
      'order:execute',
      async (_, orderId: string, prompt: string, vars?: Record<string, string>) =>
        handleIpc(async () => {
          console.log('[Order IPC] Executing order:', orderId);
          console.log('[Order IPC] Prompt:', prompt);
          console.log('[Order IPC] Vars:', vars);

          await orchestrator.executeOrder(orderId, prompt, vars || {});
          return { started: true };
        }, 'order:execute')
    );

    /**
     * 오더에 사용자 입력 전달
     */
    ipcMain.handle(
      'order:sendInput',
      async (_, orderId: string, message: string) =>
        handleIpc(async () => {
          console.log('[Order IPC] Sending input to order:', orderId);
          console.log('[Order IPC] Message:', message);

          await orchestrator.sendInput(orderId, message);
          return { sent: true };
        }, 'order:sendInput')
    );

    /**
     * 오더 로그 조회
     */
    ipcMain.handle('order:getLog', async (_, orderId: string) =>
      handleIpc(async () => {
        return orchestrator.getOrderLog(orderId);
      }, 'order:getLog')
    );

    /**
     * 모든 영수증 조회
     */
    ipcMain.handle('receipt:getAll', async () =>
      handleIpc(async () => {
        return orchestrator.getReceipts();
      }, 'receipt:getAll')
    );

    /**
     * 오더 터미널 출력 구독
     * - 기존 로그는 파일에서 한 번 읽어서 전송 (히스토리)
     * - 실시간 출력은 ExecutionManager에서 order:output 이벤트로 전송
     * - 폴링 제거하여 로그 중복 방지
     */
  ipcMain.handle('order:subscribeOutput', async (event, orderId: string) =>
    handleIpc(async () => {
      // LogManager와 동일한 경로 사용: ~/.codecafe/logs/${orderId}.log
      const logsDir = join(homedir(), '.codecafe', 'logs');
      const logPath = join(logsDir, `${orderId}.log`);

      console.log('[Order IPC] Subscribe to order output:', orderId);
      console.log('[Order IPC] Log path:', logPath);

      // 기존 interval 정리 (중복 구독 방지)
      const intervalKey = `order:output:${orderId}`;
      const existingInterval = OrderManager.outputIntervals.get(intervalKey);
      if (existingInterval) {
        clearInterval(existingInterval);
        OrderManager.outputIntervals.delete(intervalKey);
      }

      // 기존 로그 파일이 있으면 히스토리로 한 번 전송 (중복 방지)
      const historyKey = `history:${orderId}`;
      if (existsSync(logPath) && !OrderManager.historySent.has(historyKey)) {
        OrderManager.historySent.add(historyKey);
        try {
          const content = await fs.readFile(logPath, 'utf-8');
          if (content.trim()) {
            // 타임스탬프 패턴으로 로그 청크 분리 (여러 줄 메시지 지원)
            const chunks = parseLogChunks(content);

            for (const chunk of chunks) {
              event.sender.send('order:output', {
                orderId,
                timestamp: chunk.timestamp,
                type: 'stdout',
                content: convertAnsiToHtml(chunk.message),  // ANSI를 HTML로 변환
              });
            }

            console.log(`[Order IPC] Sent ${chunks.length} history entries for order: ${orderId}`);
          }
        } catch (error) {
          console.error('[Order IPC] Failed to read history log file:', error);
        }
      }

      // 실시간 출력은 ExecutionManager에서 order:output 이벤트로 직접 전송됨
      // 폴링 없이 구독 완료 반환
      return { subscribed: true };
    }, 'order:subscribeOutput')
  );

    /**
     * 오더 터미널 출력 구독 해제
     */
    ipcMain.handle('order:unsubscribeOutput', async (_, orderId: string) =>
      handleIpc(async () => {
        const intervalKey = `order:output:${orderId}`;
        const interval = OrderManager.outputIntervals.get(intervalKey);

        if (interval) {
          clearInterval(interval);
          OrderManager.outputIntervals.delete(intervalKey);
          console.log('[Order IPC] Unsubscribed from order output:', orderId);
        }

        return { unsubscribed: true };
      }, 'order:unsubscribeOutput')
    );

    console.log('[IPC] Order handlers registered');
  }

  /**
   * 모든 interval 정리 (앱 종료 시 호출)
   */
  static cleanup(): void {
    console.log('[OrderManager] Cleaning up intervals...');

    for (const [key, interval] of OrderManager.outputIntervals) {
      clearInterval(interval);
      console.log('[OrderManager] Cleared interval:', key);
    }

    OrderManager.outputIntervals.clear();
    console.log('[OrderManager] All intervals cleared');
  }
}

/**
 * Export handlers
 */
export const registerOrderHandlers = OrderManager.registerHandlers.bind(OrderManager);
export const cleanupOrderHandlers = OrderManager.cleanup.bind(OrderManager);
