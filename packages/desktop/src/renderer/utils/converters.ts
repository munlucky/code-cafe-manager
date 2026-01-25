/**
 * Data conversion utilities for transforming between backend and design types
 */

import type {
  Recipe,
  Skill as DesignSkill,
  DesignOrder,
  WorkflowLog,
  Cafe as DesignCafe,
} from '../types/design';
import { OrderStatus as DesignOrderStatus } from '../types/design';
import type { Order, Workflow, Skill } from '../types/models';
import type { Cafe } from '@codecafe/core';
import { OrderStatus as BackendOrderStatus } from '../types/models';

interface SessionStatus {
  awaitingInput: boolean;
}

/**
 * Convert backend Order to design Order format
 */
export const convertToDesignOrder = (
  order: Order,
  sessionStatus?: SessionStatus
): DesignOrder => {
  const statusMap: Record<BackendOrderStatus, DesignOrderStatus> = {
    PENDING: DesignOrderStatus.PENDING,
    RUNNING: DesignOrderStatus.RUNNING,
    COMPLETED: DesignOrderStatus.COMPLETED,
    FAILED: DesignOrderStatus.FAILED,
    CANCELLED: DesignOrderStatus.FAILED,
  };

  const status = sessionStatus?.awaitingInput
    ? DesignOrderStatus.WAITING_INPUT
    : statusMap[order.status] || 'PENDING';

  const designLogs: WorkflowLog[] = (order.logs || []).map((log) => ({
    id: crypto.randomUUID(),
    timestamp: log.timestamp,
    content: log.message,
    type: log.type === 'warning' ? 'system' : log.type,
  }));

  return {
    id: order.id,
    workflowId: order.workflowId || '',
    workflowName: order.workflowName || 'Unknown',
    status,
    cafeId: order.counter || '',
    vars: order.vars || {},
    worktreeInfo: order.worktreeInfo?.removed
      ? order.worktreeInfo
      : order.worktreeInfo
        ? {
            path: order.worktreeInfo.path,
            branch: order.worktreeInfo.branch,
            baseBranch: order.worktreeInfo.baseBranch,
            repoPath: order.worktreeInfo.repoPath || '',
          }
        : undefined,
    currentStage: 'Init',
    logs: designLogs,
    createdAt: order.createdAt ? new Date(order.createdAt) : new Date(),
    startedAt: order.startedAt ? new Date(order.startedAt) : undefined,
    completedAt: order.endedAt ? new Date(order.endedAt) : undefined,
  };
};

/**
 * Convert backend Workflow to design Recipe format
 */
export const convertToDesignRecipe = (
  wf: Workflow & { stageConfigs?: Record<string, { skills?: string[] }> }
): Recipe => ({
  id: wf.id,
  name: wf.name,
  description: wf.description || '',
  stages: wf.stages,
  stageConfigs: Object.fromEntries(
    wf.stages.map((stage: string) => [
      stage,
      { skills: wf.stageConfigs?.[stage]?.skills || [] },
    ])
  ),
  isDefault: wf.isDefault,
  protected: wf.protected,
});

/**
 * Convert core Cafe to design Cafe format
 */
export const convertToDesignCafe = (cafe: Cafe): DesignCafe => ({
  id: cafe.id,
  name: cafe.name,
  path: cafe.path,
  createdAt: cafe.createdAt,
  lastAccessedAt: undefined,
  settings: cafe.settings,
  activeOrdersCount: cafe.activeOrders,
});

/**
 * Convert backend Skill to design Skill format
 */
export const convertToDesignSkill = (skill: Skill): DesignSkill => ({
  id: skill.id,
  name: skill.name,
  description: skill.description,
  category: (skill.category as DesignSkill['category']) || 'implementation',
  instructions: skill.skillCommand,
  isBuiltIn: skill.isBuiltIn || false,
});

/**
 * Convert design Skill to backend Skill format
 */
export const convertToBackendSkill = (skill: DesignSkill): Skill => ({
  id: skill.id,
  name: skill.name,
  description: skill.description,
  category:
    (skill.category === 'review' ? 'verification' : skill.category) ||
    'implementation',
  skillCommand: skill.instructions,
  isBuiltIn: skill.isBuiltIn,
});
