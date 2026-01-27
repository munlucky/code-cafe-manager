import { app, BrowserWindow, ipcMain } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import dotenv from 'dotenv';
import { Orchestrator, createLogger } from '@codecafe/core';

const logger = createLogger({ context: 'Main' });

import { registerCafeHandlers } from './ipc/cafe.js';
import { registerTerminalHandlers } from './ipc/terminal.js';
import { registerWorktreeHandlers } from './ipc/worktree.js';
import { registerProviderHandlers } from './ipc/provider.js';
import { registerOrchestratorHandlers } from './ipc/orchestrator.js';
import { registerOrderHandlers, cleanupOrderHandlers } from './ipc/order.js';
import { registerWorkflowHandlers } from './ipc/workflow.js';
import { registerSkillHandlers } from './ipc/skill.js';
import { registerDialogHandlers } from './ipc/dialog.js';
import { registerSystemHandlers } from './ipc/system.js';
import { initExecutionManager, cleanupExecutionManager, getExecutionManager } from './execution-manager.js';
import { setupMainProcessLogger } from './file-logger.js';

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
 * Wait for webpack dev server to be ready
 */
async function waitForDevServer(url: string, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        logger.info(`Dev server is ready at ${url}`);
        return;
      }
    } catch (error) {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`Dev server at ${url} did not become ready`);
}

/**
 * Create the main application window
 */
async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  const isDev = !app.isPackaged;
  logger.info(`isDev: ${isDev}, app.isPackaged: ${app.isPackaged}`);

  if (isDev) {
    const port = process.env.RENDERER_PORT || '8081';
    const url = process.env.RENDERER_URL || `http://localhost:${port}`;
    logger.info(`Waiting for dev server at ${url}...`);
    await waitForDevServer(url);
    logger.info(`Loading renderer from ${url}`);
    await mainWindow.loadURL(url);
  } else {
    // In production, files are relative to the app root
    const indexPath = join(__dirname, '../../renderer/index.html');
    logger.info(`Loading renderer from file: ${indexPath}`);
    await mainWindow.loadFile(indexPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Initialize and start the Orchestrator
 */
async function initOrchestrator(): Promise<void> {
  logger.info('Initializing orchestrator...');
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
  logger.info('Orchestrator initialized.');

  // ExecutionManager 초기화 (BaristaEngineV2 연동)
  try {
    await initExecutionManager(orchestrator, mainWindow);
    logger.info('ExecutionManager initialized.');
  } catch (error) {
    logger.error('Failed to initialize ExecutionManager', { error: error instanceof Error ? error.message : String(error) });
    // ExecutionManager 초기화 실패해도 앱은 계속 실행
  }
}

/**
 * Set up all IPC handlers
 */
function setupIpcHandlers(): void {
  logger.info('Setting up IPC handlers...');
  const orchDir = resolveOrchDir();

  registerCafeHandlers();
  registerTerminalHandlers();
  registerWorktreeHandlers();
  registerProviderHandlers();
  registerWorkflowHandlers();
  registerSkillHandlers();
  registerDialogHandlers();
  registerSystemHandlers();

  if (orchestrator) {
    registerOrchestratorHandlers(orchestrator);
    registerOrderHandlers(orchestrator);
  }

  // Note: registerElectronHandlers removed to avoid duplicate handler registration
  // Workflow handlers are now registered via registerWorkflowHandlers
  // TODO: Add run handlers if needed
  logger.info('IPC handlers set up.');
}

// Application Lifecycle
// 파일 로거를 가장 먼저 설정 (모든 console.log가 파일에 기록되도록)
setupMainProcessLogger();

app.whenReady().then(async () => {
  logger.info('App is ready.');
  await initOrchestrator();
  setupIpcHandlers();
  await createWindow();
  logger.info('Window created.');

  // ExecutionManager에 mainWindow 참조 업데이트
  const execManager = getExecutionManager();
  if (execManager) {
    execManager.setMainWindow(mainWindow);
  }

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

let isQuitting = false;

app.on('will-quit', async (event) => {
  if (isQuitting) {
    return;
  }
  event.preventDefault();
  isQuitting = true;
  cleanupOrderHandlers();
  await cleanupExecutionManager();
  if (orchestrator) {
    await orchestrator.stop();
  }
  app.quit();
});
