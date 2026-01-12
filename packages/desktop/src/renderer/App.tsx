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

const VIEW_MAP = {
  dashboard: Dashboard,
  'new-order': NewOrder,
  orders: OrderDetail,
  worktrees: Worktrees,
};

export function App() {
  const currentView = useViewStore((s) => s.currentView);
  const currentCafeId = useCafeStore((s) => s.currentCafeId);

  // IPC 이벤트 리스너 등록
  useIpcEffect();

  // Phase 1: Cafe context routing
  // If no cafe is selected, show Global Lobby
  // If a cafe is selected, show Cafe Dashboard (or legacy views)
  if (!currentCafeId) {
    return <GlobalLobby />;
  }

  // Cafe is selected - show Cafe Dashboard by default
  // Later phases will add more sophisticated routing
  const ViewComponent = currentView === 'dashboard' ? CafeDashboard : VIEW_MAP[currentView];

  return (
    <Layout>
      <ViewComponent />
    </Layout>
  );
}
