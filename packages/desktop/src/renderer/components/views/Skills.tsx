import * as React from 'react';
import { useEffect, useState, type ReactElement } from 'react';
import { Plus, AlertCircle, Edit, Trash2, Copy, Filter, Terminal, Eye } from 'lucide-react';
import type { Skill, SkillCategory } from '../../types/models';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { SkillEditorDialog } from '../skill/SkillEditorDialog';

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

interface SkillCardProps {
  skill: Skill;
  onEdit: (skill: Skill, e: React.MouseEvent) => void;
  onDelete: (skill: Skill, e: React.MouseEvent) => void;
  onDuplicate: (skill: Skill, e: React.MouseEvent) => void;
  onView: (skill: Skill, e: React.MouseEvent) => void;
}

function SkillCard({
  skill,
  onEdit,
  onDelete,
  onDuplicate,
  onView,
}: SkillCardProps): ReactElement {
  return (
    <Card className="p-4 hover:border-brand transition-all duration-300 group hover:-translate-y-0.5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-cafe-100 truncate">{skill.name}</h3>
            {skill.isBuiltIn && (
              <span className="px-1.5 py-0.5 bg-brand/20 text-brand text-xs rounded flex-shrink-0">
                Built-in
              </span>
            )}
            <span
              className={`px-2 py-0.5 text-xs rounded-full ${CATEGORY_COLORS[skill.category]}`}
            >
              {CATEGORIES.find((c) => c.value === skill.category)?.label || skill.category}
            </span>
          </div>
          <p className="text-sm text-cafe-500 truncate">ID: {skill.id}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {skill.isBuiltIn ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => onView(skill, e)}
              className="p-1.5 h-auto hover:bg-cafe-700"
              title="View skill details"
            >
              <Eye className="w-4 h-4 text-cafe-500 group-hover:text-cafe-100" />
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => onEdit(skill, e)}
              className="p-1.5 h-auto hover:bg-cafe-700"
              title="Edit skill"
            >
              <Edit className="w-4 h-4 text-cafe-500 group-hover:text-cafe-100" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => onDuplicate(skill, e)}
            className="p-1.5 h-auto hover:bg-cafe-700"
            title="Duplicate skill"
          >
            <Copy className="w-4 h-4 text-cafe-500 group-hover:text-cafe-100" />
          </Button>
          {!skill.isBuiltIn && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => onDelete(skill, e)}
              className="p-1.5 h-auto hover:bg-red-900/30"
              title="Delete skill"
            >
              <Trash2 className="w-4 h-4 text-cafe-500 hover:text-red-400" />
            </Button>
          )}
        </div>
      </div>
      <p className="mt-2 text-sm text-cafe-300 line-clamp-2">{skill.description}</p>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-cafe-500">
          <Terminal className="w-3.5 h-3.5" />
          <code className="bg-cafe-900 px-1.5 py-0.5 rounded text-cafe-300">{skill.skillCommand}</code>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded ${
          skill.context === 'inherit'
            ? 'bg-orange-900/30 text-orange-300'
            : 'bg-cyan-900/30 text-cyan-300'
        }`}>
          {skill.context === 'inherit' ? 'Inherit Context' : 'Fork Context'}
        </span>
      </div>
    </Card>
  );
}

export function Skills(): ReactElement {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<SkillCategory | 'all'>('all');

  const loadSkills = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await window.codecafe.skill.list();
      if (response.success && response.data) {
        setSkills(response.data);
      } else {
        setError(response.error?.message || 'Failed to load skills');
      }
    } catch (err: any) {
      console.error('[Skills] Failed to load skills:', err);
      setError(err.message || 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSkills();
  }, []);

  const handleNewSkill = () => {
    setEditingSkill(null);
    setIsViewMode(false);
    setIsEditorOpen(true);
  };

  const handleEditSkill = (skill: Skill, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingSkill(skill);
    setIsViewMode(false);
    setIsEditorOpen(true);
  };

  const handleViewSkill = (skill: Skill, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingSkill(skill);
    setIsViewMode(true);
    setIsEditorOpen(true);
  };

  const handleDeleteSkill = async (skill: Skill, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (skill.isBuiltIn) {
      alert('Built-in skills cannot be deleted.');
      return;
    }
    if (!confirm(`Are you sure you want to delete skill "${skill.name}"?`)) {
      return;
    }
    try {
      const response = await window.codecafe.skill.delete(skill.id);
      if (response.success) {
        await loadSkills();
      } else {
        throw new Error(response.error?.message || 'Failed to delete');
      }
    } catch (err: any) {
      alert(`Error deleting skill: ${err.message}`);
    }
  };

  const handleDuplicateSkill = async (skill: Skill, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Generate a new ID
    const baseId = skill.id.replace(/-copy\d*$/, '');
    let newId = `${baseId}-copy`;
    let counter = 1;
    while (skills.some((s) => s.id === newId)) {
      newId = `${baseId}-copy${counter}`;
      counter++;
    }

    try {
      const response = await window.codecafe.skill.duplicate(skill.id, newId, `${skill.name} (Copy)`);
      if (response.success) {
        await loadSkills();
      } else {
        throw new Error(response.error?.message || 'Failed to duplicate');
      }
    } catch (err: any) {
      alert(`Error duplicating skill: ${err.message}`);
    }
  };

  const handleSuccess = async () => {
    await loadSkills();
  };

  const filteredSkills = skills.filter((skill) => {
    if (categoryFilter === 'all') return true;
    return skill.category === categoryFilter;
  });

  // Group skills by category
  const groupedSkills = CATEGORIES.reduce((acc, cat) => {
    const catSkills = filteredSkills.filter((s) => s.category === cat.value);
    if (catSkills.length > 0) {
      acc.push({ category: cat, skills: catSkills });
    }
    return acc;
  }, [] as { category: typeof CATEGORIES[0]; skills: Skill[] }[]);

  if (loading && skills.length === 0) {
    return (
      <div className="p-6 h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
          <p className="text-cafe-500">Loading skills...</p>
        </div>
      </div>
    );
  }

  if (error && skills.length === 0) {
    return (
      <div className="p-6 h-full flex flex-col items-center justify-center text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-cafe-100 mb-2">Failed to load skills</h3>
        <p className="text-cafe-500 mb-6">{error}</p>
        <Button onClick={loadSkills} variant="secondary">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="h-full overflow-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-cafe-100">Skills</h1>
            <p className="text-sm text-cafe-400 mt-1">
              개별 스킬을 관리합니다. Workflow의 Stage에서 스킬을 선택하여 사용할 수 있습니다.
            </p>
          </div>
          <Button onClick={handleNewSkill} className="flex items-center gap-2 self-start sm:self-auto">
            <Plus className="w-4 h-4" />
            New Skill
          </Button>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          <Filter className="w-4 h-4 text-cafe-500 flex-shrink-0" />
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm transition-colors whitespace-nowrap ${
              categoryFilter === 'all'
                ? 'bg-brand text-white shadow-lg shadow-brand/20'
                : 'bg-cafe-800 text-cafe-300 hover:bg-cafe-700'
            }`}
          >
            All ({skills.length})
          </button>
          {CATEGORIES.map((cat) => {
            const count = skills.filter((s) => s.category === cat.value).length;
            return (
              <button
                key={cat.value}
                onClick={() => setCategoryFilter(cat.value)}
                className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm transition-colors whitespace-nowrap ${
                  categoryFilter === cat.value
                    ? `${CATEGORY_COLORS[cat.value]} border border-current shadow-lg`
                    : 'bg-cafe-800 text-cafe-300 hover:bg-cafe-700'
                }`}
              >
                {cat.label} ({count})
              </button>
            );
          })}
        </div>

        {filteredSkills.length === 0 ? (
          <EmptyState
            icon={AlertCircle}
            title={skills.length === 0 ? 'No Skills Found' : 'No Matching Skills'}
            description={
              skills.length === 0
                ? 'Create your first skill to get started.'
                : 'No skills match the selected category filter.'
            }
            action={
              skills.length === 0 ? (
                <Button onClick={handleNewSkill} className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  New Skill
                </Button>
              ) : undefined
            }
          />
        ) : categoryFilter === 'all' ? (
          // Grouped view when showing all
          <div className="space-y-4 sm:space-y-6">
            {groupedSkills.map(({ category, skills: catSkills }) => (
              <div key={category.value}>
                <h2 className={`text-sm sm:text-base font-semibold mb-3 flex items-center gap-2 ${
                  CATEGORY_COLORS[category.value].split(' ')[1]
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    CATEGORY_COLORS[category.value].split(' ')[0]
                  }`}></span>
                  {category.label}
                  <span className="text-cafe-600 font-normal">({catSkills.length})</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                  {catSkills.map((skill) => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      onEdit={handleEditSkill}
                      onDelete={handleDeleteSkill}
                      onDuplicate={handleDuplicateSkill}
                      onView={handleViewSkill}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Flat view when filtering by category
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            {filteredSkills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onEdit={handleEditSkill}
                onDelete={handleDeleteSkill}
                onDuplicate={handleDuplicateSkill}
                onView={handleViewSkill}
              />
            ))}
          </div>
        )}
      </div>
      <SkillEditorDialog
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSuccess={handleSuccess}
        skill={editingSkill}
        readOnly={isViewMode}
      />
    </>
  );
}
