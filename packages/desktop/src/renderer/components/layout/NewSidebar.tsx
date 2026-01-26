import React, { useState } from 'react';
import { Coffee, GitBranch, Settings, Plus, Home, BookOpen, Zap, ScrollText, ChevronDown, ChevronRight, ClipboardList } from 'lucide-react';
import type { Cafe } from '../../types/design';
import { useTranslation } from '../../i18n';

interface NewSidebarProps {
  cafes: Cafe[];
  activeCafeId: string | null;
  activeView: string;
  onNavigate: (view: string, cafeId?: string) => void;
  onAddCafe: () => void;
}

export const NewSidebar: React.FC<NewSidebarProps> = ({
  cafes,
  activeCafeId,
  activeView,
  onNavigate,
  onAddCafe
}) => {
  const { t } = useTranslation();
  const [expandedCafeId, setExpandedCafeId] = useState<string | null>(activeCafeId);

  const isCafeActive = (cafeId: string) => {
    return activeCafeId === cafeId && (activeView === 'orders' || activeView === 'houseRules');
  };

  const handleCafeClick = (cafeId: string) => {
    if (expandedCafeId === cafeId) {
      // If already expanded, navigate to orders
      onNavigate('orders', cafeId);
    } else {
      // Expand and navigate
      setExpandedCafeId(cafeId);
      onNavigate('orders', cafeId);
    }
  };

  return (
    <div className="w-64 bg-cafe-900 border-r border-cafe-800 flex flex-col h-screen text-cafe-300 shadow-xl z-20">
      {/* Brand */}
      <div className="h-16 flex items-center px-6 border-b border-cafe-800 cursor-pointer group" onClick={() => onNavigate('cafes')}>
        <div className="bg-gradient-to-br from-brand to-brand-hover p-1.5 rounded-lg mr-3 shadow-lg shadow-brand/20 group-hover:shadow-brand/40 transition-all">
          <Coffee className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-lg tracking-tight text-cafe-100 group-hover:text-white transition-colors">CodeCafe</span>
      </div>

      {/* Main Nav */}
      <div className="flex-1 overflow-y-auto py-6">
        <div className="px-4 mb-6">
          <p className="text-[10px] font-bold text-cafe-600 uppercase tracking-widest mb-3 pl-2">Global</p>
          <div className="space-y-1">
            <button
              onClick={() => onNavigate('cafes')}
              className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeView === 'cafes'
                  ? 'bg-brand text-white shadow-lg shadow-brand/20'
                  : 'text-cafe-400 hover:bg-cafe-800 hover:text-cafe-100'
              }`}
            >
              <Home className={`w-4 h-4 mr-3 ${activeView === 'cafes' ? 'text-white' : 'text-cafe-500'}`} />
              {t('menu.lobby')}
            </button>
            <button
              onClick={() => onNavigate('workflows')}
              className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeView === 'workflows'
                  ? 'bg-brand text-white shadow-lg shadow-brand/20'
                  : 'text-cafe-400 hover:bg-cafe-800 hover:text-cafe-100'
              }`}
            >
              <BookOpen className={`w-4 h-4 mr-3 ${activeView === 'workflows' ? 'text-white' : 'text-cafe-500'}`} />
              {t('menu.recipes')}
            </button>
            <button
              onClick={() => onNavigate('skills')}
              className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeView === 'skills'
                  ? 'bg-brand text-white shadow-lg shadow-brand/20'
                  : 'text-cafe-400 hover:bg-cafe-800 hover:text-cafe-100'
              }`}
            >
              <Zap className={`w-4 h-4 mr-3 ${activeView === 'skills' ? 'text-white' : 'text-cafe-500'}`} />
              {t('menu.skills')}
            </button>
          </div>
        </div>

        {/* Cafe List */}
        <div className="px-4 mt-4">
          <div className="flex items-center justify-between mb-3 pl-2 pr-1">
            <p className="text-[10px] font-bold text-cafe-600 uppercase tracking-widest">{t('menu.yourCafes')}</p>
            <button onClick={onAddCafe} className="p-1 hover:bg-cafe-800 rounded text-cafe-500 hover:text-brand-light transition-colors">
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-1">
            {cafes.map(cafe => {
              const isExpanded = expandedCafeId === cafe.id;
              const isActive = isCafeActive(cafe.id);

              return (
                <div key={cafe.id}>
                  {/* Cafe Header */}
                  <button
                    onClick={() => handleCafeClick(cafe.id)}
                    className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group relative overflow-hidden ${
                      isActive
                        ? 'bg-cafe-800 text-brand-light border border-cafe-700/50 shadow-md'
                        : 'text-cafe-400 hover:bg-cafe-800/50 hover:text-cafe-200'
                    }`}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 mr-2 text-cafe-500" />
                    ) : (
                      <ChevronRight className="w-3 h-3 mr-2 text-cafe-500" />
                    )}
                    <GitBranch className={`w-4 h-4 mr-2 transition-colors ${
                      isActive ? 'text-brand' : 'text-cafe-600 group-hover:text-cafe-400'
                    }`} />
                    <span className="truncate flex-1 text-left font-medium">{cafe.name}</span>
                    {isActive && (
                      <div className="absolute inset-y-0 left-0 w-1 bg-brand rounded-r"></div>
                    )}
                    {cafe.activeOrdersCount > 0 && (
                      <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        isActive
                          ? 'bg-brand text-white'
                          : 'bg-cafe-800 text-cafe-500 group-hover:text-cafe-300'
                      }`}>
                        {cafe.activeOrdersCount}
                      </span>
                    )}
                  </button>

                  {/* Cafe Submenu */}
                  {isExpanded && (
                    <div className="ml-5 mt-1 space-y-1 border-l border-cafe-700/50 pl-3">
                      <button
                        onClick={() => onNavigate('orders', cafe.id)}
                        className={`w-full flex items-center px-3 py-2 rounded-lg text-xs transition-all ${
                          activeView === 'orders' && activeCafeId === cafe.id
                            ? 'bg-brand/20 text-brand-light'
                            : 'text-cafe-500 hover:bg-cafe-800/50 hover:text-cafe-300'
                        }`}
                      >
                        <ClipboardList className="w-3.5 h-3.5 mr-2" />
                        {t('cafe.orders')}
                      </button>
                      <button
                        onClick={() => onNavigate('houseRules', cafe.id)}
                        className={`w-full flex items-center px-3 py-2 rounded-lg text-xs transition-all ${
                          activeView === 'houseRules' && activeCafeId === cafe.id
                            ? 'bg-brand/20 text-brand-light'
                            : 'text-cafe-500 hover:bg-cafe-800/50 hover:text-cafe-300'
                        }`}
                      >
                        <ScrollText className="w-3.5 h-3.5 mr-2" />
                        {t('cafe.houseRules')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-cafe-800 bg-cafe-900/50">
        <button
          onClick={() => onNavigate('settings')}
          className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm transition-colors ${
            activeView === 'settings'
              ? 'bg-cafe-800 text-cafe-100'
              : 'text-cafe-400 hover:text-cafe-100 hover:bg-cafe-800'
          }`}
        >
          <Settings className="w-4 h-4 mr-3" />
          {t('menu.settings')}
        </button>
      </div>
    </div>
  );
};
