# IPC/UI API Contracts (NEW - Gap 3 해결)

#### 2.5.1 Complete IPC API Specification

**파일**: `packages/desktop/src/main/ipc/role.ts`

```typescript
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import { RoleRegistry } from '@codecafe/orchestrator/role';
import { Role } from '@codecafe/core/types';

// Zod schemas for request/response validation
const RoleIdSchema = z.string().min(1);

const RoleCreateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  systemPrompt: z.string().min(1),
  skills: z.array(z.string()),
  recommendedProvider: z.string(),
  variables: z.array(z.object({
    name: z.string(),
    type: z.enum(['string', 'number', 'boolean']),
    required: z.boolean(),
    default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  })).optional(),
});

// Error codes enum
export enum RoleErrorCode {
  NOT_FOUND = 'ROLE_NOT_FOUND',
  VALIDATION_FAILED = 'ROLE_VALIDATION_FAILED',
  ALREADY_EXISTS = 'ROLE_ALREADY_EXISTS',
  PARSE_ERROR = 'ROLE_PARSE_ERROR',
  UNKNOWN = 'ROLE_UNKNOWN_ERROR',
}

// Error response type
interface ErrorResponse {
  success: false;
  error: {
    code: RoleErrorCode;
    message: string;
    details?: any;
  };
}

// Success response types
interface SuccessResponse<T = void> {
  success: true;
  data?: T;
}

type IpcResponse<T = void> = SuccessResponse<T> | ErrorResponse;

export function registerRoleHandlers() {
  const registry = new RoleRegistry();
  let loaded = false;

  // Ensure registry is loaded
  async function ensureLoaded() {
    if (!loaded) {
      await registry.load();
      loaded = true;
    }
  }

  // role:list - Get all roles
  ipcMain.handle('role:list', async (): Promise<IpcResponse<Role[]>> => {
    try {
      await ensureLoaded();
      const roles = registry.list();
      return { success: true, data: roles };
    } catch (error) {
      return {
        success: false,
        error: {
          code: RoleErrorCode.UNKNOWN,
          message: (error as Error).message,
        },
      };
    }
  });

  // role:get - Get role by ID
  ipcMain.handle('role:get', async (event: IpcMainInvokeEvent, id: string): Promise<IpcResponse<Role>> => {
    try {
      const validId = RoleIdSchema.parse(id);
      await ensureLoaded();

      const role = registry.get(validId);
      if (!role) {
        return {
          success: false,
          error: {
            code: RoleErrorCode.NOT_FOUND,
            message: `Role with id '${validId}' not found`,
          },
        };
      }

      return { success: true, data: role };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: {
            code: RoleErrorCode.VALIDATION_FAILED,
            message: 'Invalid role ID',
            details: error.errors,
          },
        };
      }

      return {
        success: false,
        error: {
          code: RoleErrorCode.UNKNOWN,
          message: (error as Error).message,
        },
      };
    }
  });

  // role:list-default - Get default roles
  ipcMain.handle('role:list-default', async (): Promise<IpcResponse<Role[]>> => {
    try {
      await ensureLoaded();
      const roles = registry.listDefault();
      return { success: true, data: roles };
    } catch (error) {
      return {
        success: false,
        error: {
          code: RoleErrorCode.UNKNOWN,
          message: (error as Error).message,
        },
      };
    }
  });

  // role:list-user - Get user-defined roles
  ipcMain.handle('role:list-user', async (): Promise<IpcResponse<Role[]>> => {
    try {
      await ensureLoaded();
      const roles = registry.listUser();
      return { success: true, data: roles };
    } catch (error) {
      return {
        success: false,
        error: {
          code: RoleErrorCode.UNKNOWN,
          message: (error as Error).message,
        },
      };
    }
  });

  // role:reload - Reload roles from disk
  ipcMain.handle('role:reload', async (): Promise<IpcResponse<void>> => {
    try {
      await registry.load();
      loaded = true;
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          code: RoleErrorCode.UNKNOWN,
          message: `Failed to reload roles: ${(error as Error).message}`,
        },
      };
    }
  });
}
```

**파일**: `packages/desktop/src/main/ipc/terminal.ts`

