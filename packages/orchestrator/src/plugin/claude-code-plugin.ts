/**
 * ClaudeCodePlugin - Claude Code CLI 플러그인
 *
 * Moonbot 통합을 위한 claude_code 도구 구현.
 * 1:1 채팅 환경에서 Claude CLI를 실행하고 결과를 확인할 수 있게 합니다.
 *
 * 주요 기능:
 * - start: 세션 시작 (useScreenCapture 옵션 지원)
 * - write: 터미널에 입력 전송
 * - stop: 세션 종료
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { createLogger } from '@codecafe/core';
import {
  ClaudeCodeParams,
  StartActionParams,
  WriteActionParams,
  StopActionParams,
  SessionCreateResult,
  WriteResult,
  StopResult,
  PluginSession,
  PluginConfig,
  PollResult,
  ScreenCaptureData,
  claudeCodeToolSchema,
} from './types';
import { PluginSessionManager, CreateSessionOptions } from './plugin-session-manager';
import { NodeExecutionManager } from './node-execution-manager';
import { NodeRpcClient } from './screen-capture-service';

const logger = createLogger({ context: 'ClaudeCodePlugin' });

/**
 * 로컬 프로세스 정보
 */
interface LocalProcess {
  process: ChildProcess;
  outputBuffer: string[];
  lastReadIndex: number;
}

/**
 * ClaudeCodePlugin 옵션
 */
export interface ClaudeCodePluginOptions {
  /** 플러그인 설정 */
  config?: PluginConfig;
  /** 노드 RPC 클라이언트 (Moonbot 통합용) */
  rpcClient?: NodeRpcClient;
  /** 기본 노드 ID (useScreenCapture=true 시 사용) */
  defaultNodeId?: string;
}

/**
 * ClaudeCodePlugin - Claude Code CLI 플러그인
 */
export class ClaudeCodePlugin extends EventEmitter {
  private readonly sessionManager: PluginSessionManager;
  private readonly nodeExecutionManager: NodeExecutionManager;
  private readonly localProcesses = new Map<string, LocalProcess>();
  private readonly defaultNodeId?: string;

  constructor(options?: ClaudeCodePluginOptions) {
    super();
    this.sessionManager = new PluginSessionManager(options?.config);
    this.nodeExecutionManager = new NodeExecutionManager({
      rpcClient: options?.rpcClient,
    });
    this.defaultNodeId = options?.defaultNodeId;

    // 이벤트 전파
    this.setupEventForwarding();
  }

  /**
   * 도구 스키마 반환
   */
  getToolSchema(): typeof claudeCodeToolSchema {
    return claudeCodeToolSchema;
  }

  /**
   * RPC 클라이언트 설정 (Moonbot 통합 시)
   */
  setRpcClient(client: NodeRpcClient): void {
    this.nodeExecutionManager.setRpcClient(client);
  }

  /**
   * claude_code 도구 실행
   */
  async execute(
    params: ClaudeCodeParams,
    context: { userId: string; channelId?: string }
  ): Promise<SessionCreateResult | WriteResult | StopResult> {
    switch (params.action) {
      case 'start':
        return this.start(params, context);
      case 'write':
        return this.write(params);
      case 'stop':
        return this.stop(params);
      default:
        throw new Error(`Unknown action: ${(params as any).action}`);
    }
  }

