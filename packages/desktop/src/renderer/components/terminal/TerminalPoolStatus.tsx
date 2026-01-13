/**
 * Terminal Pool Status Component
 * Displays the status of the Terminal Pool (per-provider stats)
 */

import { useEffect } from 'react';
import { useTerminalStore } from '../../store/useTerminalStore';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { cn } from '../../utils/cn';

export function TerminalPoolStatus() {
  const { status, metrics, loading, error, loadStatus, loadMetrics, clearError } = useTerminalStore();

  useEffect(() => {
    loadStatus();
    loadMetrics();

    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      loadStatus();
      loadMetrics();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <Card>
        <h3 className="text-xl font-bold mb-4 text-coffee">Terminal Pool</h3>
        <div className="bg-red-500/10 border border-red-500/20 rounded p-4">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={clearError}
            className="mt-2 text-xs text-red-400 underline"
          >
            Clear Error
          </button>
        </div>
      </Card>
    );
  }

  if (!status || Object.keys(status).length === 0) {
    return (
      <Card>
        <h3 className="text-xl font-bold mb-4 text-coffee">Terminal Pool</h3>
        <EmptyState message="Terminal pool not initialized" />
      </Card>
    );
  }

  const providers = Object.keys(status).sort();

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-coffee">Terminal Pool</h3>
        {loading && <span className="text-xs text-gray-500">Refreshing...</span>}
      </div>

      <div className="space-y-4">
        {providers.map((provider) => {
          const providerStatus = status[provider];
          const providerMetrics = metrics?.providers[provider];

          return (
            <div
              key={provider}
              className="p-4 bg-background rounded border border-border"
            >
              {/* Provider Header */}
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-bone capitalize">{provider}</h4>
                <span className="text-xs text-gray-500">
                  Total: {providerStatus.total}
                </span>
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center p-2 bg-green-500/10 rounded">
                  <div className="text-2xl font-bold text-green-400">
                    {providerStatus.idle}
                  </div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">
                    Idle
                  </div>
                </div>

                <div className="text-center p-2 bg-blue-500/10 rounded">
                  <div className="text-2xl font-bold text-blue-400">
                    {providerStatus.busy}
                  </div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">
                    Busy
                  </div>
                </div>

                <div className="text-center p-2 bg-red-500/10 rounded">
                  <div className="text-2xl font-bold text-red-400">
                    {providerStatus.crashed}
                  </div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">
                    Crashed
                  </div>
                </div>
              </div>

              {/* Metrics (if available) */}
              {providerMetrics && (
                <div className="pt-3 border-t border-border">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Active Leases:</span>
                      <span className="ml-1 text-bone font-medium">
                        {providerMetrics.activeLeases}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">P99 Wait:</span>
                      <span className="ml-1 text-bone font-medium">
                        {providerMetrics.p99WaitTime.toFixed(0)}ms
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Utilization Bar */}
              <div className="mt-3">
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                  <span>Utilization</span>
                  <span className="ml-auto">
                    {providerStatus.total > 0
                      ? Math.round((providerStatus.busy / providerStatus.total) * 100)
                      : 0}
                    %
                  </span>
                </div>
                <div className="h-2 bg-border rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all duration-300',
                      providerStatus.busy / providerStatus.total > 0.8
                        ? 'bg-red-500'
                        : providerStatus.busy / providerStatus.total > 0.5
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    )}
                    style={{
                      width: `${
                        providerStatus.total > 0
                          ? (providerStatus.busy / providerStatus.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