```typescript
import { ipcMain, IpcMainInvokeEvent, WebContents } from 'electron';
import { z } from 'zod';
import { TerminalPool } from '@codecafe/orchestrator/terminal';
import { TerminalPoolConfigSchema } from '@codecafe/core/schema';
import { TerminalPoolConfig, PoolStatus } from '@codecafe/core/types';

export enum TerminalErrorCode {
  NOT_INITIALIZED = 'TERMINAL_NOT_INITIALIZED',
  NOT_FOUND = 'TERMINAL_NOT_FOUND',
  VALIDATION_FAILED = 'TERMINAL_VALIDATION_FAILED',
  POOL_SHUTDOWN = 'TERMINAL_POOL_SHUTDOWN',
  UNKNOWN = 'TERMINAL_UNKNOWN_ERROR',
}

interface ErrorResponse {
  success: false;
  error: {
    code: TerminalErrorCode;
    message: string;
    details?: any;
  };
}

interface SuccessResponse<T = void> {
  success: true;
  data?: T;
}

type IpcResponse<T = void> = SuccessResponse<T> | ErrorResponse;

let pool: TerminalPool | null = null;
const subscribedTerminals = new Set<string>();

export function registerTerminalHandlers() {
  // terminal:init - Initialize terminal pool
  ipcMain.handle('terminal:init', async (event: IpcMainInvokeEvent, config: unknown): Promise<IpcResponse<void>> => {
    try {
      const validConfig = TerminalPoolConfigSchema.parse(config) as TerminalPoolConfig;

      if (pool) {
        await pool.shutdown();
      }

      pool = new TerminalPool(validConfig);
      subscribedTerminals.clear();

      return { success: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: {
            code: TerminalErrorCode.VALIDATION_FAILED,
            message: 'Invalid terminal pool configuration',
            details: error.errors,
          },
        };
      }

      return {
        success: false,
        error: {
          code: TerminalErrorCode.UNKNOWN,
          message: (error as Error).message,
        },
      };
    }
  });

  // terminal:pool-status - Get pool status
  ipcMain.handle('terminal:pool-status', async (): Promise<IpcResponse<PoolStatus>> => {
    if (!pool) {
      return {
        success: false,
        error: {
          code: TerminalErrorCode.NOT_INITIALIZED,
          message: 'Terminal pool not initialized',
        },
      };
    }

    try {
      const status = pool.getStatus();
      return { success: true, data: status };
    } catch (error) {
      return {
        success: false,
        error: {
          code: TerminalErrorCode.UNKNOWN,
          message: (error as Error).message,
        },
      };
    }
  });

  // terminal:subscribe - Subscribe to terminal data stream
  ipcMain.handle('terminal:subscribe', async (event: IpcMainInvokeEvent, terminalId: string): Promise<IpcResponse<void>> => {
    if (!pool) {
      return {
        success: false,
        error: {
          code: TerminalErrorCode.NOT_INITIALIZED,
          message: 'Terminal pool not initialized',
        },
      };
    }

    try {
      const terminal = pool.getTerminal(terminalId);
      if (!terminal) {
        return {
          success: false,
          error: {
            code: TerminalErrorCode.NOT_FOUND,
            message: `Terminal ${terminalId} not found`,
          },
        };
      }

      if (subscribedTerminals.has(terminalId)) {
        return { success: true }; // Already subscribed
      }

      // Forward terminal data to renderer
      pool.on('terminal:data', (id: string, data: string) => {
        if (id === terminalId) {
          event.sender.send(`terminal:data:${terminalId}`, data);
        }
      });

      subscribedTerminals.add(terminalId);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          code: TerminalErrorCode.UNKNOWN,
          message: (error as Error).message,
        },
      };
    }
  });

  // terminal:unsubscribe - Unsubscribe from terminal data stream
  ipcMain.handle('terminal:unsubscribe', async (event: IpcMainInvokeEvent, terminalId: string): Promise<IpcResponse<void>> => {
    subscribedTerminals.delete(terminalId);
    return { success: true };
  });

  // terminal:shutdown - Shutdown pool
  ipcMain.handle('terminal:shutdown', async (): Promise<IpcResponse<void>> => {
    if (!pool) {
      return { success: true }; // Already shutdown
    }

    try {
      await pool.shutdown();
      pool = null;
      subscribedTerminals.clear();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          code: TerminalErrorCode.UNKNOWN,
          message: (error as Error).message,
        },
      };
    }
  });
}
```

