import { Layout } from './components/layout/Layout';
import { useViewStore } from './store/useViewStore';
import { useIpcEffect } from './hooks/useIpcEffect';
import {
  Dashboard,
  NewOrder,
  Orders,
  Baristas,
  Worktrees,
  Recipes,
} from './components/views';

const VIEW_MAP = {
  dashboard: Dashboard,
  'new-order': NewOrder,
  orders: Orders,
  baristas: Baristas,
  worktrees: Worktrees,
  recipes: Recipes,
};

export function App() {
  const currentView = useViewStore((s) => s.currentView);
  const ViewComponent = VIEW_MAP[currentView];

  // IPC 이벤트 리스너 등록
  useIpcEffect();

  return (
    <Layout>
      <ViewComponent />
    </Layout>
  );
}
