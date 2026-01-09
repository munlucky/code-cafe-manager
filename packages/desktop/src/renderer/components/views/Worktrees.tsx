import { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { EmptyState } from '../ui/EmptyState';
import type { WorktreeInfo } from '../../types/models';

export function Worktrees() {
  const [repoPath, setRepoPath] = useState('.');
  const [baseBranch, setBaseBranch] = useState('main');
  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLoad = async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await window.codecafe.listWorktrees(repoPath);

      if (result.success && result.data) {
        setWorktrees(result.data);
      } else {
        setError(result.error || 'Failed to load worktrees');
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
        alert(`Failed to export patch: ${result.error}`);
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

  const handleRemove = async (worktreePath: string, force = false) => {
    if (!force) {
      const confirmed = confirm(
        `Delete worktree at ${worktreePath}?\n\nThis will fail if there are uncommitted changes.`
      );
      if (!confirmed) return;
    }

    try {
      const result = await window.codecafe.removeWorktree(worktreePath, force);

      if (result.success) {
        alert('Worktree deleted successfully');
        handleLoad();
      } else {
        if (!force) {
          const forceConfirm = confirm(
            `Failed: ${result.error}\n\nForce delete?`
          );
          if (forceConfirm) {
            handleRemove(worktreePath, true);
          }
        } else {
          alert(`Failed to delete: ${result.error}`);
        }
      }
    } catch (error) {
      alert(`Error: ${error}`);
    }
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
                    <div className="flex gap-2">
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
                        onClick={() => handleRemove(wt.path)}
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
