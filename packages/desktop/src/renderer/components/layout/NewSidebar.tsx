import React from 'react';
import { Coffee, GitBranch, Settings, Plus, Home, BookOpen, Zap, FileText } from 'lucide-react';
import type { Cafe } from '../../types/design';

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
          <p className="text-[10px] font-bold text-cafe-600 uppercase tracking-widest mb-3 pl-2">Global Menu</p>
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
              Lobby
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
              Recipes
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
              Skills
            </button>
            <button
              onClick={() => onNavigate('blueprints')}
              className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeView === 'blueprints'
                  ? 'bg-brand text-white shadow-lg shadow-brand/20'
                  : 'text-cafe-400 hover:bg-cafe-800 hover:text-cafe-100'
              }`}
            >
              <FileText className={`w-4 h-4 mr-3 ${activeView === 'blueprints' ? 'text-white' : 'text-cafe-500'}`} />
              Blueprints
            </button>
          </div>
        </div>

        {/* Cafe List */}
        <div className="px-4 mt-4">
          <div className="flex items-center justify-between mb-3 pl-2 pr-1">
            <p className="text-[10px] font-bold text-cafe-600 uppercase tracking-widest">Your Cafes</p>
            <button onClick={onAddCafe} className="p-1 hover:bg-cafe-800 rounded text-cafe-500 hover:text-brand-light transition-colors">
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-1">
            {cafes.map(cafe => (
              <button
                key={cafe.id}
                onClick={() => onNavigate('dashboard', cafe.id)}
                className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group relative overflow-hidden ${
                  activeView === 'dashboard' && activeCafeId === cafe.id
                    ? 'bg-cafe-800 text-brand-light border border-cafe-700/50 shadow-md'
                    : 'text-cafe-400 hover:bg-cafe-800/50 hover:text-cafe-200'
                }`}
              >
                <GitBranch className={`w-4 h-4 mr-3 transition-colors ${
                  activeView === 'dashboard' && activeCafeId === cafe.id ? 'text-brand' : 'text-cafe-600 group-hover:text-cafe-400'
                }`} />
                <div className="flex flex-col items-start truncate relative z-10">
                  <span className="truncate w-full text-left font-medium">{cafe.name}</span>
                </div>
                {activeView === 'dashboard' && activeCafeId === cafe.id && (
                  <div className="absolute inset-y-0 left-0 w-1 bg-brand rounded-r"></div>
                )}
                {cafe.activeOrdersCount > 0 && (
                  <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    activeView === 'dashboard' && activeCafeId === cafe.id
                      ? 'bg-brand text-white'
                      : 'bg-cafe-800 text-cafe-500 group-hover:text-cafe-300'
                  }`}>
                    {cafe.activeOrdersCount}
                  </span>
                )}
              </button>
            ))}
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
          Settings
        </button>
      </div>
    </div>
  );
};
