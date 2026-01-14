/**
 * Global Lobby View
 * Multi-Cafe management interface
 */

import { useEffect, useState } from 'react';
import { useCafeStore } from '../../store/useCafeStore';
import { CafeCard } from '../cafe/CafeCard';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Plus, Coffee } from 'lucide-react';
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
        <div className="text-gray-400">Loading cafes...</div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-bone mb-2">Global Lobby</h1>
          <p className="text-gray-400">Manage your local repositories (Cafes)</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Cafe
        </Button>
      </div>

      {/* Error Display */}
      {displayError && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/50 rounded text-red-300 text-sm">
          {displayError}
        </div>
      )}

      {/* Add Cafe Dialog */}
      {showAddDialog && (
        <div className="mb-6 p-4 bg-card border border-border rounded">
          <h3 className="text-lg font-semibold text-bone mb-3">Add New Cafe</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newCafePath}
              onChange={(e) => setNewCafePath(e.target.value)}
              placeholder="Enter absolute path to git repository"
              className="flex-1 px-3 py-2 bg-background border border-border rounded text-bone placeholder-gray-500 focus:outline-none focus:border-coffee"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddCafe();
                if (e.key === 'Escape') {
                  setShowAddDialog(false);
                  setNewCafePath('');
                }
              }}
            />
            <Button onClick={handleAddCafe} disabled={loading}>Add</Button>
            <Button
              variant="secondary"
              onClick={() => {
                setShowAddDialog(false);
                setNewCafePath('');
                setLocalError(null);
              }}
            >
              Cancel
            </Button>
          </div>
          <p className="mt-2 text-sm text-gray-400">
            Example: C:\dev\my-project or /home/user/projects/my-app
          </p>
        </div>
      )}

      {/* Cafe Grid */}
      {cafes.length === 0 ? (
        <EmptyState
          icon={Coffee}
          title="No Cafes Yet"
          description="Add your first repository to get started"
          action={
            <Button onClick={() => setShowAddDialog(true)} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add First Cafe
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
