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
import { getExecutionManager } from '../execution-manager.js';
import { convertAnsiToHtml } from '../../common/output-utils.js';
import { parseOutputType } from '../../common/output-markers.js';

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
 * Worktree 생성 결과 타입
 */
interface WorktreeCreationResult {
  path: string;
  branch: string;
  baseBranch: string;
}

/**
 * Worktree 생성 및 Order 업데이트 헬퍼
 * 공통 로직을 추출하여 중복 제거
 */
async function createWorktreeAndUpdateOrder(
  order: any,
  cafe: Cafe,
  worktreeOptions?: { baseBranch?: string; branchPrefix?: string }
): Promise<WorktreeCreationResult> {
  const baseBranch = worktreeOptions?.baseBranch || cafe.settings.baseBranch;
  const branchPrefix = worktreeOptions?.branchPrefix || 'order';
  const branchName = `${branchPrefix}-${order.id}`;

  // worktreeRoot가 상대 경로인 경우 절대 경로로 변환
  const worktreeRoot = cafe.settings.worktreeRoot.startsWith('/')
    ? cafe.settings.worktreeRoot
    : join(cafe.path, cafe.settings.worktreeRoot);

  const worktreePath = join(worktreeRoot, branchName);

  console.log('[Order IPC] Creating worktree:', { orderId: order.id, worktreePath, baseBranch });

  await WorktreeManager.createWorktree({
    repoPath: cafe.path,
    baseBranch,
    newBranch: branchName,
    worktreePath,
  });

  // Order 객체 업데이트 (AI agent가 worktree 경로에서 실행되도록)
  order.worktreeInfo = {
    path: worktreePath,
    branch: branchName,
    baseBranch,
    repoPath: cafe.path,  // 원본 카페 경로 저장 (worktree 삭제 시 사용)
  };
  order.vars = { ...order.vars, PROJECT_ROOT: worktreePath };
  // order.counter는 원래 카페 경로 유지 (worktree 삭제 시 repoPath로 사용)

  console.log('[Order IPC] Worktree created and order updated:', worktreePath);

  return { path: worktreePath, branch: branchName, baseBranch };
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
 * Get BaristaEngine from ExecutionManager
 * Helper function to reduce duplication in retry-related handlers
 */
function getBaristaEngine() {
  const executionManager = getExecutionManager();
  if (!executionManager) {
    throw new Error('ExecutionManager not initialized');
  }

  const baristaEngine = executionManager.getBaristaEngine();
  if (!baristaEngine) {
    throw new Error('BaristaEngine not initialized');
  }

  return baristaEngine;
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
          params.vars ? { ...params.vars, PROJECT_ROOT: cafe.path } : { PROJECT_ROOT: cafe.path },
          params.cafeId // cafeId 설정 (세션 복원 시 사용)
        );

        let worktreeInfo: { path: string; branch: string } | undefined;

        // 2. 워크트리 생성 (선택적)
        if (params.createWorktree) {
          try {
            const result = await createWorktreeAndUpdateOrder(order, cafe, params.worktreeOptions);
            worktreeInfo = { path: result.path, branch: result.branch };
          } catch (wtError: any) {
            console.error('[Order IPC] Failed to create worktree:', wtError);

            // Worktree 생성 실패 시 order 롤백 (먼저 취소 후 삭제)
            try {
              await orchestrator.cancelOrder(order.id);
              await orchestrator.deleteOrder(order.id);
              console.log('[Order IPC] Order rolled back due to worktree failure:', order.id);
            } catch (deleteError: any) {
              console.error(`[Order IPC] Failed to rollback order ${order.id}:`, deleteError);
            }

            // handleIpc에서 일관된 에러 응답을 생성하도록 에러를 던짐
            const error = new Error(`Failed to create worktree: ${wtError.message || 'Unknown error'}`);
            (error as any).code = 'WORKTREE_CREATION_FAILED';
            throw error;
          }
        }

        return { order, worktree: worktreeInfo };
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
     * worktree가 있으면 함께 정리
     */
    ipcMain.handle('order:delete', async (_, orderId: string) =>
      handleIpc(async () => {
        // Order 조회 (삭제 전에 worktree 정보 확인)
        const order = orchestrator.getOrder(orderId);

        // Worktree 정리 (있는 경우)
        if (order?.worktreeInfo?.path && existsSync(order.worktreeInfo.path)) {
          console.log('[Order IPC] Cleaning up worktree for order:', orderId);
          
          try {
            // 1. 먼저 실행 중인 프로세스 강제 종료 (파일 잠금 해제)
            await orchestrator.cancelOrder(orderId).catch(() => {});
            
            // 2. 프로세스가 완전히 종료되고 파일 잠금이 풀리도록 잠시 대기
            await new Promise(resolve => setTimeout(resolve, 500));

            // 3. Worktree 삭제
            await WorktreeManager.removeWorktree({
              worktreePath: order.worktreeInfo.path,
              repoPath: order.worktreeInfo?.repoPath || order.counter, // 원본 카페 경로 사용
              force: true, // 미커밋 변경사항도 강제 삭제
            });
            console.log('[Order IPC] Worktree removed:', order.worktreeInfo.path);
          } catch (wtError: any) {
            console.error('[Order IPC] Failed to remove worktree:', wtError);
            // worktree 삭제 실패해도 order 삭제는 진행
          }
        }

        const deleted = await orchestrator.deleteOrder(orderId);
        return { deleted };
      }, 'order:delete')
    );

    /**
     * 오더 삭제 (다중)
     * worktree가 있으면 함께 정리
     */
    ipcMain.handle('order:deleteMany', async (_, orderIds: string[]) =>
      handleIpc(async () => {
        // 각 order의 worktree 정리
        for (const orderId of orderIds) {
          const order = orchestrator.getOrder(orderId);
          if (order?.worktreeInfo?.path && existsSync(order.worktreeInfo.path)) {
            try {
              // 1. 실행 중인 프로세스 강제 종료
              await orchestrator.cancelOrder(orderId).catch(() => {});
              
              // 2. 잠시 대기
              await new Promise(resolve => setTimeout(resolve, 500));

              // 3. Worktree 삭제
              await WorktreeManager.removeWorktree({
                worktreePath: order.worktreeInfo.path,
                repoPath: order.worktreeInfo?.repoPath || order.counter, // 원본 카페 경로 사용
                force: true,
              });
              console.log('[Order IPC] Worktree removed:', order.worktreeInfo.path);
            } catch (wtError: any) {
              console.error('[Order IPC] Failed to remove worktree:', wtError);
            }
          }
        }

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
  ipcMain.handle('order:subscribeOutput', async (_event, orderId: string) =>
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

      // 기존 로그 파일이 있으면 히스토리로 반환
      const history: Array<{ orderId: string; timestamp: string; type: string; content: string }> = [];
      if (existsSync(logPath)) {
        try {
          const content = await fs.readFile(logPath, 'utf-8');
          if (content.trim()) {
            // 타임스탬프 패턴으로 로그 청크 분리 (여러 줄 메시지 지원)
            const chunks = parseLogChunks(content);

            for (const chunk of chunks) {
              // Parse output type from markers (uses parseOutputType helper)
              const parsed = parseOutputType(chunk.message);

              // Map user_prompt to user-input for frontend display
              const outputType = parsed.type === 'user_prompt' ? 'user-input' : parsed.type;

              // SECURITY: convertAnsiToHtml properly escapes HTML to prevent XSS
              history.push({
                orderId,
                timestamp: chunk.timestamp,
                type: outputType,
                content: convertAnsiToHtml(parsed.content),
              });
            }

            console.log(`[Order IPC] Prepared ${chunks.length} history entries for order: ${orderId}`);
          }
        } catch (error) {
          console.error('[Order IPC] Failed to read history log file:', error);
        }
      }

      // 실시간 출력은 ExecutionManager에서 order:output 이벤트로 직접 전송됨
      // 폴링 없이 구독 완료 반환 (히스토리 포함)
      return { subscribed: true, history };
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

    /**
     * Worktree 재생성 시도
     * 기존 order에 대해 worktree 생성을 다시 시도
     */
    ipcMain.handle(
      'order:retryWorktree',
      async (_, params: { orderId: string; cafeId: string; worktreeOptions?: { baseBranch?: string; branchPrefix?: string } }) =>
        handleIpc(async () => {
          const { orderId, cafeId, worktreeOptions } = params;

          // Order 조회
          const order = orchestrator.getOrder(orderId);
          if (!order) {
            throw new Error(`Order not found: ${orderId}`);
          }

          // Cafe 조회
          const cafe = await getCafe(cafeId);
          if (!cafe) {
            throw new Error(`Cafe not found: ${cafeId}`);
          }

          // 이미 worktree가 있는 경우
          if (order.worktreeInfo?.path && existsSync(order.worktreeInfo.path)) {
            console.log('[Order IPC] Worktree already exists:', order.worktreeInfo.path);
            return {
              worktree: {
                path: order.worktreeInfo.path,
                branch: order.worktreeInfo.branch,
              },
              message: 'Worktree already exists',
            };
          }

          // Worktree 생성 시도 (헬퍼 함수 사용)
          const result = await createWorktreeAndUpdateOrder(order, cafe, worktreeOptions);

          return {
            worktree: {
              path: result.path,
              branch: result.branch,
            },
            message: 'Worktree created successfully',
          };
        }, 'order:retryWorktree')
    );

    /**
     * Stage 재시도 (특정 stage부터 재실행)
     * 실패한 order를 특정 stage부터 재시도
     */
    ipcMain.handle(
      'order:retryFromStage',
      async (_, params: { orderId: string; fromStageId?: string }) =>
        handleIpc(async () => {
          const { orderId, fromStageId } = params;
          console.log('[Order IPC] Retrying order from stage:', { orderId, fromStageId });

          // Retry 전에 order 상태를 RUNNING으로 변경 (FAILED -> RUNNING)
          await orchestrator.startOrder(orderId);

          const baristaEngine = getBaristaEngine();
          await baristaEngine.retryFromStage(orderId, fromStageId);
          return { started: true };
        }, 'order:retryFromStage')
    );

    /**
     * 재시도 옵션 조회
     * 실패한 order의 재시도 가능한 stage 목록 반환
     */
    ipcMain.handle(
      'order:getRetryOptions',
      async (_, orderId: string) =>
        handleIpc(async () => {
          console.log('[Order IPC] Getting retry options for order:', orderId);

          try {
            const baristaEngine = getBaristaEngine();
            return baristaEngine.getRetryOptions(orderId);
          } catch {
            // ExecutionManager or BaristaEngine not initialized
            return null;
          }
        }, 'order:getRetryOptions')
    );

    /**
     * 처음부터 재시도 (이전 시도 컨텍스트 포함)
     */
    ipcMain.handle(
      'order:retryFromBeginning',
      async (_, params: { orderId: string; preserveContext?: boolean }) =>
        handleIpc(async () => {
          const { orderId, preserveContext = true } = params;
          console.log('[Order IPC] Retrying order from beginning:', { orderId, preserveContext });

          // Retry 전에 order 상태를 RUNNING으로 변경 (FAILED -> RUNNING)
          await orchestrator.startOrder(orderId);

          const baristaEngine = getBaristaEngine();
          await baristaEngine.retryFromBeginning(orderId, preserveContext);
          return { started: true };
        }, 'order:retryFromBeginning')
    );

    /**
     * Followup 모드 진입
     * completed 상태의 order에서 추가 명령을 받을 수 있도록 함
     */
    ipcMain.handle(
      'order:enterFollowup',
      async (_, orderId: string) =>
        handleIpc(async () => {
          console.log('[Order IPC] Entering followup mode for order:', orderId);

          const baristaEngine = getBaristaEngine();
          await baristaEngine.enterFollowup(orderId);
          return { success: true };
        }, 'order:enterFollowup')
    );

    /**
     * Followup 프롬프트 실행
     * completed/followup 상태에서 추가 명령 실행
     *
     * 앱 재시작 후 복원되지 않은 세션에 대해 자동 복원을 시도합니다.
     * worktree가 있는 완료된 order는 언제든지 followup이 가능해야 합니다.
     */
    ipcMain.handle(
      'order:executeFollowup',
      async (_, orderId: string, prompt: string) => {
        // Debug logging
        console.log('[Order IPC] executeFollowup called with orderId:', orderId, 'prompt:', prompt);

        const baristaEngine = getBaristaEngine();

        // 세션 복원 시도 (handleIpc 외부에서 먼저 실행)
        // 이렇게 하면 세션이 없어도 복원 후 정상 실행 가능
        const order = orchestrator.getOrder(orderId);
        if (!order) {
          return handleIpc(async () => {
            throw new Error(`Order not found: ${orderId}`);
          }, 'order:executeFollowup');
        }

        // 세션이 없고 worktree가 있는 완료된 order인 경우 복원 시도
        const sessionExists = baristaEngine.canFollowup(orderId);
        const isCompleted = order.status === 'COMPLETED';
        const hasWorktree = order.worktreeInfo?.path &&
          order.worktreeInfo.path.length > 0 &&
          !order.worktreeInfo.removed;

        if (!sessionExists && isCompleted && hasWorktree) {
          console.log('[Order IPC] Session not found, attempting to restore for followup');

          try {
            // Barista 획득 또는 생성
            let barista = orchestrator.getAllBaristas().find(b => b.provider === order.provider);
            if (!barista) {
              barista = orchestrator.createBarista(order.provider);
              console.log(`[Order IPC] Created barista with provider ${order.provider} for followup restore`);
            }

            // 세션 복원 (order.cafeId 사용, counter는 경로이므로 사용하지 않음)
            const cwd = order.worktreeInfo!.path;
            const cafeId = order.cafeId || order.counter; // cafeId가 없으면 counter를 fallback으로 사용
            await baristaEngine.restoreSessionForFollowup(order, barista, cafeId, cwd);
            console.log(`[Order IPC] Session restored for order ${orderId}`);
          } catch (restoreError: any) {
            console.error(`[Order IPC] Failed to restore session for order ${orderId}:`, restoreError);
            return handleIpc(async () => {
              throw new Error(`Failed to restore session: ${restoreError.message}`);
            }, 'order:executeFollowup');
          }
        }

        // executeFollowup 실행 (세션이 복원되었거나 이미 존재하는 경우)
        return handleIpc(async () => {
          await baristaEngine.executeFollowup(orderId, prompt);
          return { started: true };
        }, 'order:executeFollowup');
      }
    );

    /**
     * Followup 모드 종료
     */
    ipcMain.handle(
      'order:finishFollowup',
      async (_, orderId: string) =>
        handleIpc(async () => {
          console.log('[Order IPC] Finishing followup mode for order:', orderId);

          const baristaEngine = getBaristaEngine();
          await baristaEngine.finishFollowup(orderId);
          return { success: true };
        }, 'order:finishFollowup')
    );

    /**
     * Followup 가능 여부 확인
     */
    ipcMain.handle(
      'order:canFollowup',
      async (_, orderId: string) =>
        handleIpc(async () => {
          const baristaEngine = getBaristaEngine();
          return { canFollowup: baristaEngine.canFollowup(orderId) };
        }, 'order:canFollowup')
    );

    /**
     * Worktree만 삭제하고 order 작업 내역은 유지
     */
    ipcMain.handle(
      'order:cleanupWorktreeOnly',
      async (_, orderId: string) =>
        handleIpc(async () => {
          console.log('[Order IPC] Cleaning up worktree only for order:', orderId);

          const order = orchestrator.getOrder(orderId);
          if (!order) {
            throw new Error(`Order not found: ${orderId}`);
          }
          if (!order.worktreeInfo?.path) {
            throw new Error(`No worktree info for order: ${orderId}`);
          }

          const repoPath = order.worktreeInfo.repoPath || order.counter;

          // Worktree만 삭제 (브랜치/커밋 내역은 유지)
          await WorktreeManager.removeWorktreeOnly(
            order.worktreeInfo.path,
            repoPath
          );

          // Order의 worktreeInfo는 유지하되 path만 삭제됨을 표시
          const worktreeBranch = order.worktreeInfo.branch;
          order.worktreeInfo = {
            ...order.worktreeInfo,
            path: '', // 경로 비우기 (삭제됨 표시)
            removed: true,
          };

          // Order 상태 저장 (removed 플래그 유지)
          await orchestrator.persistState();

          console.log('[Order IPC] Worktree removed, order preserved. Branch:', worktreeBranch);

          return {
            success: true,
            branch: worktreeBranch,
            message: 'Worktree removed. Branch and commit history preserved.'
          };
        }, 'order:cleanupWorktreeOnly')
    );

    /**
     * Worktree를 main 브랜치에 병합
     */
    ipcMain.handle(
      'order:mergeWorktreeToMain',
      async (_, params: { orderId: string; targetBranch?: string; deleteAfterMerge?: boolean; squash?: boolean }) =>
        handleIpc(async () => {
          const { orderId, targetBranch = 'main', deleteAfterMerge = true, squash = false } = params;
          console.log('[Order IPC] Merging worktree to main for order:', orderId);

          const order = orchestrator.getOrder(orderId);
          if (!order) {
            throw new Error(`Order not found: ${orderId}`);
          }
          if (!order.worktreeInfo?.path) {
            throw new Error(`No worktree info for order: ${orderId}`);
          }

          const repoPath = order.worktreeInfo.repoPath || order.counter;

          const result = await WorktreeManager.mergeToTarget({
            worktreePath: order.worktreeInfo.path,
            repoPath,
            targetBranch,
            deleteAfterMerge,
            squash,
          });

          if (result.success && deleteAfterMerge) {
            // Worktree가 삭제되었으므로 order 업데이트
            order.worktreeInfo = {
              ...order.worktreeInfo,
              path: '',
              removed: true,
              merged: true,
              mergedTo: targetBranch,
              mergeCommit: result.commitHash,
            };

            // Order 상태 저장 (removed 플래그 유지)
            await orchestrator.persistState();
          }

          return result;
        }, 'order:mergeWorktreeToMain')
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
