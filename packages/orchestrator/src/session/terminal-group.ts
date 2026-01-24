/**
 * TerminalGroup - Order당 N개의 터미널 관리
 *
 * 규칙:
 * 1. 같은 Provider의 Stage들은 하나의 터미널에서 순차 실행
 * 2. 다른 Provider의 Stage들은 별도 터미널에서 병렬 실행 가능
 * 3. Stage의 parallel 모드면 같은 Provider라도 별도 터미널
 */

import { EventEmitter } from 'events';
import { ProviderType } from '@codecafe/core';
import { TerminalPool, TerminalLease } from '../terminal/terminal-pool';
import { ProviderAdapterFactory } from '../terminal/provider-adapter';
import { SharedContext } from './shared-context';

export interface TerminalInfo {
  id: string;
  provider: ProviderType;
  lease: TerminalLease;
  status: 'idle' | 'busy' | 'error';
  currentStageId?: string;
}

export interface TerminalGroupConfig {
  orderId: string;
  cwd: string;
  providers: ProviderType[];  // 필요한 Provider 목록
}

/**
 * TerminalGroup - Order 실행에 필요한 터미널들을 그룹으로 관리
 */
export class TerminalGroup extends EventEmitter {
  private readonly orderId: string;
  private readonly cwd: string;
  private readonly terminalPool: TerminalPool;
  private readonly sharedContext: SharedContext;

  // Provider별 터미널 관리 (같은 Provider는 기본적으로 1개 터미널 공유)
  private readonly terminalsByProvider = new Map<ProviderType, TerminalInfo>();

  // 병렬 실행용 추가 터미널 (parallel 모드일 때)
  private readonly parallelTerminals = new Map<string, TerminalInfo>();

  private isDisposed = false;

  constructor(
    config: TerminalGroupConfig,
    terminalPool: TerminalPool,
    sharedContext: SharedContext
  ) {
    super();
    this.orderId = config.orderId;
    this.cwd = config.cwd;
    this.terminalPool = terminalPool;
    this.sharedContext = sharedContext;
  }

  /**
   * Provider에 해당하는 터미널 획득 (없으면 생성)
   */
  async acquireTerminal(provider: ProviderType): Promise<TerminalInfo> {
    if (this.isDisposed) {
      throw new Error(`TerminalGroup for order ${this.orderId} is disposed`);
    }

    // 이미 해당 Provider의 터미널이 있으면 재사용
    let terminalInfo = this.terminalsByProvider.get(provider);
    if (terminalInfo && terminalInfo.status !== 'error') {
      return terminalInfo;
    }

    // 새 터미널 획득
    const lease = await this.terminalPool.acquireLease(
      provider,
      `${this.orderId}-${provider}`,
      this.cwd
    );

    terminalInfo = {
      id: `${this.orderId}-${provider}-${Date.now()}`,
      provider,
      lease,
      status: 'idle',
    };

    this.terminalsByProvider.set(provider, terminalInfo);

    console.log(`[TerminalGroup] Acquired terminal for provider ${provider}, order ${this.orderId}`);
    this.emit('terminal:acquired', { terminalId: terminalInfo.id, provider, orderId: this.orderId });

    return terminalInfo;
  }

  /**
   * 병렬 실행용 추가 터미널 획득
   */
  async acquireParallelTerminal(provider: ProviderType, stageId: string): Promise<TerminalInfo> {
    if (this.isDisposed) {
      throw new Error(`TerminalGroup for order ${this.orderId} is disposed`);
    }

    const parallelKey = `${provider}-${stageId}`;

    // 새 터미널 획득 (병렬용은 항상 새로 생성)
    const lease = await this.terminalPool.acquireLease(
      provider,
      `${this.orderId}-parallel-${stageId}`,
      this.cwd
    );

    const terminalInfo: TerminalInfo = {
      id: `${this.orderId}-parallel-${provider}-${stageId}-${Date.now()}`,
      provider,
      lease,
      status: 'idle',
      currentStageId: stageId,
    };

    this.parallelTerminals.set(parallelKey, terminalInfo);

    console.log(`[TerminalGroup] Acquired parallel terminal for provider ${provider}, stage ${stageId}`);
    this.emit('terminal:acquired', { terminalId: terminalInfo.id, provider, stageId, parallel: true });

    return terminalInfo;
  }