#### 2.5.2 Preload API Surface

**파일**: `packages/desktop/src/preload/index.ts`

```typescript
import { contextBridge, ipcRenderer } from 'electron';
import { Role, TerminalPoolConfig, PoolStatus } from '@codecafe/core/types';

interface IpcResponse<T = void> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

contextBridge.exposeInMainWorld('api', {
  // ... existing APIs

  role: {
    list: (): Promise<IpcResponse<Role[]>> => ipcRenderer.invoke('role:list'),
    get: (id: string): Promise<IpcResponse<Role>> => ipcRenderer.invoke('role:get', id),
    listDefault: (): Promise<IpcResponse<Role[]>> => ipcRenderer.invoke('role:list-default'),
    listUser: (): Promise<IpcResponse<Role[]>> => ipcRenderer.invoke('role:list-user'),
    reload: (): Promise<IpcResponse<void>> => ipcRenderer.invoke('role:reload'),
  },

  terminal: {
    init: (config: TerminalPoolConfig): Promise<IpcResponse<void>> => ipcRenderer.invoke('terminal:init', config),
    getStatus: (): Promise<IpcResponse<PoolStatus>> => ipcRenderer.invoke('terminal:pool-status'),
    subscribe: (terminalId: string): Promise<IpcResponse<void>> => ipcRenderer.invoke('terminal:subscribe', terminalId),
    unsubscribe: (terminalId: string): Promise<IpcResponse<void>> => ipcRenderer.invoke('terminal:unsubscribe', terminalId),
    shutdown: (): Promise<IpcResponse<void>> => ipcRenderer.invoke('terminal:shutdown'),
    onData: (terminalId: string, callback: (data: string) => void): (() => void) => {
      const channel = `terminal:data:${terminalId}`;
      const listener = (event: any, data: string) => callback(data);
      ipcRenderer.on(channel, listener);
      // Return unsubscribe function
      return () => ipcRenderer.removeListener(channel, listener);
    },
  },
});
```

#### 2.5.3 Window Type Definitions

**파일**: `packages/desktop/src/renderer/types/window.d.ts`

```typescript
import { Role, TerminalPoolConfig, PoolStatus } from '@codecafe/core/types';

interface IpcResponse<T = void> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

declare global {
  interface Window {
    api: {
      // ... existing APIs

      role: {
        list: () => Promise<IpcResponse<Role[]>>;
        get: (id: string) => Promise<IpcResponse<Role>>;
        listDefault: () => Promise<IpcResponse<Role[]>>;
        listUser: () => Promise<IpcResponse<Role[]>>;
        reload: () => Promise<IpcResponse<void>>;
      };

      terminal: {
        init: (config: TerminalPoolConfig) => Promise<IpcResponse<void>>;
        getStatus: () => Promise<IpcResponse<PoolStatus>>;
        subscribe: (terminalId: string) => Promise<IpcResponse<void>>;
        unsubscribe: (terminalId: string) => Promise<IpcResponse<void>>;
        shutdown: () => Promise<IpcResponse<void>>;
        onData: (terminalId: string, callback: (data: string) => void) => () => void;
      };
    };
  }
}
```

#### 2.5.4 Error Handling Example (Renderer)

```typescript
// packages/desktop/src/renderer/store/useRoleStore.ts
import { create } from 'zustand';
import { Role } from '@codecafe/core/types';

interface RoleStore {
  roles: Role[];
  loading: boolean;
  error: string | null;
  loadRoles: () => Promise<void>;
}

export const useRoleStore = create<RoleStore>((set) => ({
  roles: [],
  loading: false,
  error: null,

  loadRoles: async () => {
    set({ loading: true, error: null });

    const response = await window.api.role.list();

    if (!response.success) {
      set({
        loading: false,
        error: `Failed to load roles: ${response.error.message} (${response.error.code})`,
      });
      return;
    }

    set({ roles: response.data, loading: false });
  },
}));
```

---

**다음 문서:** [05-backward-compatibility.md](05-backward-compatibility.md) - Backward Compatibility & Migration