import { useEffect, useState, useCallback } from 'react';
import { useViewStore } from './store/useViewStore';
import { useCafeStore } from './store/useCafeStore';
import { useOrderStore } from './store/useOrderStore';
import { useIpcEffect } from './hooks/useIpcEffect';
import { useStageTracking } from './hooks/useStageTracking';
import { useRecipeHandlers } from './hooks/useRecipeHandlers';
import { useSkillHandlers } from './hooks/useSkillHandlers';
import { useCafeHandlers } from './hooks/useCafeHandlers';
import { useOrderHandlers } from './hooks/useOrderHandlers';
import {
  convertToDesignOrder,
  convertToDesignRecipe,
  convertToDesignCafe,
  convertToDesignSkill,
} from './utils/converters';
import type { Recipe, Skill as DesignSkill, Cafe as DesignCafe } from './types/design';
import type { StageInfo } from './components/order/OrderStageProgress';

// Import components
import { NewSidebar } from './components/layout/NewSidebar';
import { NewGlobalLobby } from './components/views/NewGlobalLobby';
import { NewCafeDashboard } from './components/views/NewCafeDashboard';
import { NewWorkflows } from './components/views/NewWorkflows';
import { NewSkills } from './components/views/NewSkills';

// View mapping
const VIEW_MAP = {
  cafes: NewGlobalLobby,
  dashboard: NewCafeDashboard,
  workflows: NewWorkflows,
  skills: NewSkills,
};

export function App(): JSX.Element {
  const { currentView, setView } = useViewStore();
  const { cafes, currentCafeId, loadCafes, getCurrentCafe } = useCafeStore();

  // Global data state
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [skills, setSkills] = useState<DesignSkill[]>([]);

  // Stage tracking from custom hook
  const { stageResults, timelineEvents } = useStageTracking();

  // Order state from store
  const { orders: backendOrders, sessionStatuses } = useOrderStore();

  // Convert backend orders to design orders
  const orders = backendOrders.map((order) =>
    convertToDesignOrder(order, sessionStatuses[order.id])
  );

  // Initialize IPC effect
  useIpcEffect();

  // CRUD handlers from custom hooks
  const { handleAddRecipe, handleUpdateRecipe, handleDeleteRecipe } =
    useRecipeHandlers({ onRecipesChange: setRecipes });

  const {
    handleAddSkill,
    handleUpdateSkill,
    handleDeleteSkill,
    handleDuplicateSkill,
  } = useSkillHandlers({ onSkillsChange: setSkills });

  const { handleCreateCafe, handleDeleteCafe } = useCafeHandlers();

  const {
    handleCreateOrder,
    handleDeleteOrder,
    handleCancelOrder,
    handleSendInput,
  } = useOrderHandlers({ recipes });

  // Load initial data
  useEffect(() => {
    const { setOrders } = useOrderStore.getState();

    const loadData = async () => {
      await loadCafes();

      const wfRes = await window.codecafe.workflow.list();
      if (wfRes.success && wfRes.data) {
        setRecipes(wfRes.data.map(convertToDesignRecipe));
      }

      const skillRes = await window.codecafe.skill.list();
      if (skillRes.success && skillRes.data) {
        setSkills(skillRes.data.map(convertToDesignSkill));
      }

      const orderRes = await window.codecafe.order.getAll();
      if (orderRes.success && orderRes.data) {
        setOrders(orderRes.data);
      }
    };
    loadData();
  }, [loadCafes]);

  // Navigation handler
  const handleNavigate = useCallback(
    (view: string, cafeId?: string) => {
      setView(view as keyof typeof VIEW_MAP, cafeId ? { cafeId } : undefined);
    },
    [setView]
  );

  // Get stages for order
  const getStagesForOrder = useCallback(
    (order: { id: string; workflowId: string; status: string }): StageInfo[] => {
      const recipe = recipes.find((r) => r.id === order.workflowId);
      const orderStages = recipe?.stages || [];
      const results = stageResults[order.id] || {};

      return orderStages.map((stageId) => {
        const stageResult = results[stageId];
        let status: StageInfo['status'] = 'pending';

        if (stageResult) {
          status = stageResult.status;
        } else if (order.status === 'COMPLETED') {
          status = 'completed';
        } else if (order.status === 'FAILED') {
          status = 'failed';
        }

        return { stageId, category: null, status };
      });
    },
    [recipes, stageResults]
  );

  // Convert cafes to design format
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
