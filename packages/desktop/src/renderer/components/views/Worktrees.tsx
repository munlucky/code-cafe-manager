import { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { EmptyState } from '../ui/EmptyState';
import { StatusBadge } from '../ui/Badge';
import { useViewStore } from '../../store/useViewStore';
import type { WorktreeInfo, Order } from '../../types/models';
import { OrderStatus } from '@codecafe/core';

interface WorktreeWithOrder extends WorktreeInfo {
  order?: Order | null;
}

export function Worktrees() {
  const [repoPath, setRepoPath] = useState('.');
  const [baseBranch, setBaseBranch] = useState('main');
  const [worktrees, setWorktrees] = useState<WorktreeWithOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const setView = useViewStore((s) => s.setView);

  const handleLoad = async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await window.codecafe.listWorktrees(repoPath);

      if (result.success && result.data) {
        // 오더 정보를 가져와서 워크트리에 연결
        const worktreesWithOrders = await Promise.all(
          result.data.map(async (wt) => {
            // 브랜치명에서 orderId 추출 (order-123 → 123)
            const orderIdMatch = wt.branch?.match(/^order-(\d+)$/);
            if (orderIdMatch) {
              const orderId = orderIdMatch[1];
              try {
                const orderResult = await window.codecafe.order.get(orderId);
                if (orderResult.success && orderResult.data) {
                  return { ...wt, order: orderResult.data };
                }
              } catch (err) {
                console.error('[Worktrees] Failed to fetch order:', orderId, err);
              }
            }
            return { ...wt, order: null };
          })
        );
        setWorktrees(worktreesWithOrders);
      } else {
        setError(result.error?.message || 'Failed to load worktrees');
        setWorktrees([]);
      }
    } catch (err) {
      setError(`Error: ${err}`);
      setWorktrees([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportPatch = async (worktreePath: string) => {
    if (!baseBranch.trim()) {
      alert('Enter a base branch to export patch.');
      return;
    }

    try {
      const result = await window.codecafe.exportPatch(worktreePath, baseBranch.trim());
      if (result.success && result.data) {
        alert(`Patch exported to: ${result.data}`);
      } else {
        alert(`Failed to export patch: ${result.error?.message}`);
      }
    } catch (error) {
      alert(`Error: ${error}`);
    }
  };

  const handleOpenFolder = async (worktreePath: string) => {
    try {
      await window.codecafe.openWorktreeFolder(worktreePath);
    } catch (error) {
      alert(`Failed to open folder: ${error}`);
    }
  };

  const handleRemove = async (worktree: WorktreeWithOrder, force = false) => {
    // RUNNING 오더 워크트리 삭제 시 경고
    if (!force && worktree.order?.status === OrderStatus.RUNNING) {
      const confirmed = confirm(
        `This worktree is linked to a RUNNING order (#${worktree.order.id}).\n\nAre you sure you want to delete it?`
      );
      if (!confirmed) return;
    }

    if (!force) {
      const confirmed = confirm(
        `Delete worktree at ${worktree.path}?\n\nThis will fail if there are uncommitted changes.`
      );
      if (!confirmed) return;
    }

    try {
      const result = await window.codecafe.removeWorktree(worktree.path, force);

      if (result.success) {
        alert('Worktree deleted successfully');
        handleLoad();
      } else {
        if (!force) {
          const forceConfirm = confirm(
            `Failed: ${result.error?.message}\n\nForce delete?`
          );
          if (forceConfirm) {
            handleRemove(worktree, true);
          }
        } else {
          alert(`Failed to delete: ${result.error?.message}`);
        }
      }
    } catch (error) {
      alert(`Error: ${error}`);
    }
  };

  const handleViewOrder = (orderId: string) => {
    setView('orders', { orderId });
  };

  return (
    <Card className="max-w-6xl">
      <h3 className="text-xl font-bold mb-6 text-coffee">Git Worktrees</h3>

      <div className="mb-6">
        <label className="block text-coffee mb-2">Repository Path</label>
        <div className="flex gap-3">
          <Input
            type="text"
            value={repoPath}
            onChange={(e) => setRepoPath(e.target.value)}
            className="flex-1"
          />
          <Button onClick={handleLoad} disabled={isLoading}>
            {isLoading ? 'Loading...' : 'Load'}
          </Button>
        </div>
        <div className="mt-4">
          <label className="block text-coffee mb-2">Base Branch</label>
          <Input
            type="text"
            value={baseBranch}
            onChange={(e) => setBaseBranch(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500 rounded text-red-500">
          {error}
        </div>
      )}

      {!error && worktrees.length === 0 && !isLoading && (
        <EmptyState message="Enter repository path and click Load" />
      )}

      {worktrees.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-coffee">Branch</th>
                <th className="text-left py-3 px-4 text-coffee">Path</th>
                <th className="text-left py-3 px-4 text-coffee">Commit</th>
                <th className="text-left py-3 px-4 text-coffee">Order</th>
                <th className="text-left py-3 px-4 text-coffee">Actions</th>
              </tr>
            </thead>
            <tbody>
              {worktrees.map((wt, idx) => (
                <tr key={idx} className="border-b border-border/50">
                  <td className="py-3 px-4 text-bone">{wt.branch || 'N/A'}</td>
                  <td className="py-3 px-4 text-sm text-gray-500">{wt.path}</td>
                  <td className="py-3 px-4 text-sm font-mono text-bone">
                    {wt.commit ? wt.commit.substring(0, 7) : 'N/A'}
                  </td>
                  <td className="py-3 px-4">
                    {wt.order ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-bone">#{wt.order.id}</span>
                          <StatusBadge status={wt.order.status} />
                        </div>
                        <div className="text-xs text-gray-500">{wt.order.workflowName}</div>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">No order</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      {wt.order && (
                        <Button
                          variant="primary"
                          onClick={() => handleViewOrder(wt.order!.id)}
                          className="text-xs py-1 px-2"
                        >
                          View Order
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        onClick={() => handleExportPatch(wt.path)}
                        className="text-xs py-1 px-2"
                      >
                        Export Patch
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => handleOpenFolder(wt.path)}
                        className="text-xs py-1 px-2"
                      >
                        Open Folder
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => handleRemove(wt)}
                        className="text-xs py-1 px-2 bg-red-700 hover:bg-red-600"
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
