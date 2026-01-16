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
  'workflow-detail': WorkflowDetail,
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

export function App(): JSX.Element {
  const { currentView, viewParams } = useViewStore();
  const currentCafeId = useCafeStore((s) => s.currentCafeId);

  useIpcEffect();


  const ViewComponent = selectViewComponent(currentView);

  return (
    <Layout>
      {currentView === 'workflow-detail' ? (
        <ViewComponent workflowId={viewParams?.workflowId || ''} />
      ) : (
        <ViewComponent />
      )}
    </Layout>
  );
}
