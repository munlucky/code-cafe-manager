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
     * 오더 터미널 출력 구독 (로그 파일 폴링 방식)
     */
  ipcMain.handle('order:subscribeOutput', async (event, orderId: string) =>
    handleIpc(async () => {
      const orchDir = join(process.cwd(), '.orch');
      const logPath = join(orchDir, 'orders', orderId, 'logs.jsonl');

      console.log('[Order IPC] Subscribe to order output:', orderId);
      console.log('[Order IPC] Log path:', logPath);

      // 로그 파일 존재 확인
      if (!existsSync(logPath)) {
        console.warn('[Order IPC] Log file not found (will retry):', logPath);
      }

      let lastPosition = 0;

      // 3초마다 로그 파일 읽기
      const interval = setInterval(async () => {
        try {
          if (!existsSync(logPath)) {
            return;
          }

          const content = await fs.readFile(logPath, 'utf-8');
          const newContent = content.slice(lastPosition);

          if (newContent.length > 0) {
            lastPosition = content.length;

            // JSONL 파싱 (각 줄이 JSON 객체)
            const lines = newContent.trim().split('\n').filter(Boolean);

            for (const line of lines) {
              try {
                const logEntry = JSON.parse(line);
                event.sender.send('order:output', {
                  orderId,
                  timestamp: logEntry.timestamp || new Date().toISOString(),
                  type: logEntry.level || 'stdout',
                  content: logEntry.message || line,
                });
              } catch (parseError) {
                // JSONL 파싱 실패 시 원본 텍스트 전송
                event.sender.send('order:output', {
                  orderId,
                  timestamp: new Date().toISOString(),
                  type: 'stdout',
                  content: line,
                });
              }
            }
          }
        } catch (error) {
          console.error('[Order IPC] Failed to read log file:', error);
        }
      }, 3000);

      // 구독 해제를 위해 interval ID 저장
      const intervalKey = `order:output:${orderId}`;

      // 기존 interval 정리
      const existingInterval = OrderManager.outputIntervals.get(intervalKey);
      if (existingInterval) {
        clearInterval(existingInterval);
      }

      OrderManager.outputIntervals.set(intervalKey, interval);

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
