import { useEffect } from 'react';
import { Layout } from './components/layout/Layout';
import { useViewStore } from './store/useViewStore';
import { useCafeStore } from './store/useCafeStore';
import { useIpcEffect } from './hooks/useIpcEffect';
import {
  Dashboard,
  NewOrder,
  OrderDetail,
  Worktrees,
  Workflows,
  WorkflowDetail,
  Skills,
} from './components/views';
import { GlobalLobby } from './components/views/GlobalLobby';
import { CafeDashboard } from './components/views/CafeDashboard';
import { RoleManager } from './components/role/RoleManager';
import { OrderTerminals } from './components/terminal/OrderTerminals';

const VIEW_MAP: Record<string, React.ComponentType> = {
  cafes: GlobalLobby,
  dashboard: Dashboard,
  'new-order': NewOrder,
  orders: OrderDetail,
  terminals: OrderTerminals,
  worktrees: Worktrees,
  workflows: Workflows,
  skills: Skills,
  roles: RoleManager,
};


// Helper function to encapsulate view selection logic
function selectViewComponent(view: string): React.ComponentType {
  if (view === 'dashboard') {
    return CafeDashboard;
  }
  return VIEW_MAP[view];
}

// Type guard for workflow params
function isWorkflowParams(params: any): params is { workflowId: string } {
  return params && typeof params.workflowId === 'string';
}

export function App(): JSX.Element {
  const { currentView, viewParams, setView } = useViewStore();
  const { cafes, currentCafeId, loadCafes, selectCafe } = useCafeStore();

  useIpcEffect();

  // App start logic: auto-route based on cafe state
  useEffect(() => {
    const initializeApp = async () => {
      // Load cafes first
      await loadCafes();
    };
    initializeApp();
  }, [loadCafes]);

  // After cafes loaded, handle routing
  useEffect(() => {
    // If no cafes exist → show GlobalLobby (onboarding)
    if (cafes.length === 0) {
      if (currentView !== 'cafes') {
        setView('cafes');
      }
      return;
    }

    // If cafes exist but none selected → auto-select first/last accessed
    if (!currentCafeId && cafes.length > 0) {
      // Select first cafe and go to dashboard
      selectCafe(cafes[0].id);
      setView('dashboard');
    }
  }, [cafes, currentCafeId, currentView, setView, selectCafe]);

  // Special handling for views with required props
  if (currentView === 'workflow-detail' && isWorkflowParams(viewParams)) {
    return (
      <Layout>
        <WorkflowDetail workflowId={viewParams.workflowId} />
      </Layout>
    );
  }

  const ViewComponent = selectViewComponent(currentView);

  return (
    <Layout>
      <ViewComponent />
    </Layout>
  );
}