  /**
   * start 액션 - 세션 시작
   */
  async start(
    params: StartActionParams,
    context: { userId: string; channelId?: string }
  ): Promise<SessionCreateResult> {
    const {
      workingDirectory,
      prompt,
      env,
      timeout,
      useScreenCapture = false,
    } = params;

    // 노드 ID 결정 (useScreenCapture=true 시)
    const nodeId = useScreenCapture ? this.defaultNodeId : undefined;

    if (useScreenCapture && !nodeId) {
      return {
        success: false,
        error: 'No node configured for screen capture. Please set defaultNodeId or pair a node.',
      };
    }

    // 노드 연결 확인 (useScreenCapture=true 시)
    if (useScreenCapture && nodeId) {
      const isConnected = await this.nodeExecutionManager.checkNodeConnection(nodeId);
      if (!isConnected) {
        return {
          success: false,
          error: `Node ${nodeId} is not connected. Please check node pairing status.`,
        };
      }
    }

    try {
      // 세션 생성
      const sessionOptions: CreateSessionOptions = {
        userId: context.userId,
        channelId: context.channelId,
        workingDirectory,
        executionMode: useScreenCapture ? 'node' : 'local',
        timeout,
        env,
        nodeId,
      };

      const session = this.sessionManager.createSession(sessionOptions);

      // 실행 모드에 따른 처리
      if (useScreenCapture && nodeId) {
        // 노드 기반 실행
        const result = await this.startNodeSession(session, prompt);
        return result;
      } else {
        // 로컬 PTY 실행
        const result = await this.startLocalSession(session, prompt);
        return result;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to start session', { error, params });
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * write 액션 - 입력 전송
   */
  async write(params: WriteActionParams): Promise<WriteResult> {
    const { sessionId, input, useScreenCapture } = params;

    // 세션 조회
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      return {
        success: false,
        error: `Session ${sessionId} not found`,
      };
    }

    // 실행 모드 결정 (명시적 지정 또는 세션의 모드 사용)
    const isNodeMode =
      useScreenCapture !== undefined
        ? useScreenCapture
        : session.executionMode === 'node';

    try {
      if (isNodeMode) {
        // 노드 기반 입력 전송
        const result = await this.nodeExecutionManager.writeInput(
          sessionId,
          input,
          true // 스크린샷 캡처
        );

        this.sessionManager.touchSession(sessionId);

        return {
          success: result.success,
          error: result.error,
          screenCaptureData: result.screenCaptureData,
        };
      } else {
        // 로컬 PTY 입력 전송
        const localProcess = this.localProcesses.get(sessionId);
        if (!localProcess) {
          return {
            success: false,
            error: `Local process for session ${sessionId} not found`,
          };
        }

        // 입력 전송
        localProcess.process.stdin?.write(input + '\n');
        this.sessionManager.touchSession(sessionId);

        // 잠시 대기 후 출력 수집
        await new Promise((resolve) => setTimeout(resolve, 500));
        const pollResult = this.pollLocalProcess(sessionId);

        return {
          success: true,
          output: pollResult.output,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to write input', { error, sessionId });
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * stop 액션 - 세션 종료
   */
  async stop(params: StopActionParams): Promise<StopResult> {
    const { sessionId, useScreenCapture } = params;

    // 세션 조회
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      return {
        success: false,
        status: 'error',
        error: `Session ${sessionId} not found`,
      };
    }

    // 실행 모드 결정
    const isNodeMode =
      useScreenCapture !== undefined
        ? useScreenCapture
        : session.executionMode === 'node';

    try {
      let lastOutput: string | undefined;
      let screenCaptureData: ScreenCaptureData | undefined;

      if (isNodeMode) {
        // 노드 기반 세션 종료
        const result = await this.nodeExecutionManager.stopSession(
          sessionId,
          true // 마지막 스크린샷 캡처
        );

        screenCaptureData = result.screenCaptureData;
      } else {
        // 로컬 PTY 세션 종료
        const localProcess = this.localProcesses.get(sessionId);
        if (localProcess) {
          // 마지막 출력 수집
          lastOutput = localProcess.outputBuffer.slice(-100).join('');

          // 프로세스 종료
          localProcess.process.kill();
          this.localProcesses.delete(sessionId);
        }
      }

      // 세션 상태 업데이트
      this.sessionManager.updateSessionStatus(sessionId, 'completed');
      this.sessionManager.deleteSession(sessionId);

      return {
        success: true,
        status: 'success',
        lastOutput,
        screenCaptureData,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to stop session', { error, sessionId });

      // 실패해도 세션은 정리
      this.sessionManager.updateSessionStatus(sessionId, 'failed');
      this.sessionManager.deleteSession(sessionId);

      return {
        success: false,
        status: 'error',
        error: errorMessage,
      };
    }
  }

  /**
   * 출력 폴링
   */
  poll(sessionId: string): PollResult {
    const session = this.sessionManager.getSession(sessionId);
    if (!session) {
      return {
        hasNewOutput: false,
        status: 'failed',
        timestamp: Date.now(),
      };
    }

    if (session.executionMode === 'node') {
      return this.nodeExecutionManager.poll(sessionId);
    } else {
      return this.pollLocalProcess(sessionId);
    }
  }

  /**
   * 스크린샷 캡처 (노드 모드 전용)
   */
  async captureScreen(sessionId: string): Promise<ScreenCaptureData | null> {
    const session = this.sessionManager.getSession(sessionId);
    if (!session || session.executionMode !== 'node') {
      return null;
    }

    return this.nodeExecutionManager.captureScreen(sessionId);
  }

  /**
   * 세션 조회
   */
  getSession(sessionId: string): PluginSession | undefined {
    return this.sessionManager.getSession(sessionId);
  }

  /**
   * 채널로 세션 조회
   */
  getSessionByChannel(channelId: string): PluginSession | undefined {
    return this.sessionManager.getSessionByChannel(channelId);
  }

  /**
   * 사용자의 세션 목록 조회
   */
  getUserSessions(userId: string): PluginSession[] {
    return this.sessionManager.getUserSessions(userId);
  }

  /**
   * 노드 기반 세션 시작
   */
  private async startNodeSession(
    session: PluginSession,
    prompt?: string
  ): Promise<SessionCreateResult> {
    const claudeCommand = this.buildClaudeCommand(prompt);

    const result = await this.nodeExecutionManager.startSession(session.sessionId, {
      nodeId: session.nodeId!,
      command: claudeCommand,
      workingDirectory: session.workingDirectory,
      env: session.env,
      captureScreen: true,
    });

    if (result.success) {
      this.sessionManager.updateSessionStatus(session.sessionId, 'running');
      return {
        success: true,
        sessionId: session.sessionId,
        screenCaptureData: result.screenCaptureData,
      };
    } else {
      this.sessionManager.updateSessionStatus(session.sessionId, 'failed');
      this.sessionManager.deleteSession(session.sessionId);
      return {
        success: false,
        error: result.error,
      };
    }
  }

  /**
   * 로컬 PTY 세션 시작
   */
  private async startLocalSession(
    session: PluginSession,
    prompt?: string
  ): Promise<SessionCreateResult> {
    const claudeCommand = this.buildClaudeCommand(prompt);
    const args = this.parseCommand(claudeCommand);

    try {
      // Claude CLI 실행
      const childProcess = spawn(args[0], args.slice(1), {
        cwd: session.workingDirectory,
        env: { ...process.env, ...session.env },
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // 출력 버퍼 설정
      const localProcess: LocalProcess = {
        process: childProcess,
        outputBuffer: [],
        lastReadIndex: 0,
      };

      // stdout 수집
      childProcess.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        localProcess.outputBuffer.push(chunk);
        this.emit('session:output', {
          sessionId: session.sessionId,
          data: chunk,
        });
      });

      // stderr 수집
      childProcess.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        localProcess.outputBuffer.push(`[stderr] ${chunk}`);
        this.emit('session:output', {
          sessionId: session.sessionId,
          data: `[stderr] ${chunk}`,
        });
      });

      // 종료 처리
      childProcess.on('close', (code) => {
        logger.debug(`Process exited with code ${code}`, {
          sessionId: session.sessionId,
        });
        this.sessionManager.updateSessionStatus(
          session.sessionId,
          code === 0 ? 'completed' : 'failed'
        );
        this.localProcesses.delete(session.sessionId);
      });

      childProcess.on('error', (error) => {
        logger.error('Process error', { sessionId: session.sessionId, error });
        this.sessionManager.updateSessionStatus(session.sessionId, 'failed');
        this.localProcesses.delete(session.sessionId);
      });

      this.localProcesses.set(session.sessionId, localProcess);
      this.sessionManager.updateSessionStatus(session.sessionId, 'running');

      // 초기 출력 대기
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const initialOutput = localProcess.outputBuffer.join('');

      return {
        success: true,
        sessionId: session.sessionId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to start local process', {
        sessionId: session.sessionId,
        error,
      });

      this.sessionManager.updateSessionStatus(session.sessionId, 'failed');
      this.sessionManager.deleteSession(session.sessionId);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 로컬 프로세스 폴링
   */
  private pollLocalProcess(sessionId: string): PollResult {
    const localProcess = this.localProcesses.get(sessionId);
    const session = this.sessionManager.getSession(sessionId);

    if (!localProcess || !session) {
      return {
        hasNewOutput: false,
        status: session?.status ?? 'failed',
        timestamp: Date.now(),
      };
    }

    const newChunks = localProcess.outputBuffer.slice(localProcess.lastReadIndex);
    localProcess.lastReadIndex = localProcess.outputBuffer.length;

    return {
      hasNewOutput: newChunks.length > 0,
      output: newChunks.join(''),
      status: session.status,
      timestamp: Date.now(),
    };
  }

  /**
   * Claude CLI 명령 구성
   */
  private buildClaudeCommand(prompt?: string): string {
    // 기본 명령
    let command = 'claude';

    // 프롬프트가 있으면 -p 모드 사용
    if (prompt) {
      // 프롬프트를 이스케이프
      const escapedPrompt = prompt.replace(/"/g, '\\"');
      command += ` -p "${escapedPrompt}"`;
    }

    // 권한 자동 승인
    command += ' --dangerously-skip-permissions';

    return command;
  }

  /**
   * 명령어 파싱
   */
  private parseCommand(command: string): string[] {
    // 간단한 명령어 파싱 (공백 기준, 따옴표 처리)
    const args: string[] = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';

    for (const char of command) {
      if ((char === '"' || char === "'") && !inQuote) {
        inQuote = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuote) {
        inQuote = false;
        quoteChar = '';
      } else if (char === ' ' && !inQuote) {
        if (current) {
          args.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      args.push(current);
    }

    return args;
  }

  /**
   * 이벤트 전파 설정
   */
  private setupEventForwarding(): void {
    // 세션 매니저 이벤트 전파
    this.sessionManager.on('event', (event) => {
      this.emit('plugin:event', event);
    });

    // 노드 실행 매니저 이벤트 전파
    this.nodeExecutionManager.on('session:started', (data) => {
      this.emit('session:started', data);
    });

    this.nodeExecutionManager.on('session:stopped', (data) => {
      this.emit('session:stopped', data);
    });

    this.nodeExecutionManager.on('screen:captured', (data) => {
      this.emit('screen:captured', data);
    });
  }

  /**
   * 타임아웃된 세션 정리
   */
  cleanupTimedOutSessions(): number {
    return this.sessionManager.cleanupTimedOutSessions();
  }

  /**
   * 정리
   */
  async dispose(): Promise<void> {
    // 로컬 프로세스 종료
    for (const [sessionId, localProcess] of this.localProcesses) {
      try {
        localProcess.process.kill();
      } catch (error) {
        logger.warn(`Failed to kill local process: ${sessionId}`, { error });
      }
    }
    this.localProcesses.clear();

    // 노드 실행 매니저 정리
    await this.nodeExecutionManager.dispose();

    // 세션 매니저 정리
    this.sessionManager.dispose();

    this.removeAllListeners();
    logger.debug('ClaudeCodePlugin disposed');
  }
}
