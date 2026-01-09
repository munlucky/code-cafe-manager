import { Coffee } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useViewStore, type ViewName } from '../../store/useViewStore';

const NAV_ITEMS: Array<{ view: ViewName; label: string }> = [
  { view: 'dashboard', label: 'Dashboard' },
  { view: 'new-order', label: 'New Order' },
  { view: 'orders', label: 'Orders' },
  { view: 'worktrees', label: 'Worktrees' },
  { view: 'recipes', label: 'Recipe Studio' },
];

export function Sidebar() {
  const { currentView, setView } = useViewStore();

  return (
    <div className="w-[200px] bg-sidebar border-r border-border px-5 py-6">
      <div className="flex items-center gap-2 mb-8">
        <Coffee className="text-coffee" size={20} />
        <h1 className="text-lg font-semibold text-coffee">CodeCafe</h1>
      </div>

      <nav className="space-y-1">
        {NAV_ITEMS.map(({ view, label }) => (
          <button
            key={view}
            onClick={() => setView(view)}
            className={cn(
              'w-full text-left px-3 py-2 rounded transition-colors',
              currentView === view
                ? 'bg-coffee text-white'
                : 'text-bone/80 hover:bg-border/50'
            )}
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
