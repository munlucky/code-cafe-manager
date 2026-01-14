import { Layout } from './components/layout/Layout';
import { useViewStore } from './store/useViewStore';
import { useCafeStore } from './store/useCafeStore';
import { useIpcEffect } from './hooks/useIpcEffect';
import {
  Dashboard,
  NewOrder,
  OrderDetail,
  Worktrees,
} from './components/views';
import { GlobalLobby } from './components/views/GlobalLobby';
import { CafeDashboard } from './components/views/CafeDashboard';
import { RoleManager } from './components/role/RoleManager';

const VIEW_MAP: Record<string, React.ComponentType> = {
  dashboard: Dashboard,
  'new-order': NewOrder,
  orders: OrderDetail,
  worktrees: Worktrees,
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
  const currentView = useViewStore((s) => s.currentView);
  const currentCafeId = useCafeStore((s) => s.currentCafeId);

  useIpcEffect();

  // Phase 1: Cafe context routing
  // If no cafe is selected, show Global Lobby
  if (!currentCafeId) {
    return <GlobalLobby />;
  }

const ViewComponent = selectViewComponent(currentView);

  return (
    <Layout>
      <ViewComponent />
    </Layout>
  );
}
