/**
 * NodeExecutionManager - 노드 기반 실행 관리
 *
 * useScreenCapture=true 일 때 노드에서 Claude CLI를 실행하고
 * 화면 캡처를 통해 결과를 전달합니다.
 */

import { EventEmitter } from 'events';
import { createLogger } from '@codecafe/core';
import {
  ScreenCaptureData,
  NodeExecutionOptions,
  NodeExecutionResult,
  PollResult,
  PluginSessionStatus,
} from './types';
import { ScreenCaptureService, NodeRpcClient } from './screen-capture-service';

const logger = createLogger({ context: 'NodeExecutionManager' });

/**
 * 노드 프로세스 정보
 */
interface NodeProcess {
  nodeId: string;
  pid: number;
  command: string;
  cwd: string;
  startedAt: Date;
  lastOutput?: string;
  lastCaptureAt?: Date;
}

/**
 * 출력 버퍼 (폴링용)
 */
interface OutputBuffer {
  chunks: string[];
  lastReadIndex: number;
  updatedAt: Date;
}

/**
 * NodeExecutionManager - 노드 기반 실행 관리자
 */
export class NodeExecutionManager extends EventEmitter {
  private readonly screenCaptureService: ScreenCaptureService;
  private readonly processes = new Map<string, NodeProcess>(); // sessionId -> NodeProcess
  private readonly outputBuffers = new Map<string, OutputBuffer>(); // sessionId -> OutputBuffer

  constructor(options?: {
    screenCaptureService?: ScreenCaptureService;
    rpcClient?: NodeRpcClient;
  }) {
    super();
    this.screenCaptureService =
      options?.screenCaptureService ??
      new ScreenCaptureService({ rpcClient: options?.rpcClient });
  }

  /**
   * RPC 클라이언트 설정
   */
  setRpcClient(client: NodeRpcClient): void {
    this.screenCaptureService.setRpcClient(client);
  }

  /**
   * 노드 연결 상태 확인
   */
  async checkNodeConnection(nodeId: string): Promise<boolean> {
    return this.screenCaptureService.isNodeConnected(nodeId);
  }

