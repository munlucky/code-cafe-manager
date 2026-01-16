import { useState, useEffect, type ReactElement } from 'react';
import { X, Pause, Play, RotateCcw, AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import type { RunStatus, StageStatus, WorkflowRunDetail, RunLogEntry } from '../../types/models';

interface RunMonitorProps {
  runId: string;
  workflowId: string;
  onClose: () => void;
}

// Status icons
const StatusIcon: Record<RunStatus, ReactElement> = {
  pending: <Clock className="w-4 h-4 text-gray-400" />,
  running: <Loader2 className="w-4 h-4 text-coffee animate-spin" />,
  paused: <Pause className="w-4 h-4 text-yellow-500" />,
  completed: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  failed: <AlertCircle className="w-4 h-4 text-red-500" />,
  cancelled: <X className="w-4 h-4 text-gray-500" />,
};

const StageStatusIcon: Record<StageStatus, ReactElement> = {
  pending: <Clock className="w-3 h-3 text-gray-500" />,
  running: <Loader2 className="w-3 h-3 text-coffee animate-spin" />,
  completed: <CheckCircle2 className="w-3 h-3 text-green-500" />,
  failed: <AlertCircle className="w-3 h-3 text-red-500" />,
  skipped: <Pause className="w-3 h-3 text-gray-500" />,
};

const StageStatusColor: Record<StageStatus, string> = {
  pending: 'bg-gray-700',
  running: 'bg-coffee',
  completed: 'bg-green-600',
  failed: 'bg-red-600',
  skipped: 'bg-gray-600',
};

export function RunMonitor({ runId, workflowId, onClose }: RunMonitorProps): ReactElement | null {
  const [runDetail, setRunDetail] = useState<WorkflowRunDetail | null>(null);
  const [logs, setLogs] = useState<RunLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Load run detail
  const loadRunDetail = async () => {
    try {
      const response = await window.codecafe.run.getDetail(runId);
      if (response.success && response.data) {
        setRunDetail(response.data);
      }
    } catch (err) {
      console.error('[RunMonitor] Failed to load run detail:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load logs
  const loadLogs = async () => {
    try {
      const response = await window.codecafe.run.getLogs(runId);
      if (response.success && response.data) {
        setLogs(response.data);
      }
    } catch (err) {
      console.error('[RunMonitor] Failed to load logs:', err);
    }
  };

  useEffect(() => {
    loadRunDetail();
    loadLogs();

    // Subscribe to run events
    const unsubscribe = window.codecafe.run.onEvent((event) => {
      if (event.runId === runId) {
        loadRunDetail();
        loadLogs();
      }
    });

    return unsubscribe;
  }, [runId]);

  // Poll for updates when running
  useEffect(() => {
    if (runDetail?.status === 'running') {
      const interval = setInterval(() => {
        loadRunDetail();
        loadLogs();
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [runDetail?.status]);

  const handlePause = async () => {
    setActionLoading(true);
    try {
      await window.codecafe.run.pause(runId);
      await loadRunDetail();
    } catch (err) {
      console.error('[RunMonitor] Failed to pause:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    setActionLoading(true);
    try {
      await window.codecafe.run.resume(runId);
      await loadRunDetail();
    } catch (err) {
      console.error('[RunMonitor] Failed to resume:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this run?')) return;
    setActionLoading(true);
    try {
      await window.codecafe.run.cancel(runId);
      await loadRunDetail();
    } catch (err) {
      console.error('[RunMonitor] Failed to cancel:', err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-coffee animate-spin" />
      </div>
    );
  }

  if (!runDetail) {
    return (
      <div className="p-6 text-center text-gray-400">
        Run not found
      </div>
    );
  }

  const isTerminal = ['completed', 'failed', 'cancelled'].includes(runDetail.status);
  const stageEntries = Object.entries(runDetail.stageResults || {});

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {StatusIcon[runDetail.status]}
          <div>
            <h2 className="font-semibold text-bone">{workflowId}</h2>
            <p className="text-xs text-gray-400">Run: {runId.slice(0, 8)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isTerminal && runDetail.status === 'running' && (
            <Button size="sm" variant="secondary" onClick={handlePause} disabled={actionLoading}>
              <Pause className="w-3 h-3 mr-1" />
              Pause
            </Button>
          )}
          {!isTerminal && runDetail.status === 'paused' && (
            <Button size="sm" variant="secondary" onClick={handleResume} disabled={actionLoading}>
              <Play className="w-3 h-3 mr-1" />
              Resume
            </Button>
          )}
          {!isTerminal && (
            <Button size="sm" variant="ghost" onClick={handleCancel} disabled={actionLoading}>
              <X className="w-3 h-3 mr-1" />
              Cancel
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {/* Stage Timeline */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {stageEntries.map(([stageName, result]) => (
            <div key={stageName} className="flex items-center gap-1">
              <span
                className={`px-2 py-1 rounded text-xs text-white capitalize flex items-center gap-1 ${
                  StageStatusColor[result.status]
                }`}
              >
                {StageStatusIcon[result.status]}
                {stageName}
              </span>
              {result.error && (
                <span className="relative group">
                  <AlertCircle className="w-3 h-3 text-red-500" />
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-xs text-white rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                    {result.error}
                  </span>
                </span>
              )}
            </div>
          ))}
        </div>
        {runDetail.currentStage && (
          <p className="text-xs text-gray-400 mt-2">
            Current: <span className="text-coffee capitalize">{runDetail.currentStage}</span>
            {runDetail.iteration > 1 && ` (iteration ${runDetail.iteration})`}
          </p>
        )}
      </div>

      {/* Context */}
      <div className="p-4 border-b border-gray-700">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Context</h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-500">Vars:</span>{' '}
            <span className="text-gray-300">
              {Object.keys(runDetail.context.vars || {}).length > 0
                ? JSON.stringify(runDetail.context.vars)
                : '{}'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Iteration:</span>{' '}
            <span className="text-gray-300">{runDetail.iteration}</span>
          </div>
        </div>
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-auto p-4">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Logs</h3>
        <div className="space-y-1">
          {logs.length === 0 ? (
            <p className="text-xs text-gray-500">No logs yet</p>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className="text-xs font-mono bg-gray-800 p-2 rounded">
                <span className="text-gray-500">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>{' '}
                {log.stage && <span className="text-coffee">[{log.stage}]</span>}{' '}
                <span className={log.type === 'error' ? 'text-red-400' : 'text-gray-300'}>
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Error Display */}
      {runDetail.lastError && (
        <div className="p-4 border-t border-gray-700 bg-red-900/20">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{runDetail.lastError}</span>
          </div>
        </div>
      )}
    </div>
  );
}
