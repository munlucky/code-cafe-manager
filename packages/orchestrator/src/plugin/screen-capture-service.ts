/**
 * ScreenCaptureService - 화면 캡처 서비스
 *
 * 노드 기반 화면 캡처(nodes.screen_snap) 기능을 제공합니다.
 * Moonbot의 nodes 도구와 통합하여 로컬 터미널 화면을 캡처합니다.
 */

import { EventEmitter } from 'events';
import { createLogger } from '@codecafe/core';
import { ScreenCaptureData, NodeStatus } from './types';

const logger = createLogger({ context: 'ScreenCaptureService' });

/**
 * 스크린샷 캡처 옵션
 */
export interface CaptureOptions {
  /** 노드 ID */
  nodeId: string;
  /** 이미지 포맷 */
  format?: 'png' | 'jpeg';
  /** 품질 (jpeg only, 0-100) */
  quality?: number;
  /** 캡처 영역 (생략 시 전체 화면) */
  region?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** 특정 창만 캡처 (창 제목 또는 프로세스 이름) */
  windowTitle?: string;
}

/**
 * 노드 RPC 인터페이스 (Moonbot nodes 도구와 통신)
 */
export interface NodeRpcClient {
  /** 노드 상태 조회 (nodes.status) */
  getNodeStatus(nodeId: string): Promise<NodeStatus | null>;
  /** 화면 캡처 요청 (nodes.screen_snap) */
  captureScreen(nodeId: string, options?: Partial<CaptureOptions>): Promise<ScreenCaptureData | null>;
  /** 명령 실행 (nodes.run) */
  runCommand(nodeId: string, command: string, cwd?: string): Promise<{ pid: number; success: boolean }>;
  /** 프로세스에 입력 전송 (nodes.write) */
  writeToProcess(nodeId: string, pid: number, input: string): Promise<boolean>;
  /** 프로세스 종료 (nodes.kill) */
  killProcess(nodeId: string, pid: number): Promise<boolean>;
}

/**
 * Mock RPC 클라이언트 (실제 Moonbot 통합 전 테스트용)
 */
class MockNodeRpcClient implements NodeRpcClient {
  async getNodeStatus(nodeId: string): Promise<NodeStatus | null> {
    logger.debug(`[MOCK] getNodeStatus: ${nodeId}`);
    // Mock: 노드가 연결되어 있다고 가정
    return {
      nodeId,
      connected: true,
      name: `Mock Node ${nodeId}`,
      platform: process.platform as 'win32' | 'darwin' | 'linux',
      lastSeen: new Date(),
    };
  }

  async captureScreen(
    nodeId: string,
    options?: Partial<CaptureOptions>
  ): Promise<ScreenCaptureData | null> {
    logger.debug(`[MOCK] captureScreen: ${nodeId}`, options);
    // Mock: 빈 이미지 데이터 반환
    return {
      imageData: '',
      format: options?.format ?? 'png',
      timestamp: Date.now(),
      region: options?.region,
    };
  }

  async runCommand(
    nodeId: string,
    command: string,
    cwd?: string
  ): Promise<{ pid: number; success: boolean }> {
    logger.debug(`[MOCK] runCommand: ${nodeId}`, { command, cwd });
    return { pid: Math.floor(Math.random() * 10000), success: true };
  }

  async writeToProcess(nodeId: string, pid: number, input: string): Promise<boolean> {
    logger.debug(`[MOCK] writeToProcess: ${nodeId}/${pid}`, { input });
    return true;
  }

  async killProcess(nodeId: string, pid: number): Promise<boolean> {
    logger.debug(`[MOCK] killProcess: ${nodeId}/${pid}`);
    return true;
  }
}

/**
 * ScreenCaptureService - 화면 캡처 서비스
 */
export class ScreenCaptureService extends EventEmitter {
  private rpcClient: NodeRpcClient;
  private readonly defaultFormat: 'png' | 'jpeg';
  private readonly defaultQuality: number;

  constructor(options?: {
    rpcClient?: NodeRpcClient;
    defaultFormat?: 'png' | 'jpeg';
    defaultQuality?: number;
  }) {
    super();
    this.rpcClient = options?.rpcClient ?? new MockNodeRpcClient();
    this.defaultFormat = options?.defaultFormat ?? 'png';
    this.defaultQuality = options?.defaultQuality ?? 80;
  }

  /**
   * RPC 클라이언트 설정 (Moonbot 통합 시 사용)
   */
  setRpcClient(client: NodeRpcClient): void {
    this.rpcClient = client;
    logger.debug('RPC client updated');
  }

