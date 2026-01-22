import { useEffect, useState, useCallback } from 'react';
import { useViewStore } from './store/useViewStore';
import { useCafeStore } from './store/useCafeStore';
import { useOrderStore } from './store/useOrderStore';
import { useIpcEffect } from './hooks/useIpcEffect';
import type { Recipe, Skill as DesignSkill, DesignOrder, WorkflowLog, Cafe as DesignCafe, SkillCategory } from './types/design';
import { OrderStatus as DesignOrderStatus } from './types/design';
import type { Order, Workflow, Skill } from './types/models';
import type { Cafe } from '@codecafe/core';
import { OrderStatus as BackendOrderStatus } from './types/models';
import type { StageInfo } from './components/order/OrderStageProgress';
import type { TimelineEvent } from './components/orders/OrderTimelineView';

// Import components
import { NewSidebar } from './components/layout/NewSidebar';
import { NewGlobalLobby } from './components/views/NewGlobalLobby';
import { NewCafeDashboard } from './components/views/NewCafeDashboard';
import { NewWorkflows } from './components/views/NewWorkflows';
import { NewSkills } from './components/views/NewSkills';

// Convert backend Order to design Order
const convertToDesignOrder = (order: Order, sessionStatus?: { awaitingInput: boolean }): DesignOrder => {
  // Determine status from order state (BackendOrderStatus enum values)
  const statusMap: Record<BackendOrderStatus, DesignOrderStatus> = {
    'PENDING': DesignOrderStatus.PENDING,
    'RUNNING': DesignOrderStatus.RUNNING,
    'COMPLETED': DesignOrderStatus.COMPLETED,
    'FAILED': DesignOrderStatus.FAILED,
    'CANCELLED': DesignOrderStatus.FAILED,
  };

  // Use WAITING_INPUT status if session indicates awaiting input
  const status = sessionStatus?.awaitingInput
    ? DesignOrderStatus.WAITING_INPUT
    : statusMap[order.status] || 'PENDING';

  return {
    id: order.id,
    workflowId: order.workflowId || '',
    workflowName: order.workflowName || 'Unknown',
    status,
    cafeId: order.counter || '', // Use counter as cafeId since Order doesn't have cafeId
    vars: order.vars || {},
    worktreeInfo: order.worktreeInfo ? {
      path: order.worktreeInfo.path,
      branch: order.worktreeInfo.branch,
      baseBranch: order.worktreeInfo.baseBranch,
      repoPath: order.worktreeInfo.repoPath || '',
    } : undefined,
    currentStage: 'Init', // Order doesn't track currentStage
    logs: [], // Will be populated from order events
    createdAt: order.createdAt ? new Date(order.createdAt) : new Date(),
    startedAt: order.startedAt ? new Date(order.startedAt) : undefined,
    completedAt: order.endedAt ? new Date(order.endedAt) : undefined,
  };
};

// Convert backend Workflow to design Recipe
const convertToDesignRecipe = (wf: Workflow & { stageConfigs?: Record<string, { skills?: string[] }> }): Recipe => ({
  id: wf.id,
  name: wf.name,
  description: wf.description || '',
  stages: wf.stages,
  stageConfigs: Object.fromEntries(
    wf.stages.map((stage: string) => [
      stage,
      { skills: wf.stageConfigs?.[stage]?.skills || [] }
    ])
  ),
  isDefault: wf.isDefault,
  protected: wf.protected,
});

// Convert core Cafe to design Cafe
const convertToDesignCafe = (cafe: Cafe): DesignCafe => ({
  id: cafe.id,
  name: cafe.name,
  path: cafe.path,
  createdAt: cafe.createdAt,
  lastAccessedAt: undefined,
  settings: cafe.settings,
  activeOrdersCount: cafe.activeOrders,
});

// Convert backend Skill to design Skill
const convertToDesignSkill = (skill: Skill): DesignSkill => ({
  id: skill.id,
  name: skill.name,
  description: skill.description,
  category: skill.category as DesignSkill['category'] || 'implementation',
  instructions: skill.skillCommand, // Map skillCommand to instructions
  isBuiltIn: skill.isBuiltIn || false,
});

// View mapping
const VIEW_MAP = {
  cafes: NewGlobalLobby,
  dashboard: NewCafeDashboard,
  workflows: NewWorkflows,
  skills: NewSkills,
};

