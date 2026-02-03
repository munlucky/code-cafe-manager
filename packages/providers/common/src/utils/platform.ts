import { platform } from 'os';

/**
 * Platform 유틸리티
 * 플랫폼 감지 로직을 중앙 집중화
 */
export const Platform = {
  isWindows(): boolean {
    return platform() === 'win32';
  },

  isMac(): boolean {
    return platform() === 'darwin';
  },

  isLinux(): boolean {
    return platform() === 'linux';
  },

  getShell(): string {
    return this.isWindows() ? 'powershell.exe' : 'bash';
  },

  getLineEnding(): string {
    return this.isWindows() ? '\r' : '\n';
  },

  getCommandCheck(): string {
    return this.isWindows() ? 'where' : 'which';
  },

  getExecutableExtension(): string {
    return this.isWindows() ? '.exe' : '';
  },
} as const;
