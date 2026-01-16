/**
 * UI types for Electron integration
 *
 * These types define the interface between the orchestrator backend
 * and the Electron frontend for workflow visualization and control.
 */

export interface WorkflowInfo {
  id: string;
  name: string;
  description?: string;
  stages: string[];
}

export interface StageProfileInfo {
  stage: string;
  profileId: string;
  profileName: string;
  nodeCount: number;
}

export interface RunProgress {
  runId: string;
  workflowId: string;
  currentStage: string;
  currentIter: number;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  createdAt?: string;
  updatedAt?: string;
  stages: Array<{
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    startTime?: string;
    endTime?: string;
  }>;
  completedNodes: string[];
  lastError?: string;
}

export interface RunLogEntry {
  type: string;
  message: string;
  timestamp: string;
  stage?: string;
  nodeId?: string;
}

export interface ProviderAssignmentInfo {
  stage: string;
  provider: string;
  role: string;
  profile: string;
}

/**
 * IPC Messages for Electron
 */
export interface ElectronIPCMessages {
  // Workflow management
  'workflow:list': () => Promise<WorkflowInfo[]>;
  'workflow:get': (id: string) => Promise<WorkflowInfo | null>;
  'workflow:run': (id: string, options?: { mode?: string; interactive?: boolean }) => Promise<string>; // returns runId

  // Run management
  'run:list': () => Promise<RunProgress[]>;
  'run:status': (runId: string) => Promise<RunProgress | null>;
  'run:resume': (runId: string) => Promise<void>;
  'run:cancel': (runId: string) => Promise<void>;
  'run:logs': (runId: string) => Promise<RunLogEntry[]>;

  // Configuration
  'config:assignments:get': () => Promise<ProviderAssignmentInfo[]>;
  'config:assignments:set': (stage: string, provider: string, role: string) => Promise<void>;
  'config:profiles:list': (stage: string) => Promise<string[]>;
  'config:profiles:set': (stage: string, profile: string) => Promise<void>;
  'config:roles:list': () => Promise<string[]>;

  // Real-time updates
  'run:subscribe': (runId: string) => Promise<void>;
  'run:unsubscribe': (runId: string) => Promise<void>;
}

/**
 * Event emitters for real-time updates
 */
export interface ElectronEventEmitters {
  'run:progress': (runId: string, progress: RunProgress) => void;
  'run:log': (runId: string, log: { type: string; message: string; timestamp: string }) => void;
  'run:complete': (runId: string, status: 'completed' | 'failed') => void;
}