export function App(): JSX.Element {
  const { currentView, viewParams, setView } = useViewStore();
  const { cafes, currentCafeId, loadCafes, getCurrentCafe } = useCafeStore();

  // Global data state (recipes, skills)
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [skills, setSkills] = useState<DesignSkill[]>([]);
  const [orderLogs, setOrderLogs] = useState<Record<string, WorkflowLog[]>>({});

  // Stage results for progress tracking
  const [stageResults, setStageResults] = useState<Record<string, Record<string, {
    stageId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    startedAt?: string;
    completedAt?: string;
    error?: string;
  }>>>({});

  // Timeline events
  const [timelineEvents, setTimelineEvents] = useState<Record<string, TimelineEvent[]>>({});

  // Order state from useOrderStore (updated by IPC events)
  const { orders: backendOrders, addOrder, removeOrder, updateOrder, sessionStatuses, setAwaitingInput } = useOrderStore();

  // Convert backend orders to design orders
  const orders: DesignOrder[] = backendOrders.map(order =>
    convertToDesignOrder(order, sessionStatuses[order.id])
  ).map(o => ({
    ...o,
    logs: orderLogs[o.id] || o.logs,
  }));

  useIpcEffect();

  // Load cafes, recipes, skills, and orders on mount
  useEffect(() => {
    const { setOrders } = useOrderStore.getState();
    
    const loadData = async () => {
      // Load cafes
      await loadCafes();

      // Load recipes (workflows)
      const wfRes = await window.codecafe.workflow.list();
      if (wfRes.success && wfRes.data) {
        setRecipes(wfRes.data.map(convertToDesignRecipe));
      }

      // Load skills
      const skillRes = await window.codecafe.skill.list();
      if (skillRes.success && skillRes.data) {
        setSkills(skillRes.data.map(convertToDesignSkill));
      }

      // Load orders from backend (for persistence)
      const orderRes = await window.codecafe.order.getAll();
      if (orderRes.success && orderRes.data) {
        console.log('[App] Loaded orders from backend:', orderRes.data.length);
        setOrders(orderRes.data);
      }
    };
    loadData();
  }, [loadCafes]);

  // Subscribe to order output events
  useEffect(() => {
    const cleanup = window.codecafe.order.onOutput((event) => {
      const { orderId, type, message, timestamp } = event;

      setOrderLogs(prev => {
        const existingLogs = prev[orderId] || [];
        return {
          ...prev,
          [orderId]: [
            ...existingLogs,
            {
              id: crypto.randomUUID(),
              timestamp: new Date(timestamp).toLocaleTimeString([], { hour12: false }),
              content: message,
              type: type === 'error' ? 'error' : type === 'success' ? 'success' : 'info',
            }
          ]
        };
      });
    });
    return cleanup;
  }, []);

  // Subscribe to stage events
  useEffect(() => {
    const cleanupStageStarted = window.codecafe.order.onStageStarted((data: { orderId: string; stageId: string }) => {
      const timestamp = new Date().toISOString();
      setStageResults(prev => ({
        ...prev,
        [data.orderId]: {
          ...(prev[data.orderId] || {}),
          [data.stageId]: {
            stageId: data.stageId,
            status: 'running',
            startedAt: timestamp,
          },
        },
      }));
      setTimelineEvents(prev => ({
        ...prev,
        [data.orderId]: [
          ...(prev[data.orderId] || []),
          {
            id: crypto.randomUUID(),
            type: 'stage_start',
            timestamp,
            content: 'Stage started',
            stageName: data.stageId,
          },
        ],
      }));
    });

    const cleanupStageCompleted = window.codecafe.order.onStageCompleted((data: { orderId: string; stageId: string; duration?: number }) => {
      const timestamp = new Date().toISOString();
      setStageResults(prev => ({
        ...prev,
        [data.orderId]: {
          ...(prev[data.orderId] || {}),
          [data.stageId]: {
            ...(prev[data.orderId]?.[data.stageId] || { stageId: data.stageId }),
            status: 'completed',
            completedAt: timestamp,
          },
        },
      }));
      setTimelineEvents(prev => ({
        ...prev,
        [data.orderId]: [
          ...(prev[data.orderId] || []),
          {
            id: crypto.randomUUID(),
            type: 'stage_complete',
            timestamp,
            content: `Stage completed${data.duration ? ` in ${data.duration}ms` : ''}`,
            stageName: data.stageId,
          },
        ],
      }));
    });

    const cleanupStageFailed = window.codecafe.order.onStageFailed((data: { orderId: string; stageId: string; error?: string }) => {
      const timestamp = new Date().toISOString();
      setStageResults(prev => ({
        ...prev,
        [data.orderId]: {
          ...(prev[data.orderId] || {}),
          [data.stageId]: {
            ...(prev[data.orderId]?.[data.stageId] || { stageId: data.stageId }),
            status: 'failed',
            completedAt: timestamp,
            error: data.error,
          },
        },
      }));
      setTimelineEvents(prev => ({
        ...prev,
        [data.orderId]: [
          ...(prev[data.orderId] || []),
          {
            id: crypto.randomUUID(),
            type: 'stage_fail',
            timestamp,
            content: data.error || 'Stage failed',
            stageName: data.stageId,
          },
        ],
      }));
    });

    return () => {
      cleanupStageStarted();
      cleanupStageCompleted();
      cleanupStageFailed();
    };
  }, []);

  // Recipe CRUD handlers
  const handleAddRecipe = useCallback(async (recipe: Recipe) => {
    const res = await window.codecafe.workflow.create(recipe);
    if (res.success && res.data) {
      setRecipes(prev => [...prev, convertToDesignRecipe(res.data!)]);
    }
  }, []);

  const handleUpdateRecipe = useCallback(async (recipe: Recipe) => {
    const res = await window.codecafe.workflow.update(recipe);
    if (res.success && res.data) {
      setRecipes(prev => prev.map(r => r.id === recipe.id ? convertToDesignRecipe(res.data!) : r));
    }
  }, []);

  const handleDeleteRecipe = useCallback(async (id: string) => {
    const res = await window.codecafe.workflow.delete(id);
    if (res.success) {
      setRecipes(prev => prev.filter(r => r.id !== id));
    }
  }, []);

  // Skill CRUD handlers
  // Convert DesignSkill to backend Skill before sending to API
  const convertToBackendSkill = (skill: DesignSkill): Skill => ({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    category: (skill.category === 'review' ? 'verification' : skill.category) || 'implementation',
    skillCommand: skill.instructions, // Map instructions to skillCommand
    isBuiltIn: skill.isBuiltIn,
  });

  const handleAddSkill = useCallback(async (skill: DesignSkill) => {
    const backendSkill = convertToBackendSkill(skill);
    const res = await window.codecafe.skill.create(backendSkill);
    if (res.success && res.data) {
      setSkills(prev => [...prev, convertToDesignSkill(res.data!)]);
    }
  }, []);

  const handleUpdateSkill = useCallback(async (skill: DesignSkill) => {
    const backendSkill = convertToBackendSkill(skill);
    const res = await window.codecafe.skill.update(backendSkill);
    if (res.success && res.data) {
      setSkills(prev => prev.map(s => s.id === skill.id ? convertToDesignSkill(res.data!) : s));
    }
  }, []);

  const handleDeleteSkill = useCallback(async (id: string) => {
    const res = await window.codecafe.skill.delete(id);
    if (res.success) {
      setSkills(prev => prev.filter(s => s.id !== id));
    }
  }, []);

  const handleDuplicateSkill = useCallback(async (skill: DesignSkill) => {
    const duplicatedSkill: DesignSkill = {
      ...skill,
      id: `${skill.id}-copy-${Date.now()}`,
      name: `${skill.name} (Copy)`,
      isBuiltIn: false,
    };
    const backendSkill = convertToBackendSkill(duplicatedSkill);
    const res = await window.codecafe.skill.create(backendSkill);
    if (res.success && res.data) {
      setSkills(prev => [...prev, convertToDesignSkill(res.data!)]);
    }
  }, []);

  // Cafe handlers
  const handleCreateCafe = useCallback(async (path: string) => {
    const res = await window.codecafe.cafe.create({ path });
    if (res.success && res.data) {
      await loadCafes();
      // Navigate to dashboard with new cafe
    }
  }, [loadCafes]);

  const handleDeleteCafe = useCallback(async (cafeId: string) => {
    const res = await window.codecafe.cafe.delete(cafeId);
    if (res.success) {
      await loadCafes();
    }
  }, [loadCafes]);

  // Order handlers
  const handleCreateOrder = useCallback(async (
    cafeId: string,
    workflowId: string,
    description: string,
    useWorktree: boolean
  ) => {
    const workflow = recipes.find(r => r.id === workflowId);
    const res = await window.codecafe.order.createWithWorktree({
      cafeId,
      workflowId,
      workflowName: workflow?.name || 'Unknown',
      vars: { prompt: description },
      createWorktree: useWorktree,
    });
    if (res.success && res.data) {
      const order = res.data!.order;
      addOrder(order);
      
      // 바로 실행: description을 prompt로 사용
      if (description.trim()) {
        try {
          console.log('[App] Auto-executing order:', order.id, 'with prompt:', description);
          await window.codecafe.order.execute(order.id, description, {});
        } catch (err) {
          console.error('[App] Failed to auto-execute order:', err);
        }
      }
    }
  }, [recipes, addOrder]);

  const handleDeleteOrder = useCallback(async (orderId: string) => {
    const res = await window.codecafe.order.delete(orderId);
    if (res.success) {
      removeOrder(orderId);
    }
  }, [removeOrder]);

  const handleCancelOrder = useCallback(async (orderId: string) => {
    const res = await window.codecafe.order.cancel(orderId);
    if (res.success) {
      updateOrder(orderId, { status: BackendOrderStatus.CANCELLED });
    }
  }, [updateOrder]);

  const handleSendInput = useCallback(async (orderId: string, input: string) => {
    const res = await window.codecafe.order.sendInput(orderId, input);
    if (res.success) {
      setAwaitingInput(orderId, false);
    }
  }, [setAwaitingInput]);

  // Navigation handler
  const handleNavigate = useCallback((view: string, cafeId?: string) => {
    setView(view as any, cafeId ? { cafeId } : undefined);
  }, [setView]);

  // Get stages for order (from workflow + stageResults)
  const getStagesForOrder = useCallback((order: DesignOrder): StageInfo[] => {
    const recipe = recipes.find(r => r.id === order.workflowId);
    const orderStages = recipe?.stages || [];
    const results = stageResults[order.id] || {};

    return orderStages.map(stageId => {
      const stageResult = results[stageId];
      let status: StageInfo['status'] = 'pending';

      if (stageResult) {
        status = stageResult.status;
      } else if (order.status === 'COMPLETED') {
        status = 'completed';
      } else if (order.status === 'FAILED') {
        status = 'failed';
      }

      return {
        name: stageId.charAt(0).toUpperCase() + stageId.slice(1),
        status,
      };
    });
  }, [recipes, stageResults]);

  // Convert cafes to design format for components
  const designCafes: DesignCafe[] = cafes.map(convertToDesignCafe);

  // View component selector
  const ViewComponent = VIEW_MAP[currentView as keyof typeof VIEW_MAP];

  if (!ViewComponent) {
    return <div className="p-8 text-cafe-400">Unknown view: {currentView}</div>;
  }

  return (
    <div className="flex h-screen bg-cafe-950 text-cafe-200">
      <NewSidebar
        cafes={designCafes}
        activeCafeId={currentCafeId}
        activeView={currentView}
        onNavigate={handleNavigate}
        onAddCafe={() => handleNavigate('cafes')}
      />

      <main className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-cafe-950 to-[#120f0e] pointer-events-none" />

        <div className="relative h-full z-10">
          {currentView === 'cafes' && (
            <NewGlobalLobby
              cafes={designCafes}
              onCreateCafe={handleCreateCafe}
              onSelectCafe={(id) => handleNavigate('dashboard', id)}
              onDeleteCafe={handleDeleteCafe}
            />
          )}

          {currentView === 'dashboard' && currentCafeId && (
            <NewCafeDashboard
              cafe={convertToDesignCafe(getCurrentCafe()!)}
              orders={orders}
              workflows={recipes}
              onCreateOrder={handleCreateOrder}
              onDeleteOrder={handleDeleteOrder}
              onCancelOrder={handleCancelOrder}
              onSendInput={handleSendInput}
              getStagesForOrder={getStagesForOrder}
              timelineEvents={timelineEvents}
            />
          )}

          {currentView === 'workflows' && (
            <NewWorkflows
              recipes={recipes}
              skills={skills}
              onAddRecipe={handleAddRecipe}
              onUpdateRecipe={handleUpdateRecipe}
              onDeleteRecipe={handleDeleteRecipe}
            />
          )}

          {currentView === 'skills' && (
            <NewSkills
              skills={skills}
              onAddSkill={handleAddSkill}
              onUpdateSkill={handleUpdateSkill}
              onDeleteSkill={handleDeleteSkill}
              onDuplicateSkill={handleDuplicateSkill}
            />
          )}
        </div>
      </main>
    </div>
  );
}
