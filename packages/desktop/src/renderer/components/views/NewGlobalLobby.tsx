import React, { useState } from 'react';
import { FolderPlus, GitBranch, HardDrive, Clock, ArrowRight, Coffee } from 'lucide-react';
import type { Cafe } from '../../types/design';

interface NewGlobalLobbyProps {
  cafes: Cafe[];
  onCreateCafe: (path: string) => void;
  onSelectCafe: (id: string) => void;
}

export const NewGlobalLobby: React.FC<NewGlobalLobbyProps> = ({ cafes, onCreateCafe, onSelectCafe }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newPath, setNewPath] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPath) {
      onCreateCafe(newPath);
      setNewPath('');
      setIsCreating(false);
    }
  };

  return (
    <div className="p-10 max-w-7xl mx-auto">
      <div className="flex justify-between items-end mb-12">
        <div>
          <h1 className="text-4xl font-bold text-cafe-100 mb-3 tracking-tight">Global Lobby</h1>
          <p className="text-cafe-400 text-lg font-light">Manage your coding environments and brew new workflows.</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center px-5 py-3 bg-brand hover:bg-brand-hover text-white rounded-xl transition-all shadow-lg shadow-brand/20 hover:shadow-brand/40 font-medium transform hover:-translate-y-0.5"
        >
          <FolderPlus className="w-5 h-5 mr-2" />
          Register Cafe
        </button>
      </div>

      {isCreating && (
        <div className="mb-10 bg-cafe-800 border border-cafe-700 rounded-2xl p-8 animate-in fade-in slide-in-from-top-4 shadow-2xl shadow-black/50">
          <div className="flex items-center mb-6">
            <div className="p-2 bg-brand/20 rounded-lg mr-3">
              <FolderPlus className="w-6 h-6 text-brand" />
            </div>
            <h3 className="text-xl font-semibold text-cafe-100">Register New Cafe</h3>
          </div>
          <form onSubmit={handleSubmit} className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-cafe-500 mb-2 uppercase tracking-wider">Project Repository Path</label>
              <div className="relative group">
                <HardDrive className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-cafe-500 group-focus-within:text-brand transition-colors" />
                <input
                  type="text"
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                  placeholder="/Users/username/dev/my-project"
                  className="w-full bg-cafe-950 border border-cafe-700 text-cafe-200 pl-12 pr-4 py-3.5 rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent outline-none font-mono text-sm transition-all"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex items-end pb-0.5">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-6 py-3.5 text-cafe-400 hover:text-cafe-200 mr-2 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newPath}
                className="px-8 py-3.5 bg-cafe-100 hover:bg-white text-cafe-900 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors font-bold shadow-lg"
              >
                Connect
              </button>
            </div>
          </form>
        </div>
      )}

      {cafes.length === 0 ? (
        <div className="text-center py-24 border-2 border-dashed border-cafe-800 rounded-3xl bg-cafe-900/30">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-cafe-800 mb-6 shadow-inner">
            <Coffee className="w-10 h-10 text-cafe-600" />
          </div>
          <h3 className="text-2xl font-bold text-cafe-200 mb-3">No Cafes Registered</h3>
          <p className="text-cafe-500 max-w-md mx-auto mb-8 leading-relaxed">
            Your lobby is empty. Start by registering a local Git repository to begin orchestrating your code workflows.
          </p>
          <button onClick={() => setIsCreating(true)} className="text-brand-light hover:text-brand font-semibold flex items-center justify-center mx-auto transition-colors">
            Register your first Cafe <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cafes.map(cafe => (
            <div
              key={cafe.id}
              onClick={() => onSelectCafe(cafe.id)}
              className="group bg-cafe-800 hover:bg-cafe-700/80 border border-cafe-700/50 hover:border-brand/30 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-black/40 hover:-translate-y-1 relative overflow-hidden"
            >
              {/* Decorative gradient blob */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 rounded-full filter blur-2xl transform translate-x-10 -translate-y-10 group-hover:bg-brand/10 transition-all duration-500"></div>

              <div className="flex justify-between items-start mb-5 relative z-10">
                <div className="p-3 bg-cafe-900 rounded-xl border border-cafe-800 group-hover:border-brand/20 transition-colors shadow-sm">
                  <GitBranch className="w-6 h-6 text-brand" />
                </div>
                <span className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wide border ${
                  cafe.activeOrdersCount > 0
                    ? 'bg-brand/10 text-brand-light border-brand/20'
                    : 'bg-cafe-900 text-cafe-500 border-cafe-800'
                }`}>
                  {cafe.activeOrdersCount} ACTIVE
                </span>
              </div>

              <h3 className="text-xl font-bold text-cafe-100 mb-1.5 tracking-tight group-hover:text-white transition-colors">{cafe.name}</h3>
              <p className="text-cafe-500 text-xs font-mono truncate mb-8 flex items-center">
                <HardDrive className="w-3 h-3 mr-1.5 opacity-50" />
                {cafe.path}
              </p>

              <div className="flex items-center justify-between text-xs text-cafe-500 pt-5 border-t border-cafe-700 group-hover:border-cafe-600 transition-colors">
                <div className="flex items-center">
                  <Clock className="w-3.5 h-3.5 mr-1.5" />
                  Last brewed: Today
                </div>
                <div className="flex items-center text-brand-light opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all duration-300 font-medium">
                  Enter Cafe <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
