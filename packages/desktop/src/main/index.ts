import { app, BrowserWindow, ipcMain } from 'electron';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import dotenv from 'dotenv';
import { Orchestrator } from '@codecafe/core';

import { registerCafeHandlers } from './ipc/cafe.js';
import { registerRoleIpcHandlers } from './ipc/role.js';
import { registerTerminalHandlers } from './ipc/terminal.js';
import { registerWorktreeHandlers } from './ipc/worktree.js';
import { registerProviderHandlers } from './ipc/provider.js';
import { registerOrchestratorHandlers } from './ipc/orchestrator.js';
import { registerOrderHandlers, cleanupOrderHandlers } from './ipc/order.js';
import { registerWorkflowHandlers } from './ipc/workflow.js';
import { registerSkillHandlers } from './ipc/skill.js';

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
        console.log(`[Main] Dev server is ready at ${url}`);
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

  const isDev = !app.isPackaged;
  console.log(`[Main] isDev: ${isDev}, app.isPackaged: ${app.isPackaged}`);

  if (isDev) {
    const port = process.env.RENDERER_PORT || '8081';
    const url = process.env.RENDERER_URL || `http://localhost:${port}`;
    console.log(`[Main] Waiting for dev server at ${url}...`);
    await waitForDevServer(url);
    console.log(`[Main] Loading renderer from ${url}`);
    await mainWindow.loadURL(url);
  } else {
    // In production, files are relative to the app root
    const indexPath = join(__dirname, '../../renderer/index.html');
    console.log(`[Main] Loading renderer from file: ${indexPath}`);
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
  console.log('[Main] Initializing orchestrator...');
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
  console.log('[Main] Orchestrator initialized.');
}

/**
 * Set up all IPC handlers
 */
function setupIpcHandlers(): void {
  console.log('[Main] Setting up IPC handlers...');
  const orchDir = resolveOrchDir();

  registerCafeHandlers();
  registerRoleIpcHandlers();
  registerTerminalHandlers();
  registerWorktreeHandlers();
  registerProviderHandlers();
  registerWorkflowHandlers();
  registerSkillHandlers();

  if (orchestrator) {
    registerOrchestratorHandlers(orchestrator);
    registerOrderHandlers(orchestrator);
  }

  // Note: registerElectronHandlers removed to avoid duplicate handler registration
  // Workflow handlers are now registered via registerWorkflowHandlers
  // TODO: Add run handlers if needed
  console.log('[Main] IPC handlers set up.');
}

// Application Lifecycle
app.whenReady().then(async () => {
  console.log('[Main] App is ready.');
  await initOrchestrator();
  setupIpcHandlers();
  await createWindow();
  console.log('[Main] Window created.');

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
  if (orchestrator) {
    await orchestrator.stop();
  }
  app.quit();
});
