/**
 * Global Lobby View
 * Multi-Cafe management interface
 */

import { useEffect, useState } from 'react';
import { useCafeStore } from '../../store/useCafeStore';
import { useViewStore } from '../../store/useViewStore';
import { CafeCard } from '../cafe/CafeCard';
import { FolderPlus, Coffee, HardDrive, ArrowRight } from 'lucide-react';
import type { Cafe } from '@codecafe/core';

export function GlobalLobby() {
  const {
    cafes,
    loading,
    error: storeError,
    loadCafes,
    createCafe,
    deleteCafe,
    selectCafe
  } = useCafeStore();

  const setView = useViewStore((s) => s.setView);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newCafePath, setNewCafePath] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  // Combine store error and local error for display
  const displayError = storeError || localError;

  // Load cafes on mount
  useEffect(() => {
    loadCafes();
  }, [loadCafes]);

  const handleCafeClick = async (cafe: Cafe) => {
    // selectCafe handles persistence of "last accessed"
    await selectCafe(cafe.id);
    console.log('[Global Lobby] Navigating to cafe:', cafe.id);
    // Auto-navigate to dashboard after selecting cafe
    setView('dashboard');
  };

  const handleAddCafe = async () => {
    if (!newCafePath.trim()) {
      setLocalError('Please enter a valid path');
      return;
    }

    try {
      setLocalError(null);
      await createCafe(newCafePath.trim());
      setShowAddDialog(false);
      setNewCafePath('');
    } catch (err: any) {
      console.error('[Global Lobby] Failed to add cafe:', err);
      // Store error is automatically set by the store, but we can log it here
    }
  };

  const handleDeleteCafe = async (cafe: Cafe) => {
    if (!confirm(`Are you sure you want to remove "${cafe.name}" from the registry?`)) {
      return;
    }

    try {
      await deleteCafe(cafe.id);
    } catch (err: any) {
      console.error('[Global Lobby] Failed to delete cafe:', err);
    }
  };

  if (loading && cafes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-cafe-400">Loading cafes...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-end mb-12">
        <div>
          <h1 className="text-4xl font-bold text-cafe-100 mb-3 tracking-tight">Global Lobby</h1>
          <p className="text-cafe-400 text-lg font-light">Manage your coding environments and brew new workflows.</p>
        </div>
        <button
          onClick={() => setShowAddDialog(true)}
          className="flex items-center px-5 py-3 bg-brand hover:bg-brand-hover text-white rounded-xl transition-all shadow-lg shadow-brand/20 hover:shadow-brand/40 font-medium transform hover:-translate-y-0.5"
        >
          <FolderPlus className="w-5 h-5 mr-2" />
          Register Cafe
        </button>
      </div>

      {/* Error Display */}
      {displayError && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-xl text-red-300 text-sm">
          {displayError}
        </div>
      )}

      {/* Add Cafe Dialog */}
      {showAddDialog && (
        <div className="mb-10 bg-cafe-800 border border-cafe-700 rounded-2xl p-8 animate-in fade-in slide-in-from-top-4 shadow-2xl shadow-black/50">
          <div className="flex items-center mb-6">
            <div className="p-2 bg-brand/20 rounded-lg mr-3">
              <FolderPlus className="w-6 h-6 text-brand" />
            </div>
            <h3 className="text-xl font-semibold text-cafe-100">Register New Cafe</h3>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); handleAddCafe(); }} className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-cafe-500 mb-2 uppercase tracking-wider">Project Repository Path</label>
              <div className="relative group">
                <HardDrive className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-cafe-500 group-focus-within:text-brand transition-colors" />
                <input
                  type="text"
                  value={newCafePath}
                  onChange={(e) => setNewCafePath(e.target.value)}
                  placeholder="/Users/username/dev/my-project"
                  className="w-full bg-cafe-950 border border-cafe-700 text-cafe-200 pl-12 pr-4 py-3.5 rounded-xl focus:ring-2 focus:ring-brand focus:border-transparent outline-none font-mono text-sm transition-all"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowAddDialog(false);
                      setNewCafePath('');
                    }
                  }}
                />
              </div>
            </div>
            <div className="flex items-end pb-0.5">
              <button
                type="button"
                onClick={() => {
                  setShowAddDialog(false);
                  setNewCafePath('');
                  setLocalError(null);
                }}
                className="px-6 py-3.5 text-cafe-400 hover:text-cafe-200 mr-2 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newCafePath || loading}
                className="px-8 py-3.5 bg-cafe-100 hover:bg-white text-cafe-900 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors font-bold shadow-lg"
              >
                Connect
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cafe Grid */}
      {cafes.length === 0 ? (
        <div className="text-center py-24 border-2 border-dashed border-cafe-800 rounded-3xl bg-cafe-900/30">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-cafe-800 mb-6 shadow-inner">
            <Coffee className="w-10 h-10 text-cafe-600" />
          </div>
          <h3 className="text-2xl font-bold text-cafe-200 mb-3">No Cafes Registered</h3>
          <p className="text-cafe-500 max-w-md mx-auto mb-8 leading-relaxed">
            Your lobby is empty. Start by registering a local Git repository to begin orchestrating your code workflows.
          </p>
          <button onClick={() => setShowAddDialog(true)} className="text-brand-light hover:text-brand font-semibold flex items-center justify-center mx-auto transition-colors">
            Register your first Cafe <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cafes.map((cafe) => (
            <CafeCard
              key={cafe.id}
              cafe={cafe}
              onClick={handleCafeClick}
              onDelete={handleDeleteCafe}
            />
          ))}
        </div>
      )}
    </div>
  );
}
