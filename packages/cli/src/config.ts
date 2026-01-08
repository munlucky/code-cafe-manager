import { homedir } from 'os';
import { join } from 'path';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

/**
 * CodeCafe 전역 설정 관리
 */

export interface CodeCafeConfig {
  version: string;
  defaultProvider: string;
  defaultMenu: string;
  menuSources: MenuSource[];
  maxBaristas: number;
}

export interface MenuSource {
  name: string;
  type: 'github' | 'local' | 'url';
  source: string;
}

const DEFAULT_CONFIG: CodeCafeConfig = {
  version: '0.1.0',
  defaultProvider: 'claude-code',
  defaultMenu: 'pm-agent',
  menuSources: [
    {
      name: 'pm-agent',
      type: 'github',
      source: 'https://github.com/munlucky/claude-settings/blob/main/.claude/agents/pm-agent.md',
    },
  ],
  maxBaristas: 4,
};

export class ConfigManager {
  private configDir: string;
  private configPath: string;

  constructor() {
    this.configDir = join(homedir(), '.codecafe');
    this.configPath = join(this.configDir, 'config.json');
  }

  /**
   * 설정 디렉토리 초기화
   */
  async init(): Promise<void> {
    if (!existsSync(this.configDir)) {
      await mkdir(this.configDir, { recursive: true });
    }

    if (!existsSync(this.configPath)) {
      await this.saveConfig(DEFAULT_CONFIG);
    }

    // 로그 디렉토리 생성
    const logsDir = join(this.configDir, 'logs');
    if (!existsSync(logsDir)) {
      await mkdir(logsDir, { recursive: true });
    }

    // 데이터 디렉토리 생성
    const dataDir = join(this.configDir, 'data');
    if (!existsSync(dataDir)) {
      await mkdir(dataDir, { recursive: true });
    }
  }

  /**
   * 설정 로드
   */
  async loadConfig(): Promise<CodeCafeConfig> {
    if (!existsSync(this.configPath)) {
      return DEFAULT_CONFIG;
    }

    const content = await readFile(this.configPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * 설정 저장
   */
  async saveConfig(config: CodeCafeConfig): Promise<void> {
    await writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  /**
   * 설정 경로 반환
   */
  getConfigDir(): string {
    return this.configDir;
  }

  getLogsDir(): string {
    return join(this.configDir, 'logs');
  }

  getDataDir(): string {
    return join(this.configDir, 'data');
  }
}