  /**
   * 노드 상태 확인
   */
  async checkNodeStatus(nodeId: string): Promise<NodeStatus | null> {
    try {
      return await this.rpcClient.getNodeStatus(nodeId);
    } catch (error) {
      logger.error(`Failed to check node status: ${nodeId}`, { error });
      return null;
    }
  }

  /**
   * 노드가 연결되어 있는지 확인
   */
  async isNodeConnected(nodeId: string): Promise<boolean> {
    const status = await this.checkNodeStatus(nodeId);
    return status?.connected ?? false;
  }

  /**
   * 화면 캡처
   */
  async captureScreen(options: CaptureOptions): Promise<ScreenCaptureData | null> {
    const { nodeId, format, quality, region, windowTitle } = options;

    // 노드 연결 확인
    const isConnected = await this.isNodeConnected(nodeId);
    if (!isConnected) {
      logger.warn(`Node ${nodeId} is not connected`);
      return null;
    }

    try {
      const captureData = await this.rpcClient.captureScreen(nodeId, {
        format: format ?? this.defaultFormat,
        quality: quality ?? this.defaultQuality,
        region,
        windowTitle,
      });

      if (captureData) {
        this.emit('screen:captured', {
          nodeId,
          timestamp: captureData.timestamp,
        });
      }

      return captureData;
    } catch (error) {
      logger.error(`Failed to capture screen: ${nodeId}`, { error });
      return null;
    }
  }

  /**
   * 터미널 창만 캡처 (PowerShell, Terminal, etc.)
   */
  async captureTerminal(nodeId: string): Promise<ScreenCaptureData | null> {
    // 플랫폼별 터미널 창 제목 패턴
    const status = await this.checkNodeStatus(nodeId);
    if (!status?.connected) {
      return null;
    }

    let windowTitle: string;
    switch (status.platform) {
      case 'win32':
        windowTitle = 'PowerShell';
        break;
      case 'darwin':
        windowTitle = 'Terminal';
        break;
      default:
        windowTitle = 'terminal';
    }

    return this.captureScreen({
      nodeId,
      format: this.defaultFormat,
      quality: this.defaultQuality,
      windowTitle,
    });
  }

  /**
   * 노드에서 명령 실행
   */
  async runCommand(
    nodeId: string,
    command: string,
    cwd?: string
  ): Promise<{ pid: number; success: boolean } | null> {
    // 노드 연결 확인
    const isConnected = await this.isNodeConnected(nodeId);
    if (!isConnected) {
      logger.warn(`Node ${nodeId} is not connected`);
      return null;
    }

    try {
      return await this.rpcClient.runCommand(nodeId, command, cwd);
    } catch (error) {
      logger.error(`Failed to run command on node: ${nodeId}`, { error });
      return null;
    }
  }

  /**
   * 노드 프로세스에 입력 전송
   */
  async writeToProcess(
    nodeId: string,
    pid: number,
    input: string
  ): Promise<boolean> {
    // 노드 연결 확인
    const isConnected = await this.isNodeConnected(nodeId);
    if (!isConnected) {
      logger.warn(`Node ${nodeId} is not connected`);
      return false;
    }

    try {
      return await this.rpcClient.writeToProcess(nodeId, pid, input);
    } catch (error) {
      logger.error(`Failed to write to process: ${nodeId}/${pid}`, { error });
      return false;
    }
  }

  /**
   * 노드 프로세스 종료
   */
  async killProcess(nodeId: string, pid: number): Promise<boolean> {
    // 노드 연결 확인
    const isConnected = await this.isNodeConnected(nodeId);
    if (!isConnected) {
      logger.warn(`Node ${nodeId} is not connected`);
      return false;
    }

    try {
      return await this.rpcClient.killProcess(nodeId, pid);
    } catch (error) {
      logger.error(`Failed to kill process: ${nodeId}/${pid}`, { error });
      return false;
    }
  }

  /**
   * 명령 실행 후 스크린샷 캡처
   */
  async runAndCapture(
    nodeId: string,
    command: string,
    cwd?: string,
    delayMs: number = 500
  ): Promise<{
    pid?: number;
    screenCapture?: ScreenCaptureData;
    error?: string;
  }> {
    // 명령 실행
    const result = await this.runCommand(nodeId, command, cwd);
    if (!result?.success) {
      return { error: 'Failed to run command' };
    }

    // 잠시 대기 (명령 실행 후 화면 업데이트 대기)
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    // 스크린샷 캡처
    const screenCapture = await this.captureTerminal(nodeId);

    return {
      pid: result.pid,
      screenCapture: screenCapture ?? undefined,
    };
  }

  /**
   * 정리
   */
  dispose(): void {
    this.removeAllListeners();
    logger.debug('ScreenCaptureService disposed');
  }
}
