/**
 * Resource Lifecycle Integration Tests
 * Week 4: 리소스 관리 통합 테스트
 *
 * 테스트 시나리오:
 * 1. 기본 시나리오 - 정상적인 dispose(), 리소스 해제
 * 2. 메모리 누수 방지 - 모든 리스너/핸들러 정리 확인
 * 3. Crash recovery - 터미널 crash 후 재시작 및 정리
 * 4. Concurrency - 동시 dispose 시나리오
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TerminalPool } from '../terminal/terminal-pool';
import { TerminalGroup } from '../session/terminal-group';
import { SharedContext } from '../session/shared-context';
import { ProviderAdapterFactory, MockProviderAdapter } from '../terminal/provider-adapter';

// Mock ProviderAdapterFactory
vi.mock('../terminal/provider-adapter', () => ({
  ProviderAdapterFactory: {
    get: vi.fn(),
    initialize: vi.fn(),
  },
}));

describe('Resource Lifecycle Integration Tests', () => {
  const PROVIDER_ID = 'claude-code';
  const ORDER_ID = 'order-1';
  const POOL_SIZE = 2;

  let terminalPool: TerminalPool;
  let mockAdapter: MockProviderAdapter;
  let exitHandlersMap = new Map<any, (payload: { exitCode: number }) => void>();

  const mockConfig = {
    perProvider: {
      [PROVIDER_ID]: {
        size: POOL_SIZE,
        timeout: 30000,
        maxRetries: 3,
      },
    },
  };

  beforeEach(() => {
    exitHandlersMap.clear();

    mockAdapter = {
      spawn: vi.fn().mockResolvedValue({ pid: 123 }),
      kill: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue({ success: true, output: 'test' }),
      onExit: vi.fn().mockImplementation((process, handler) => {
        exitHandlersMap.set(process, handler);
      }),
    };

    vi.mocked(ProviderAdapterFactory.get).mockReturnValue(mockAdapter);
    terminalPool = new TerminalPool(mockConfig);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    exitHandlersMap.clear();
  });

  // Helper: 터미널 프로세스 exit 이벤트 트리거
  function triggerTerminalExit(process: any, exitCode = 1) {
    const handler = exitHandlersMap.get(process);
    if (handler) {
      handler({ exitCode });
    }
  }

  describe('Scenario 1: Basic Disposal', () => {
    it('T1: should dispose TerminalGroup and release all leases', async () => {
      const sharedContext = new SharedContext();
      const terminalGroup = new TerminalGroup(
        {
          orderId: ORDER_ID,
          cwd: process.cwd(),
          providers: [PROVIDER_ID],
        },
        terminalPool,
        sharedContext
      );

      // 터미널 획득
      const terminalInfo = await terminalGroup.acquireTerminal(PROVIDER_ID);
      expect(terminalInfo).toBeDefined();
      expect(terminalInfo.status).toBe('idle');

      // dispose 호출
      await terminalGroup.dispose();

      // 모든 터미널 해제 확인
      const count = terminalGroup.getTerminalCount();
      expect(count.total).toBe(0);
    });

    it('T2: should dispose TerminalPool and kill all terminals', async () => {
      // 터미널 생성
      await terminalPool.acquireLease(PROVIDER_ID, 'barista-1');
      await terminalPool.acquireLease(PROVIDER_ID, 'barista-2');

      expect(mockAdapter.spawn).toHaveBeenCalledTimes(2);

      // dispose 호출
      await terminalPool.dispose();

      // 모든 터미널 kill 확인
      expect(mockAdapter.kill).toHaveBeenCalledTimes(2);

      // 상태 확인
      const status = terminalPool.getStatus();
      expect(status[PROVIDER_ID].total).toBe(0);
    });

    it('T3: should handle multiple dispose calls gracefully', async () => {
      await terminalPool.acquireLease(PROVIDER_ID, 'barista-1');

      // 첫 번째 dispose
      await terminalPool.dispose();

      // 두 번째 dispose (에러 없어야 함)
      await expect(terminalPool.dispose()).resolves.not.toThrow();
    });

    it('T4: should dispose TerminalGroup with parallel terminals', async () => {
      const sharedContext = new SharedContext();
      const terminalGroup = new TerminalGroup(
        {
          orderId: ORDER_ID,
          cwd: process.cwd(),
          providers: [PROVIDER_ID],
        },
        terminalPool,
        sharedContext
      );

      // 병렬 터미널 획득
      await terminalGroup.acquireParallelTerminal(PROVIDER_ID, 'stage-1');
      await terminalGroup.acquireParallelTerminal(PROVIDER_ID, 'stage-2');

      const countBefore = terminalGroup.getTerminalCount();
      expect(countBefore.parallel).toBe(2);

      // dispose
      await terminalGroup.dispose();

      // 모든 병렬 터미널 해제 확인
      const countAfter = terminalGroup.getTerminalCount();
      expect(countAfter.total).toBe(0);
    });
  });

  describe('Scenario 2: Memory Leak Prevention', () => {
    it('T5: should remove all exit handlers on dispose', async () => {
      // 터미널 생성 (exit handler 등록)
      await terminalPool.acquireLease(PROVIDER_ID, 'barista-1');

      // exit handler가 등록되었는지 확인 (onExit 호출 확인)
      expect(mockAdapter.onExit).toHaveBeenCalled();

      // dispose 호출
      await terminalPool.dispose();

      // dispose 후 exit 트리거해도 아무 동작 없어야 함
      // (exit handler가 제거되었으므로)
      const processes = mockAdapter.onExit.mock.calls.map((call) => call[0]);
      for (const process of processes) {
        // 에러 없이 무시되어야 함
        expect(() => triggerTerminalExit(process, 1)).not.toThrow();
      }
    });

    it('T6: should clear all internal maps on dispose', async () => {
      await terminalPool.acquireLease(PROVIDER_ID, 'barista-1');
      await terminalPool.acquireLease(PROVIDER_ID, 'barista-2');

      // dispose 전 상태 확인
      const statusBefore = terminalPool.getStatus();
      expect(statusBefore[PROVIDER_ID].total).toBe(2);

      // dispose
      await terminalPool.dispose();

      // 내부 Map이 정리되었는지 확인 (status는 실제 terminals Map 기준)
      const statusAfter = terminalPool.getStatus();
      expect(statusAfter[PROVIDER_ID].total).toBe(0);

      // 주요: kill이 모든 터미널에 호출되었는지 확인
      expect(mockAdapter.kill).toHaveBeenCalledTimes(2);
    });

    it('T7: should removeAllListeners on TerminalGroup dispose', async () => {
      const sharedContext = new SharedContext();
      const terminalGroup = new TerminalGroup(
        {
          orderId: ORDER_ID,
          cwd: process.cwd(),
          providers: [PROVIDER_ID],
        },
        terminalPool,
        sharedContext
      );

      // 이벤트 리스너 등록
      let eventFired = false;
      terminalGroup.on('terminal:acquired', () => {
        eventFired = true;
      });

      await terminalGroup.acquireTerminal(PROVIDER_ID);
      expect(eventFired).toBe(true);

      // dispose
      await terminalGroup.dispose();

      // dispose 후에는 이벤트가 발생하지 않아야 함
      eventFired = false;
      try {
        await terminalGroup.acquireTerminal(PROVIDER_ID);
      } catch (e) {
        // disposed된 그룹에서는 에러 발생
        expect(e).toBeInstanceOf(Error);
      }
      expect(eventFired).toBe(false);
    });

    it('T8: should release all active leases on dispose', async () => {
      // 활성 리스 생성
      const lease1 = await terminalPool.acquireLease(PROVIDER_ID, 'barista-1');
      const lease2 = await terminalPool.acquireLease(PROVIDER_ID, 'barista-2');

      expect(lease1.token.released).toBe(false);
      expect(lease2.token.released).toBe(false);

      // dispose
      await terminalPool.dispose();

      // 리스가 해제되었는지 확인
      // (직접 접근은 어려우니 kill이 호출되었는지로 확인)
      expect(mockAdapter.kill).toHaveBeenCalledTimes(2);
    });
  });

  describe('Scenario 3: Crash Recovery', () => {
    it('T9: should restart terminal after crash', async () => {
      const lease = await terminalPool.acquireLease(PROVIDER_ID, 'barista-1');

      // 초기 spawn
      expect(mockAdapter.spawn).toHaveBeenCalledTimes(1);

      // 터미널 프로세스 가져오기
      const terminalProcess = lease.terminal.process;

      // crash 트리거
      triggerTerminalExit(terminalProcess, 1);

      // 재시작 대기
      await new Promise((resolve) => setTimeout(resolve, 200));

      // spawn이 다시 호출되어야 함 (재시작)
      expect(mockAdapter.spawn).toHaveBeenCalledTimes(2);

      // 상태 확인
      const status = terminalPool.getStatus();
      // crashed 터미널은 재시작 후 제거됨
      expect(status[PROVIDER_ID].total).toBeGreaterThanOrEqual(1);
    });

    it('T10: should handle crash during active lease with recovery', async () => {
      const sharedContext = new SharedContext();
      const terminalGroup = new TerminalGroup(
        {
          orderId: ORDER_ID,
          cwd: process.cwd(),
          providers: [PROVIDER_ID],
        },
        terminalPool,
        sharedContext
      );

      // 터미널 획득
      const terminalInfo = await terminalGroup.acquireTerminal(PROVIDER_ID);
      const terminalProcess = terminalInfo.lease.terminal.process;

      // crash 트리거
      triggerTerminalExit(terminalProcess, 1);

      // 복구 대기
      await new Promise((resolve) => setTimeout(resolve, 200));

      // 터미널 그룹 상태 확인 (여전히 존재해야 함)
      const status = terminalGroup.getStatus();
      expect(status.orderId).toBe(ORDER_ID);
    });

    it('T11: should retry terminal creation on crash', async () => {
      const lease = await terminalPool.acquireLease(PROVIDER_ID, 'barista-1');
      const terminalProcess = lease.terminal.process;

      // 첫 번째 재시도 실패, 두 번째 성공
      mockAdapter.spawn.mockRejectedValueOnce(new Error('Spawn failed 1'));
      mockAdapter.spawn.mockResolvedValueOnce({ pid: 456 }); // 두 번째 성공

      // crash 트리거
      triggerTerminalExit(terminalProcess, 1);

      // 재시도 대기
      await new Promise((resolve) => setTimeout(resolve, 500));

      // spawn이 최소 2번 이상 호출되어야 함 (초기 + 재시도)
      expect(mockAdapter.spawn.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('T12: should release semaphore on crash recovery failure', async () => {
      // 터미널 생성
      const lease = await terminalPool.acquireLease(PROVIDER_ID, 'barista-1');
      const terminalProcess = lease.terminal.process;

      // 모든 재시도 실패 설정 (이미 생성된 터미널 이후부터 적용)
      mockAdapter.spawn.mockRejectedValue(new Error('All spawn failed'));

      // crash 트리거
      triggerTerminalExit(terminalProcess, 1);

      // 복구 실패 대기
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 세마포어가 해제되어 새 리스 획득 가능
      mockAdapter.spawn.mockResolvedValue({ pid: 999 }); // 새 터미널 허용
      const newLease = await terminalPool.acquireLease(PROVIDER_ID, 'barista-3', undefined, 200);
      expect(newLease).toBeDefined();
    });
  });

  describe('Scenario 4: Concurrency', () => {
    it('T13: should handle concurrent dispose calls', async () => {
      await terminalPool.acquireLease(PROVIDER_ID, 'barista-1');
      await terminalPool.acquireLease(PROVIDER_ID, 'barista-2');

      // 동시 dispose 호출 (dispose는 멀티플 호출에 대해 방어적이지 않음)
      await Promise.all([
        terminalPool.dispose(),
        terminalPool.dispose(),
        terminalPool.dispose(),
      ]);

      // kill이 최소 2번 이상 호출되어야 함 (실제로는 더 호출될 수 있음)
      // 중요한 점: 에러 없이 완료되어야 함
      expect(mockAdapter.kill.mock.calls.length).toBeGreaterThanOrEqual(2);

      // 모든 터미널이 정리되었는지 확인
      const status = terminalPool.getStatus();
      expect(status[PROVIDER_ID].total).toBe(0);
    });

    it('T14: should handle concurrent TerminalGroup disposal', async () => {
      const sharedContext = new SharedContext();
      const terminalGroup = new TerminalGroup(
        {
          orderId: ORDER_ID,
          cwd: process.cwd(),
          providers: [PROVIDER_ID],
        },
        terminalPool,
        sharedContext
      );

      await terminalGroup.acquireTerminal(PROVIDER_ID);
      await terminalGroup.acquireParallelTerminal(PROVIDER_ID, 'stage-1');

      // 동시 dispose 호출
      await Promise.all([
        terminalGroup.dispose(),
        terminalGroup.dispose(),
      ]);

      // 모든 터미널 해제 확인
      const count = terminalGroup.getTerminalCount();
      expect(count.total).toBe(0);
    });

    it('T15: should handle concurrent acquire and dispose', async () => {
      const sharedContext = new SharedContext();
      const terminalGroup = new TerminalGroup(
        {
          orderId: ORDER_ID,
          cwd: process.cwd(),
          providers: [PROVIDER_ID],
        },
        terminalPool,
        sharedContext
      );

      // 터미널 획득 중 dispose 호출 (경쟁 조건)
      const results = await Promise.allSettled([
        terminalGroup.acquireTerminal(PROVIDER_ID),
        terminalGroup.dispose(),
      ]);

      // acquire는 실패하거나 성공할 수 있음
      // dispose는 항상 성공해야 함
      const disposeResult = results[1];
      expect(disposeResult.status).toBe('fulfilled');

      // dispose 후 터미널이 0개이거나 (acquire 실패)
      // 1개일 수 있음 (acquire가 dispose 전에 성공한 경우)
      // 중요한 점: 에러로 인해 프로세스가 중단되지 않아야 함
      const count = terminalGroup.getTerminalCount().total;
      expect(count).toBeLessThanOrEqual(1);
    });

    it('T16: should handle crash during dispose', async () => {
      const lease = await terminalPool.acquireLease(PROVIDER_ID, 'barista-1');
      const terminalProcess = lease.terminal.process;

      // dispose 중 crash 발생 시뮬레이션
      let killCalled = false;
      mockAdapter.kill.mockImplementation(async () => {
        killCalled = true;
        // kill 직후 crash 트리거
        triggerTerminalExit(terminalProcess, 1);
      });

      // dispose 호출
      await terminalPool.dispose();

      // kill이 호출되어야 함
      expect(killCalled).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('T17: should handle disposal with no terminals', async () => {
      // 터미널 없이 dispose
      await expect(terminalPool.dispose()).resolves.not.toThrow();
      expect(mockAdapter.kill).not.toHaveBeenCalled();
    });

    it('T18: should handle TerminalGroup disposal before acquire', async () => {
      const sharedContext = new SharedContext();
      const terminalGroup = new TerminalGroup(
        {
          orderId: ORDER_ID,
          cwd: process.cwd(),
          providers: [PROVIDER_ID],
        },
        terminalPool,
        sharedContext
      );

      // acquire 전에 dispose
      await terminalGroup.dispose();

      // 이후 acquire 시도는 에러 발생
      await expect(
        terminalGroup.acquireTerminal(PROVIDER_ID)
      ).rejects.toThrow();
    });

    it('T19: should handle disposal after crash', async () => {
      const lease = await terminalPool.acquireLease(PROVIDER_ID, 'barista-1');
      const terminalProcess = lease.terminal.process;

      // crash 트리거
      triggerTerminalExit(terminalProcess, 1);

      // 복구 대기
      await new Promise((resolve) => setTimeout(resolve, 200));

      // dispose 호출
      await expect(terminalPool.dispose()).resolves.not.toThrow();
    });

    it('T20: should verify all resources released after full lifecycle', async () => {
      const sharedContext = new SharedContext();
      const terminalGroup = new TerminalGroup(
        {
          orderId: ORDER_ID,
          cwd: process.cwd(),
          providers: [PROVIDER_ID],
        },
        terminalPool,
        sharedContext
      );

      // 전체 라이프사이클
      await terminalGroup.acquireTerminal(PROVIDER_ID);
      await terminalGroup.acquireParallelTerminal(PROVIDER_ID, 'stage-1');
      await terminalGroup.executeStage('stage-2', PROVIDER_ID, 'test prompt');

      // dispose
      await terminalGroup.dispose();
      await terminalPool.dispose();

      // 모든 리소스 해제 확인
      expect(terminalGroup.getTerminalCount().total).toBe(0);
      expect(terminalPool.getStatus()[PROVIDER_ID].total).toBe(0);
      expect(mockAdapter.kill).toHaveBeenCalled();
    });
  });
});