  /**
   * Stage 실행
   */
  async executeStage(
    stageId: string,
    provider: ProviderType,
    prompt: string,
    options: {
      parallel?: boolean;
      includeContext?: boolean;
      role?: string;
      skills?: string[];
      stageName?: string;
    } = {}
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    const { parallel = false, includeContext = true, role, skills, stageName } = options;

    // 터미널 획득
    const terminalInfo = parallel
      ? await this.acquireParallelTerminal(provider, stageId)
      : await this.acquireTerminal(provider);

    terminalInfo.status = 'busy';
    terminalInfo.currentStageId = stageId;

    // SharedContext에 Stage 시작 기록
    this.sharedContext.startStage(stageId, provider, role, skills);

    // Stage 시작 마커를 터미널 출력으로 전송
    const displayStageName = stageName || role || stageId;
    const stageStartInfo = JSON.stringify({
      stageId,
      provider,
      stageName: displayStageName,
      skills,
    });
    this.emit('stage:output', {
      orderId: this.orderId,
      stageId,
      data: `[STAGE_START] ${stageStartInfo}`,
    });

    try {
      // 이전 Stage 결과를 프롬프트에 포함
      let fullPrompt = prompt;
      if (includeContext) {
        const contextString = this.sharedContext.buildPromptContext();
        if (contextString) {
          fullPrompt = prompt + contextString;
        }
      }

      // Adapter를 통해 실행
      const adapter = ProviderAdapterFactory.get(provider);
      const result = await adapter.execute(
        terminalInfo.lease.terminal.process,
        fullPrompt,
        (data) => {
          this.emit('stage:output', { orderId: this.orderId, stageId, data });
        }
      );

      if (result.success) {
        // SharedContext에 결과 저장
        this.sharedContext.completeStage(stageId, result.output);

        // Stage 완료 마커를 터미널 출력으로 전송
        const stageResult = this.sharedContext.getStageResult(stageId);
        this.emitStageEndEvent(stageId, role, 'completed', { duration: stageResult?.duration });

        this.emit('stage:completed', {
          orderId: this.orderId,
          stageId,
          provider,
          output: result.output,
        });
      } else {
        this.sharedContext.failStage(stageId, result.error || 'Unknown error');

        // Stage 실패 마커를 터미널 출력으로 전송
        this.emitStageEndEvent(stageId, role, 'failed', { error: result.error });

        this.emit('stage:failed', {
          orderId: this.orderId,
          stageId,
          provider,
          error: result.error,
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.sharedContext.failStage(stageId, errorMessage);

      // Stage 실패 마커를 터미널 출력으로 전송 (catch 블록)
      this.emitStageEndEvent(stageId, role, 'failed', { error: errorMessage });

      this.emit('stage:failed', {
        orderId: this.orderId,
        stageId,
        provider,
        error: errorMessage,
      });

      return { success: false, error: errorMessage };
    } finally {
      terminalInfo.status = 'idle';
      terminalInfo.currentStageId = undefined;

      // 병렬 터미널은 사용 후 해제
      if (parallel) {
        await this.releaseParallelTerminal(provider, stageId);
      }
    }
  }

  /**
   * 여러 Stage 병렬 실행
   */
  async executeStagesParallel(
    stages: Array<{
      stageId: string;
      provider: ProviderType;
      prompt: string;
      role?: string;
    }>
  ): Promise<Array<{ stageId: string; success: boolean; output?: string; error?: string }>> {
    const promises = stages.map((stage) =>
      this.executeStage(stage.stageId, stage.provider, stage.prompt, {
        parallel: true,
        includeContext: true,
        role: stage.role,
      }).then((result) => ({
        stageId: stage.stageId,
        ...result,
      }))
    );

    return Promise.all(promises);
  }

  /**
   * 터미널에 입력 전송
   */
  async sendInput(provider: ProviderType, message: string): Promise<void> {
    const terminalInfo = this.terminalsByProvider.get(provider);
    if (!terminalInfo) {
      throw new Error(`No terminal found for provider ${provider}`);
    }

    terminalInfo.lease.terminal.process.write(message + '\n');
  }

  /**
   * Stage 종료 마커 전송 헬퍼
   */
  private emitStageEndEvent(
    stageId: string,
    role: string | undefined,
    status: 'completed' | 'failed',
    data: { duration?: number; error?: string }
  ): void {
    const stageEndInfo = JSON.stringify({
      stageId,
      status,
      stageName: role || stageId,
      ...data,
    });
    this.emit('stage:output', {
      orderId: this.orderId,
      stageId,
      data: `[STAGE_END] ${stageEndInfo}`,
    });
  }

  /**
   * 병렬 터미널 해제
   */
  private async releaseParallelTerminal(provider: ProviderType, stageId: string): Promise<void> {
    const parallelKey = `${provider}-${stageId}`;
    const terminalInfo = this.parallelTerminals.get(parallelKey);

    if (terminalInfo) {
      await terminalInfo.lease.release();
      this.parallelTerminals.delete(parallelKey);
      console.log(`[TerminalGroup] Released parallel terminal for ${parallelKey}`);
    }
  }

  /**
   * 모든 터미널 상태 조회
   */
  getStatus(): {
    orderId: string;
    mainTerminals: Array<{ provider: ProviderType; status: string; currentStageId?: string }>;
    parallelTerminals: Array<{ provider: ProviderType; stageId: string; status: string }>;
  } {
    const mainTerminals = Array.from(this.terminalsByProvider.entries()).map(
      ([provider, info]) => ({
        provider,
        status: info.status,
        currentStageId: info.currentStageId,
      })
    );

    const parallelTerminals = Array.from(this.parallelTerminals.entries()).map(
      ([key, info]) => ({
        provider: info.provider,
        stageId: info.currentStageId || key.split('-')[1],
        status: info.status,
      })
    );

    return {
      orderId: this.orderId,
      mainTerminals,
      parallelTerminals,
    };
  }

  /**
   * 터미널 개수 조회
   */
  getTerminalCount(): { main: number; parallel: number; total: number } {
    const main = this.terminalsByProvider.size;
    const parallel = this.parallelTerminals.size;
    return { main, parallel, total: main + parallel };
  }

  /**
   * 모든 터미널 해제
   */
  async dispose(): Promise<void> {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;

    // 병렬 터미널 해제
    for (const [key, terminalInfo] of this.parallelTerminals) {
      try {
        await terminalInfo.lease.release();
      } catch (error) {
        console.error(`[TerminalGroup] Failed to release parallel terminal ${key}:`, error);
      }
    }
    this.parallelTerminals.clear();

    // 메인 터미널 해제
    for (const [provider, terminalInfo] of this.terminalsByProvider) {
      try {
        await terminalInfo.lease.release();
      } catch (error) {
        console.error(`[TerminalGroup] Failed to release terminal for ${provider}:`, error);
      }
    }
    this.terminalsByProvider.clear();

    this.removeAllListeners();
    console.log(`[TerminalGroup] Disposed for order ${this.orderId}`);
  }
}
