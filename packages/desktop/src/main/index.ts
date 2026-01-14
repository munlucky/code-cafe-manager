import { app, BrowserWindow, ipcMain } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import dotenv from 'dotenv';
import { Orchestrator } from '@codecafe/core';
import { registerElectronHandlers } from '@codecafe/orchestrator';

import { registerCafeHandlers } from './ipc/cafe.js';
import { registerRoleIpcHandlers } from './ipc/role.js';
import { registerTerminalHandlers } from './ipc/terminal.js';
import { registerWorktreeHandlers } from './ipc/worktree.js';
import { registerProviderHandlers } from './ipc/provider.js';
import { registerOrchestratorHandlers } from './ipc/orchestrator.js';

import { existsSync } from 'fs';

// Initialization
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

let mainWindow: BrowserWindow | null = null;
let orchestrator: Orchestrator | null = null;

/**
 * Resolve the directory for Orchestrator data
 */
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

/**
 * Create the main application window
 */
async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    const port = process.env.RENDERER_PORT || '8081';
    const url = process.env.RENDERER_URL || `http://localhost:${port}`;
    await mainWindow.loadURL(url);
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Initialize and start the Orchestrator
 */
async function initOrchestrator(): Promise<void> {
  const codecafeDir = join(homedir(), '.codecafe');
  const dataDir = join(codecafeDir, 'data');
  const logsDir = join(codecafeDir, 'logs');

  orchestrator = new Orchestrator(dataDir, logsDir, 4);
  await orchestrator.init();
  orchestrator.start();

  // Forward Orchestrator events to the renderer
  const events = ['barista:event', 'order:event', 'order:assigned', 'order:completed'];
  for (const event of events) {
    orchestrator.on(event, (data) => {
      mainWindow?.webContents.send(event, data);
    });
  }
}

/**
 * Set up all IPC handlers
 */
function setupIpcHandlers(): void {
  const orchDir = resolveOrchDir();

  registerCafeHandlers();
  registerRoleIpcHandlers();
  registerTerminalHandlers();
  registerWorktreeHandlers();
  registerProviderHandlers();

  if (orchestrator) {
    registerOrchestratorHandlers(orchestrator);
  }

  registerElectronHandlers(ipcMain, orchDir);
}

// Application Lifecycle
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
    orchestrator?.stop();
    app.quit();
  }
});

app.on('will-quit', () => {
  orchestrator?.stop();
});
