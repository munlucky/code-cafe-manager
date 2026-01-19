import { useState } from 'react';
import {
  Coffee, ChevronDown, ChevronRight, Settings, Plus, X,
  LayoutDashboard, List, FolderOpen, Zap, ChefHat
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useViewStore, type ViewName } from '../../store/useViewStore';
import { useCafeStore } from '../../store/useCafeStore';

// Cafe-specific navigation (shown under selected cafe)
const CAFE_NAV_ITEMS: Array<{ view: ViewName; label: string; icon: any }> = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'orders', label: 'Orders', icon: List },
];

// Global settings (always accessible, cafe-independent)
// Recipe = Workflow YAML template (Skills 조합을 정의)
const GLOBAL_NAV_ITEMS: Array<{ view: ViewName; label: string; icon: any; tooltip?: string }> = [
  { view: 'workflows', label: 'Recipes', icon: ChefHat, tooltip: 'Workflow YAML templates' },
  { view: 'skills', label: 'Skill Library', icon: Zap, tooltip: 'Individual skill definitions' },
];

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const { currentView, setView } = useViewStore();
  const { cafes, currentCafeId, selectCafe } = useCafeStore();

  const [expandedCafes, setExpandedCafes] = useState<Set<string>>(() => {
    return currentCafeId ? new Set([currentCafeId]) : new Set();
  });

  const toggleCafeExpand = (cafeId: string) => {
    setExpandedCafes(prev => {
      const next = new Set(prev);
      if (next.has(cafeId)) {
        next.delete(cafeId);
      } else {
        next.add(cafeId);
      }
      return next;
    });
  };

  const handleCafeSelect = async (cafeId: string) => {
    await selectCafe(cafeId);
    setView('dashboard');
    setExpandedCafes(prev => new Set(prev).add(cafeId));
    onClose?.();
  };

  const handleManageCafes = () => {
    setView('cafes');
    onClose?.();
  };

  const handleNavClick = (view: ViewName, cafeId?: string) => {
    if (cafeId && currentCafeId !== cafeId) {
      selectCafe(cafeId);
    }
    setView(view);
    onClose?.();
  };

  return (
    <div className="w-[240px] sm:w-[280px] lg:w-[240px] bg-[#1E1E1E] border-r border-[#333] flex flex-col h-full font-sans select-none">
      {/* Brand / Header */}
      <div className="flex items-center justify-between px-4 py-5 mb-2">
        <div className="flex items-center gap-3">
          <div className="bg-coffee/20 p-1.5 rounded-lg">
            <Coffee className="text-coffee" size={20} />
          </div>
          <h1 className="text-lg font-bold text-gray-100 tracking-tight">CodeCafe</h1>
        </div>
        {/* Close button for mobile */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg hover:bg-[#2A2A2A] transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        )}
      </div>

      {/* Cafe List Section */}
      <div className="flex-1 overflow-y-auto px-3">
        {/* Header with Manage Button */}
        <div className="flex items-center justify-between mb-2 px-1 group">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
            Workspaces
          </span>
          <button
            onClick={handleManageCafes}
            className={cn(
              'p-1 rounded opacity-0 group-hover:opacity-100 transition-all duration-200',
              currentView === 'cafes'
                ? 'text-coffee opacity-100 bg-coffee/10'
                : 'text-gray-400 hover:text-white hover:bg-white/10'
            )}
            title="Manage Cafes"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="space-y-1">
          {cafes.length === 0 ? (
            <div className="text-sm text-gray-500 italic px-2 py-2">
              No cafes yet
            </div>
          ) : (
            cafes.map((cafe) => {
              const isSelected = currentCafeId === cafe.id;
              const isExpanded = expandedCafes.has(cafe.id);

              return (
                <div key={cafe.id} className="mb-1">
                  {/* Cafe Header Row */}
                  <div className={cn(
                    "group flex items-center rounded-md transition-colors duration-150 pr-2",
                    isSelected ? "bg-[#2A2A2A]" : "hover:bg-[#2A2A2A]"
                  )}>
                    {/* Toggle Arrow */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCafeExpand(cafe.id);
                      }}
                      className="p-2 text-gray-500 hover:text-white transition-colors cursor-pointer"
                    >
                      <ChevronRight
                        size={14}
                        className={cn("transition-transform duration-200", isExpanded && "rotate-90")}
                      />
                    </button>

                    {/* Cafe Name - Click to Select */}
                    <button
                      onClick={() => handleCafeSelect(cafe.id)}
                      className="flex-1 text-left py-2 text-[14px] font-medium text-gray-300 group-hover:text-white truncate"
                      title={cafe.path}
                    >
                      {cafe.name}
                    </button>

                    {/* Active Indicator Dot */}
                    {isSelected && (
                      <div className="w-1.5 h-1.5 rounded-full bg-coffee shadow-[0_0_8px_rgba(var(--coffee-rgb),0.5)]" />
                    )}
                  </div>

                  {/* Sub-menu with Tree Lines */}
                  {isExpanded && (
                    <div className="relative ml-[19px] pl-3 border-l border-[#333] pt-1 pb-1 space-y-0.5">
                      {CAFE_NAV_ITEMS.map(({ view, label, icon: Icon }) => (
                        <button
                          key={view}
                          onClick={() => handleNavClick(view, cafe.id)}
                          className={cn(
                            'w-full text-left px-2 py-1.5 rounded-md text-[13px] flex items-center gap-2 transition-all duration-150 group relative',
                            currentView === view && currentCafeId === cafe.id
                              ? 'text-coffee bg-coffee/10 font-medium'
                              : 'text-gray-400 hover:text-gray-200 hover:bg-[#2A2A2A]'
                          )}
                        >
                          <Icon size={14} className="opacity-70 group-hover:opacity-100" />
                          <span>{label}</span>

                          {/* Active Item Border Indicator */}
                          {currentView === view && currentCafeId === cafe.id && (
                            <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-coffee rounded-full" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer / Global Section */}
      <div className="border-t border-[#333] p-3 bg-[#191919]">
        <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2 px-1">
          Global Settings
        </div>
        <div className="space-y-0.5">
          {GLOBAL_NAV_ITEMS.map(({ view, label, icon: Icon, tooltip }) => (
            <button
              key={view}
              onClick={() => handleNavClick(view)}
              title={tooltip}
              className={cn(
                'w-full text-left px-2 py-1.5 rounded-md text-[13px] flex items-center gap-2 transition-all duration-150',
                currentView === view
                  ? 'text-coffee bg-coffee/10 font-medium'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#2A2A2A]'
              )}
            >
              <Icon size={14} className="opacity-70" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
