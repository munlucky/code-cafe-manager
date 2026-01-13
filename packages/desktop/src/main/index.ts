import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Orchestrator } from '@codecafe/core';
import { registerElectronHandlers } from '@codecafe/orchestrator';
import { homedir } from 'os';
import { WorktreeManager } from '@codecafe/git-worktree';
import { promises as fs, existsSync } from 'fs';
import * as YAML from 'yaml';
import dotenv from 'dotenv';
import { registerCafeHandlers } from './ipc/cafe.js';
import { registerRoleIpcHandlers } from './ipc/role.js';
import { registerTerminalHandlers } from './ipc/terminal.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

let mainWindow: BrowserWindow | null = null;
let orchestrator: Orchestrator | null = null;

function resolveOrchDir(): string {
  const envDir = process.env.CODECAFE_ORCH_DIR;
  if (envDir && existsSync(envDir)) {
    return envDir;
  }

  const candidates = [
    process.cwd(),
    app.getAppPath(),
    join(app.getAppPath(), '..'),
    join(app.getAppPath(), '..', '..'),
  ];

  for (const base of candidates) {
    const candidate = join(base, '.orch');
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return join(process.cwd(), '.orch');
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 개발 모드에서는 DevTools 자동 열기
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  // HTML 로드
  // Development: webpack dev server
  // Production: built HTML
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    const devServerPort = process.env.RENDERER_PORT || '8081';
    const devServerUrl =
      process.env.RENDERER_URL || `http://localhost:${devServerPort}`;
    await mainWindow.loadURL(devServerUrl);
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function initOrchestrator() {
  const codecafeDir = join(homedir(), '.codecafe');
  const dataDir = join(codecafeDir, 'data');
  const logsDir = join(codecafeDir, 'logs');

  orchestrator = new Orchestrator(dataDir, logsDir, 4);
  await orchestrator.init();
  orchestrator.start();

  // Orchestrator 이벤트를 렌더러로 전달
  orchestrator.on('barista:event', (event) => {
    mainWindow?.webContents.send('barista:event', event);
  });

  orchestrator.on('order:event', (event) => {
    mainWindow?.webContents.send('order:event', event);
  });

  orchestrator.on('order:assigned', (data) => {
    mainWindow?.webContents.send('order:assigned', data);
  });

  orchestrator.on('order:completed', (data) => {
    mainWindow?.webContents.send('order:completed', data);
  });
}

// IPC Handlers
function setupIpcHandlers() {
  const orchDir = resolveOrchDir();

  // Phase 1: Cafe Registry handlers
  registerCafeHandlers();

  // Phase 2: Role and Terminal handlers
  registerRoleIpcHandlers();
  registerTerminalHandlers();

  // 바리스타 생성
  ipcMain.handle('createBarista', async (_, provider: string) => {
    if (!orchestrator) throw new Error('Orchestrator not initialized');
    const barista = orchestrator.createBarista(provider as any);
    return barista;
  });

  // 주문 생성
  ipcMain.handle('createOrder', async (_, params) => {
    if (!orchestrator) throw new Error('Orchestrator not initialized');
    const order = orchestrator.createOrder(
      params.workflowId,
      params.workflowName,
      params.counter,
      params.provider,
      params.vars
    );
    return order;
  });

  // 상태 조회
  ipcMain.handle('getAllBaristas', async () => {
    if (!orchestrator) throw new Error('Orchestrator not initialized');
    return orchestrator.getAllBaristas();
  });

  ipcMain.handle('getAllOrders', async () => {
    if (!orchestrator) throw new Error('Orchestrator not initialized');
    return orchestrator.getAllOrders();
  });

  ipcMain.handle('getOrder', async (_, orderId: string) => {
    if (!orchestrator) throw new Error('Orchestrator not initialized');
    return orchestrator.getOrder(orderId);
  });

  ipcMain.handle('getOrderLog', async (_, orderId: string) => {
    if (!orchestrator) throw new Error('Orchestrator not initialized');
    return await orchestrator.getOrderLog(orderId);
  });

  ipcMain.handle('getReceipts', async () => {
    if (!orchestrator) throw new Error('Orchestrator not initialized');
    return await orchestrator.getReceipts();
  });

  // 주문 취소
  ipcMain.handle('cancelOrder', async (_, orderId: string) => {
    if (!orchestrator) throw new Error('Orchestrator not initialized');
    await orchestrator.cancelOrder(orderId);
  });

  // Provider 관리 (M2)
  ipcMain.handle('getAvailableProviders', async () => {
    // M2: claude-code, codex 지원
    return [
      { id: 'claude-code', name: 'Claude Code' },
      { id: 'codex', name: 'Codex' },
    ];
  });

  // Worktree 관리 (M2)
  ipcMain.handle('listWorktrees', async (_, repoPath: string) => {
    try {
      const worktrees = await WorktreeManager.listWorktrees(repoPath);
      return { success: true, data: worktrees };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(
    'exportPatch',
    async (_, worktreePath: string, baseBranch: string, outputPath?: string) => {
      try {
        const patchPath = await WorktreeManager.exportPatch({
          worktreePath,
          baseBranch,
          outputPath,
        });
        return { success: true, data: patchPath };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }
  );

  ipcMain.handle('removeWorktree', async (_, worktreePath: string, force?: boolean) => {
    try {
      await WorktreeManager.removeWorktree({ worktreePath, force });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('openWorktreeFolder', async (_, worktreePath: string) => {
    try {
      await shell.openPath(worktreePath);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });


  registerElectronHandlers(ipcMain, orchDir);
}

app.whenReady().then(async () => {
  await initOrchestrator();
  setupIpcHandlers();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (orchestrator) {
      orchestrator.stop();
    }
    app.quit();
  }
});

app.on('will-quit', () => {
  if (orchestrator) {
    orchestrator.stop();
  }
});
