/**
 * WorktreeManagementPanel - Panel for managing worktree merge/remove operations
 */

import React, { memo, useState, useCallback } from 'react';
import { GitMerge, GitCommit, Trash2 } from 'lucide-react';
import type { DesignOrder } from '../../types/design';

interface MergeResult {
  success: boolean;
  message: string;
  worktreeRemoved: boolean;
}

interface WorktreeManagementPanelProps {
  order: DesignOrder;
  isFollowupMode: boolean;
  onClose: () => void;
  onMergeComplete: (result: MergeResult) => void;
}

export const WorktreeManagementPanel: React.FC<WorktreeManagementPanelProps> =
  memo(function WorktreeManagementPanel({
    order,
    isFollowupMode,
    onClose,
    onMergeComplete,
  }) {
    const [isMerging, setIsMerging] = useState(false);
    const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);

    const handleMergeWorktree = useCallback(
      async (deleteAfterMerge: boolean = false) => {
        if (!order?.id) return;

        setIsMerging(true);
        setMergeResult(null);

        try {
          // Enter followup mode if not already
          if (!isFollowupMode) {
            const enterResponse = await window.codecafe.order.enterFollowup(
              order.id
            );
            if (!enterResponse.success) {
              throw new Error(
                enterResponse.error?.message || 'Failed to enter followup mode'
              );
            }
          }

          // Create merge prompt
          const targetBranch = order.worktreeInfo?.baseBranch || 'main';
          const prompt = deleteAfterMerge
            ? `Please merge the current worktree changes to ${targetBranch} branch with an appropriate commit message based on the changes. After merging, remove the worktree but preserve the branch.`
            : `Please merge the current worktree changes to ${targetBranch} branch with an appropriate commit message based on the changes.`;

          // Execute followup
          const executeResponse = await window.codecafe.order.executeFollowup(
            order.id,
            prompt
          );
          if (!executeResponse.success) {
            throw new Error(
              executeResponse.error?.message ||
                'Failed to execute merge followup'
            );
          }

          const result = {
            success: true,
            message: 'AI is starting the merge operation.',
            worktreeRemoved: deleteAfterMerge,
          };
          setMergeResult(result);
          onMergeComplete(result);
        } catch (error) {
          const result = {
            success: false,
            message:
              error instanceof Error ? error.message : 'Merge followup failed',
            worktreeRemoved: false,
          };
          setMergeResult(result);
          onMergeComplete(result);
        } finally {
          setIsMerging(false);
        }
      },
      [order, isFollowupMode, onMergeComplete]
    );

    const handleRemoveWorktreeOnly = useCallback(async () => {
      if (!order?.id) {
        return;
      }

      setIsMerging(true);
      setMergeResult(null);

      try {
        const response = await window.codecafe.order.cleanupWorktreeOnly(
          order.id
        );

        if (response.success && response.data) {
          const result = {
            success: true,
            message: response.data.message || `Worktree removed, branch '${response.data.branch}' preserved`,
            worktreeRemoved: true,
          };
          setMergeResult(result);
          onMergeComplete(result);
        } else {
          const result = {
            success: false,
            message: response.error?.message || 'Failed to remove worktree',
            worktreeRemoved: false,
          };
          setMergeResult(result);
          onMergeComplete(result);
        }
      } catch (error) {
        const result = {
          success: false,
          message:
            error instanceof Error ? error.message : 'Failed to remove worktree',
          worktreeRemoved: false,
        };
        setMergeResult(result);
        onMergeComplete(result);
      } finally {
        setIsMerging(false);
      }
    }, [order, onMergeComplete]);

    if (!order.worktreeInfo) return null;

    return (
      <div className="mx-4 mt-4 p-4 bg-cafe-900 border border-green-500/30 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-green-400" />
            <h3 className="text-sm font-medium text-green-400">
              Worktree Management
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-xs text-cafe-500 hover:text-cafe-300"
          >
            Close
          </button>
        </div>

        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 px-3 py-2 bg-cafe-950 rounded border border-cafe-800">
            <div className="flex items-center gap-2 text-xs">
              <GitCommit className="w-3 h-3 text-brand" />
              <span className="font-mono text-cafe-300">
                {order.worktreeInfo.branch}
              </span>
            </div>
          </div>
        </div>

        {mergeResult && (
          <div
            className={`text-xs p-2 rounded mb-3 ${
              mergeResult.success
                ? 'bg-green-500/10 text-green-400'
                : 'bg-red-500/10 text-red-400'
            }`}
          >
            {mergeResult.message}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => handleMergeWorktree(false)}
            disabled={isMerging}
            className="flex-1 px-3 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <GitMerge className={`w-3 h-3 ${isMerging ? 'animate-spin' : ''}`} />
            {isMerging ? 'Merging...' : 'Merge to Main'}
          </button>
          <button
            onClick={() => handleMergeWorktree(true)}
            disabled={isMerging}
            className="px-3 py-2 bg-cafe-800 hover:bg-cafe-700 text-yellow-400 text-xs font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <GitMerge className="w-3 h-3" />
            Merge & Delete
          </button>
          <button
            onClick={handleRemoveWorktreeOnly}
            disabled={isMerging}
            className="px-3 py-2 bg-cafe-800 hover:bg-cafe-700 text-red-400 text-xs font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Trash2 className="w-3 h-3" />
            Remove Only
          </button>
        </div>
        <div className="text-[10px] text-cafe-600 mt-2">
          * "Remove Only" preserves the branch for later use
        </div>
      </div>
    );
  });
