/**
 * Terminal Pool Status Component
 * Displays the status of the Terminal Pool (per-provider stats)
 */

import { useEffect } from 'react';
import type { PoolStatus, PoolMetrics } from '@codecafe/core';
import { useTerminalStore } from '../../store/useTerminalStore';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { cn } from '../../utils/cn';

type ProviderStatusCardProps = {
  providerName: string;
  status: PoolStatus[string];
  metrics?: PoolMetrics['providers'][string];
};

/**
 * Calculates the utilization percentage and returns a corresponding color class.
 * @param busy - Number of busy terminals.
 * @param total - Total number of terminals.
 * @returns Tailwind CSS background color class.
 */
function getUtilizationColor(busy: number, total: number): string {
  if (total === 0) {
    return 'bg-green-500';
  }
  const utilization = busy / total;
  if (utilization > 0.8) {
    return 'bg-red-500';
  }
  if (utilization > 0.5) {
    return 'bg-yellow-500';
  }
  return 'bg-green-500';
}

function ProviderStatusCard({ providerName, status, metrics }: ProviderStatusCardProps): JSX.Element {
  const utilizationPercentage = status.total > 0 ? Math.round((status.busy / status.total) * 100) : 0;
  const utilizationColor = getUtilizationColor(status.busy, status.total);

  return (
    <div className="p-4 bg-background rounded border border-border">
      {/* Provider Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold text-bone capitalize">{providerName}</h4>
        <span className="text-xs text-gray-500">Total: {status.total}</span>
      </div>

      {/* Status Grid */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center p-2 bg-green-500/10 rounded">
          <div className="text-2xl font-bold text-green-400">{status.idle}</div>
          <div className="text-xs text-gray-400 uppercase tracking-wide">Idle</div>
        </div>
        <div className="text-center p-2 bg-blue-500/10 rounded">
          <div className="text-2xl font-bold text-blue-400">{status.busy}</div>
          <div className="text-xs text-gray-400 uppercase tracking-wide">Busy</div>
        </div>
        <div className="text-center p-2 bg-red-500/10 rounded">
          <div className="text-2xl font-bold text-red-400">{status.crashed}</div>
          <div className="text-xs text-gray-400 uppercase tracking-wide">Crashed</div>
        </div>
      </div>

      {/* Metrics (if available) */}
      {metrics && (
        <div className="pt-3 border-t border-border">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500">Active Leases:</span>
              <span className="ml-1 text-bone font-medium">{metrics.activeLeases}</span>
            </div>
            <div>
              <span className="text-gray-500">P99 Wait:</span>
              <span className="ml-1 text-bone font-medium">{metrics.p99WaitTime.toFixed(0)}ms</span>
            </div>
          </div>
        </div>
      )}

      {/* Utilization Bar */}
      <div className="mt-3">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
          <span>Utilization</span>
          <span className="ml-auto">{utilizationPercentage}%</span>
        </div>
        <div className="h-2 bg-border rounded-full overflow-hidden">
          <div
            className={cn('h-full transition-all duration-300', utilizationColor)}
            style={{ width: `${utilizationPercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function TerminalPoolStatus(): JSX.Element {
  const { status, metrics, loading, error, load, clearError } = useTerminalStore();

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  if (error) {
    return (
      <Card>
        <h3 className="text-xl font-bold mb-4 text-coffee">Terminal Pool</h3>
        <div className="bg-red-500/10 border border-red-500/20 rounded p-4">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={clearError} className="mt-2 text-xs text-red-400 underline">
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
        {providers.map((provider) => (
          <ProviderStatusCard
            key={provider}
            providerName={provider}
            status={status[provider]}
            metrics={metrics?.providers[provider]}
          />
        ))}
      </div>
    </Card>
  );
}
