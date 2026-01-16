import * as React from 'react';
import { useEffect, useState, type ReactElement } from 'react';
import { Plus, AlertCircle, Edit, Trash2, Copy, Filter } from 'lucide-react';
import type { SkillPreset, SkillCategory } from '../../types/models';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { SkillPresetEditorDialog } from '../skill/SkillPresetEditorDialog';

// Available categories for filtering
const CATEGORIES: { value: SkillCategory; label: string }[] = [
  { value: 'analysis', label: 'Analysis' },
  { value: 'planning', label: 'Planning' },
  { value: 'implementation', label: 'Implementation' },
  { value: 'verification', label: 'Verification' },
  { value: 'utility', label: 'Utility' },
];

// Category badge colors
const CATEGORY_COLORS: Record<SkillCategory, string> = {
  analysis: 'bg-blue-900/30 text-blue-300',
  planning: 'bg-purple-900/30 text-purple-300',
  implementation: 'bg-green-900/30 text-green-300',
  verification: 'bg-yellow-900/30 text-yellow-300',
  utility: 'bg-gray-700/30 text-gray-300',
};

interface SkillPresetCardProps {
  preset: SkillPreset;
  onEdit: (preset: SkillPreset, e: React.MouseEvent) => void;
  onDelete: (preset: SkillPreset, e: React.MouseEvent) => void;
  onDuplicate: (preset: SkillPreset, e: React.MouseEvent) => void;
}

function SkillPresetCard({
  preset,
  onEdit,
  onDelete,
  onDuplicate,
}: SkillPresetCardProps): ReactElement {
  const categoryCounts = preset.skills.reduce((acc, skill) => {
    acc[skill.category] = (acc[skill.category] || 0) + 1;
    return acc;
  }, {} as Record<SkillCategory, number>);

  return (
    <Card className="p-4 hover:border-coffee transition-colors group">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-bone truncate">{preset.name}</h3>
            {preset.isBuiltIn && (
              <span className="px-1.5 py-0.5 bg-coffee/20 text-coffee text-xs rounded flex-shrink-0">
                Built-in
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 truncate">ID: {preset.id}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {preset.isBuiltIn && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => onDuplicate(preset, e)}
              className="p-1.5 h-auto hover:bg-gray-700"
              title="Duplicate preset"
            >
              <Copy className="w-4 h-4 text-gray-400 group-hover:text-bone" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => onEdit(preset, e)}
            className="p-1.5 h-auto hover:bg-gray-700"
            title="Edit preset"
          >
            <Edit className="w-4 h-4 text-gray-400 group-hover:text-bone" />
          </Button>
          {!preset.isBuiltIn && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => onDelete(preset, e)}
              className="p-1.5 h-auto hover:bg-red-900/30"
              title="Delete preset"
            >
              <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-400" />
            </Button>
          )}
        </div>
      </div>
      <p className="mt-2 text-sm text-gray-300 line-clamp-2">{preset.description}</p>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-gray-400">Skills:</span>
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.filter((cat) => categoryCounts[cat.value] > 0).map((cat) => (
            <span
              key={cat.value}
              className={`px-2 py-0.5 text-xs rounded-full flex items-center gap-1 ${CATEGORY_COLORS[cat.value]}`}
            >
              {cat.label} ({categoryCounts[cat.value]})
            </span>
          ))}
          <span className="px-2 py-0.5 bg-gray-700 text-xs text-gray-200 rounded-full">
            {preset.skills.length} total
          </span>
        </div>
      </div>
    </Card>
  );
}

export function Skills(): ReactElement {
  const [presets, setPresets] = useState<SkillPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<SkillPreset | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<SkillCategory | 'all'>('all');

  const loadPresets = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await window.codecafe.skill.list();
      if (response.success && response.data) {
        setPresets(response.data);
      } else {
        setError(response.error?.message || 'Failed to load skill presets');
      }
    } catch (err: any) {
      console.error('[Skills] Failed to load presets:', err);
      setError(err.message || 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPresets();
  }, []);

  const handleNewPreset = () => {
    setEditingPreset(null);
    setIsEditorOpen(true);
  };

  const handleEditPreset = (preset: SkillPreset, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (preset.isBuiltIn) {
      // For built-in presets, show a message to duplicate first
      alert('Built-in presets cannot be edited directly. Please duplicate it first to create a custom version.');
      return;
    }
    setEditingPreset(preset);
    setIsEditorOpen(true);
  };

  const handleDeletePreset = async (preset: SkillPreset, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (preset.isBuiltIn) {
      alert('Built-in presets cannot be deleted.');
      return;
    }
    if (!confirm(`Are you sure you want to delete skill preset "${preset.name}"?`)) {
      return;
    }
    try {
      const response = await window.codecafe.skill.delete(preset.id);
      if (response.success) {
        await loadPresets();
      } else {
        throw new Error(response.error?.message || 'Failed to delete');
      }
    } catch (err: any) {
      alert(`Error deleting preset: ${err.message}`);
    }
  };

  const handleDuplicatePreset = async (preset: SkillPreset, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Generate a new ID
    const baseId = preset.id.replace(/-copy$/, '');
    let newId = `${baseId}-copy`;
    let counter = 1;
    while (presets.some((p) => p.id === newId)) {
      newId = `${baseId}-copy${counter}`;
      counter++;
    }

    try {
      const response = await window.codecafe.skill.duplicate(preset.id, newId, `${preset.name} (Copy)`);
      if (response.success) {
        await loadPresets();
      } else {
        throw new Error(response.error?.message || 'Failed to duplicate');
      }
    } catch (err: any) {
      alert(`Error duplicating preset: ${err.message}`);
    }
  };

  const handleSuccess = async () => {
    await loadPresets();
  };

  const filteredPresets = presets.filter((preset) => {
    if (categoryFilter === 'all') return true;
    return preset.skills.some((skill) => skill.category === categoryFilter);
  });

  if (loading && presets.length === 0) {
    return (
      <div className="p-6 h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-coffee border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-400">Loading skill presets...</p>
        </div>
      </div>
    );
  }

  if (error && presets.length === 0) {
    return (
      <div className="p-6 h-full flex flex-col items-center justify-center text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-bone mb-2">Failed to load skill presets</h3>
        <p className="text-gray-400 mb-6">{error}</p>
        <Button onClick={loadPresets} variant="secondary">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="p-6 h-full overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-bone">Skill Presets</h1>
          <Button onClick={handleNewPreset} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Preset
          </Button>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 mb-6">
          <Filter className="w-4 h-4 text-gray-400" />
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              categoryFilter === 'all'
                ? 'bg-coffee text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategoryFilter(cat.value)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                categoryFilter === cat.value
                  ? `${CATEGORY_COLORS[cat.value]} border border-current`
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {filteredPresets.length === 0 ? (
          <EmptyState
            icon={AlertCircle}
            title={presets.length === 0 ? 'No Skill Presets Found' : 'No Matching Presets'}
            description={
              presets.length === 0
                ? 'Create your first skill preset to get started.'
                : 'No presets match the selected category filter.'
            }
            action={
              presets.length === 0 ? (
                <Button onClick={handleNewPreset} className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  New Preset
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-4">
            {filteredPresets.map((preset) => (
              <SkillPresetCard
                key={preset.id}
                preset={preset}
                onEdit={handleEditPreset}
                onDelete={handleDeletePreset}
                onDuplicate={handleDuplicatePreset}
              />
            ))}
          </div>
        )}
      </div>
      <SkillPresetEditorDialog
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSuccess={handleSuccess}
        preset={editingPreset}
      />
    </>
  );
}