  /**
   * 노드에서 Claude CLI 시작
   */
  async startSession(
    sessionId: string,
    options: NodeExecutionOptions
  ): Promise<NodeExecutionResult> {
    const { nodeId, command, workingDirectory, env, captureScreen = true } = options;

    // 노드 연결 확인
    const isConnected = await this.checkNodeConnection(nodeId);
    if (!isConnected) {
      return {
        success: false,
        error: `Node ${nodeId} is not connected. Please check node pairing.`,
      };
    }

    try {
      // Claude CLI 명령 구성
      const fullCommand = this.buildClaudeCommand(command, env);

      logger.debug(`Starting Claude CLI on node ${nodeId}`, {
        sessionId,
        command: fullCommand,
        cwd: workingDirectory,
      });

      // 노드에서 명령 실행
      const result = await this.screenCaptureService.runCommand(
        nodeId,
        fullCommand,
        workingDirectory
      );

      if (!result?.success) {
        return {
          success: false,
          error: 'Failed to start Claude CLI on node',
        };
      }

      // 프로세스 정보 저장
      const processInfo: NodeProcess = {
        nodeId,
        pid: result.pid,
        command: fullCommand,
        cwd: workingDirectory,
        startedAt: new Date(),
      };
      this.processes.set(sessionId, processInfo);

      // 출력 버퍼 초기화
      this.outputBuffers.set(sessionId, {
        chunks: [],
        lastReadIndex: 0,
        updatedAt: new Date(),
      });

      // 초기 스크린샷 캡처
      let screenCaptureData: ScreenCaptureData | undefined;
      if (captureScreen) {
        // 잠시 대기 후 캡처 (프로세스 시작 대기)
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const capture = await this.screenCaptureService.captureTerminal(nodeId);
        if (capture) {
          screenCaptureData = capture;
          processInfo.lastCaptureAt = new Date();
        }
      }

      this.emit('session:started', { sessionId, nodeId, pid: result.pid });

      return {
        success: true,
        pid: result.pid,
        screenCaptureData,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to start session on node: ${sessionId}`, { error });
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 노드 프로세스에 입력 전송
   */
  async writeInput(
    sessionId: string,
    input: string,
    captureScreen: boolean = true
  ): Promise<{
    success: boolean;
    error?: string;
    screenCaptureData?: ScreenCaptureData;
  }> {
    const processInfo = this.processes.get(sessionId);
    if (!processInfo) {
      return {
        success: false,
        error: `Session ${sessionId} not found`,
      };
    }

    try {
      // 입력 전송
      const writeSuccess = await this.screenCaptureService.writeToProcess(
        processInfo.nodeId,
        processInfo.pid,
        input
      );

      if (!writeSuccess) {
        return {
          success: false,
          error: 'Failed to write to process',
        };
      }

      // 출력 버퍼에 입력 기록 (에코용)
      const buffer = this.outputBuffers.get(sessionId);
      if (buffer) {
        buffer.chunks.push(`> ${input}`);
        buffer.updatedAt = new Date();
      }

      // 스크린샷 캡처
      let screenCaptureData: ScreenCaptureData | undefined;
      if (captureScreen) {
        // 입력 처리 대기
        await new Promise((resolve) => setTimeout(resolve, 500));
        const capture = await this.screenCaptureService.captureTerminal(
          processInfo.nodeId
        );
        if (capture) {
          screenCaptureData = capture;
          processInfo.lastCaptureAt = new Date();
        }
      }

      this.emit('session:input', { sessionId, input });

      return {
        success: true,
        screenCaptureData,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to write input: ${sessionId}`, { error });
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 세션 종료
   */
  async stopSession(
    sessionId: string,
    captureScreen: boolean = true
  ): Promise<{
    success: boolean;
    error?: string;
    screenCaptureData?: ScreenCaptureData;
  }> {
    const processInfo = this.processes.get(sessionId);
    if (!processInfo) {
      return {
        success: false,
        error: `Session ${sessionId} not found`,
      };
    }

    try {
      // 마지막 스크린샷 캡처 (종료 전)
      let screenCaptureData: ScreenCaptureData | undefined;
      if (captureScreen) {
        const capture = await this.screenCaptureService.captureTerminal(
          processInfo.nodeId
        );
        if (capture) {
          screenCaptureData = capture;
        }
      }

      // 프로세스 종료
      const killSuccess = await this.screenCaptureService.killProcess(
        processInfo.nodeId,
        processInfo.pid
      );

      if (!killSuccess) {
        logger.warn(`Failed to kill process, may have already exited: ${sessionId}`);
      }

      // 정리
      this.processes.delete(sessionId);
      this.outputBuffers.delete(sessionId);

      this.emit('session:stopped', { sessionId });

      return {
        success: true,
        screenCaptureData,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to stop session: ${sessionId}`, { error });
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 출력 폴링 (텍스트 로그 모드에서 사용)
   *
   * 노드 기반 실행에서는 주로 스크린샷을 사용하지만,
   * 출력 버퍼에서 새 내용을 확인할 수 있습니다.
   */
  poll(sessionId: string): PollResult {
    const processInfo = this.processes.get(sessionId);
    const buffer = this.outputBuffers.get(sessionId);

    if (!processInfo) {
      return {
        hasNewOutput: false,
        status: 'failed' as PluginSessionStatus,
        timestamp: Date.now(),
      };
    }

    if (!buffer) {
      return {
        hasNewOutput: false,
        status: 'running' as PluginSessionStatus,
        timestamp: Date.now(),
      };
    }

    const newChunks = buffer.chunks.slice(buffer.lastReadIndex);
    buffer.lastReadIndex = buffer.chunks.length;

    return {
      hasNewOutput: newChunks.length > 0,
      output: newChunks.join('\n'),
      status: 'running' as PluginSessionStatus,
      timestamp: Date.now(),
    };
  }

  /**
   * 스크린샷 캡처
   */
  async captureScreen(sessionId: string): Promise<ScreenCaptureData | null> {
    const processInfo = this.processes.get(sessionId);
    if (!processInfo) {
      logger.warn(`Session ${sessionId} not found for screen capture`);
      return null;
    }

    const capture = await this.screenCaptureService.captureTerminal(
      processInfo.nodeId
    );

    if (capture) {
      processInfo.lastCaptureAt = new Date();
      this.emit('screen:captured', { sessionId, timestamp: capture.timestamp });
    }

    return capture;
  }

  /**
   * 세션 존재 확인
   */
  hasSession(sessionId: string): boolean {
    return this.processes.has(sessionId);
  }

  /**
   * 세션 정보 조회
   */
  getSessionInfo(sessionId: string): NodeProcess | undefined {
    return this.processes.get(sessionId);
  }

  /**
   * 모든 활성 세션 ID 조회
   */
  getActiveSessionIds(): string[] {
    return Array.from(this.processes.keys());
  }

  /**
   * Claude CLI 명령 구성
   */
  private buildClaudeCommand(
    baseCommand: string,
    env?: Record<string, string>
  ): string {
    // 환경 변수 설정이 필요한 경우
    if (env && Object.keys(env).length > 0) {
      const isWindows = process.platform === 'win32';
      const envStr = Object.entries(env)
        .map(([key, value]) => {
          if (isWindows) {
            return `$env:${key}='${value}'`;
          }
          return `${key}='${value}'`;
        })
        .join(isWindows ? '; ' : ' ');

      if (isWindows) {
        return `${envStr}; ${baseCommand}`;
      }
      return `${envStr} ${baseCommand}`;
    }

    return baseCommand;
  }

  /**
   * 정리
   */
  async dispose(): Promise<void> {
    // 모든 세션 종료
    for (const sessionId of this.processes.keys()) {
      await this.stopSession(sessionId, false);
    }

    this.processes.clear();
    this.outputBuffers.clear();
    this.screenCaptureService.dispose();
    this.removeAllListeners();

    logger.debug('NodeExecutionManager disposed');
  }
}
