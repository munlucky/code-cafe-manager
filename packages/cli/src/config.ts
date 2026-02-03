import { homedir } from 'os';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';

/**
 * CLI 설정 중앙 관리
 * 환경 변수 및 기본값을 통합
 */
export const CONFIG = {
  /**
   * 설정 디렉토리 경로
   */
  get dir(): string {
    return process.env.CODECAFE_CONFIG_DIR || join(homedir(), '.codecafe');
  },

  /**
   * 데이터 디렉토리 경로
   */
  get dataDir(): string {
    return process.env.CODECAFE_DATA_DIR || join(this.dir, 'data');
  },

  /**
   * 로그 디렉토리 경로
   */
  get logsDir(): string {
    return process.env.CODECAFE_LOGS_DIR || join(this.dir, 'logs');
  },

  /**
   * 기본 Provider
   */
  get defaultProvider(): string {
    return process.env.CODECAFE_DEFAULT_PROVIDER || 'claude-code';
  },

  /**
   * Orchestrator 디렉토리
   */
  get orchDir(): string {
    return '.orch';
  },
} as const;

/**
 * 설정 디렉토리 초기화 (없으면 생성)
 */
export async function ensureConfigDir(): Promise<string> {
  const configDir = CONFIG.dir;
  if (!existsSync(configDir)) {
    await mkdir(configDir, { recursive: true });
  }
  return configDir;
}

/**
 * 모든 필수 디렉토리 초기화
 */
export async function ensureAllDirs(): Promise<void> {
  const dirs = [CONFIG.dir, CONFIG.dataDir, CONFIG.logsDir];

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }
}
