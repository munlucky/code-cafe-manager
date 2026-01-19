import { useViewStore } from '../../store/useViewStore';

const VIEW_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  'new-order': 'New Order',
  orders: 'Orders',
};

export function Header() {
  const currentView = useViewStore((s) => s.currentView);

  return (
    <header className="px-8 py-5 border-b border-border">
      <h2 className="text-2xl font-semibold text-coffee">
        {VIEW_TITLES[currentView] || 'CodeCafe'}
      </h2>
    </header>
  );
}
