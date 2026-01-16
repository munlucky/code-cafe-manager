import { useState, useEffect, type ReactElement } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { SkillPreset, SkillPresetItem, SkillCategory } from '../../types/models';

interface SkillPresetEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (preset: SkillPreset) => void;
  preset?: SkillPreset | null;
}

// Available skill command options
const AVAILABLE_SKILL_COMMANDS = [
  '/moonshot-classify-task',
  '/moonshot-evaluate-complexity',
  '/moonshot-detect-uncertainty',
  '/moonshot-decide-sequence',
  '/pre-flight-check',
  '/moonshot-orchestrator',
  'requirements-analyzer',
  'context-builder',
  'implementation-runner',
  'codex-review-code',
  'codex-test-integration',
  'codex-validate-plan',
  'claude-codex-guardrail-loop',
];

// Available categories
const CATEGORIES: { value: SkillCategory; label: string }[] = [
  { value: 'analysis', label: 'Analysis' },
  { value: 'planning', label: 'Planning' },
  { value: 'implementation', label: 'Implementation' },
  { value: 'verification', label: 'Verification' },
  { value: 'utility', label: 'Utility' },
];

interface SkillItemForm extends Omit<SkillPresetItem, 'id' | 'isBuiltIn'> {
  tempId: string;
}

export function SkillPresetEditorDialog({
  isOpen,
  onClose,
  onSuccess,
  preset,
}: SkillPresetEditorDialogProps): ReactElement {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState<SkillItemForm[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddSkill, setShowAddSkill] = useState(false);

  const isEditing = !!preset;

  useEffect(() => {
    if (isOpen) {
      if (preset) {
        setId(preset.id);
        setName(preset.name);
        setDescription(preset.description);
        setSkills(
          preset.skills.map((skill, index) => ({
            tempId: `skill-${index}`,
            name: skill.name,
            description: skill.description,
            category: skill.category,
            skillCommand: skill.skillCommand,
            context: skill.context || 'fork',
          }))
        );
      } else {
        setId('');
        setName('');
        setDescription('');
        setSkills([]);
      }
      setError(null);
      setShowAddSkill(false);
    }
  }, [isOpen, preset]);

  const handleAddSkill = () => {
    setSkills([
      ...skills,
      {
        tempId: `skill-${Date.now()}`,
        name: '',
        description: '',
        category: 'utility',
        skillCommand: '',
        context: 'fork',
      },
    ]);
    setShowAddSkill(false);
  };

  const handleRemoveSkill = (tempId: string) => {
    setSkills(skills.filter((s) => s.tempId !== tempId));
  };

  const handleSkillChange = (tempId: string, field: keyof SkillItemForm, value: any) => {
    setSkills(
      skills.map((s) =>
        s.tempId === tempId ? { ...s, [field]: value } : s
      )
    );
  };

  const handleSubmit = async () => {
    // Validation
    if (!id.trim()) {
      setError('Preset ID is required');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(id)) {
      setError('Preset ID must contain only lowercase letters, numbers, and hyphens');
      return;
    }
    if (!name.trim()) {
      setError('Preset name is required');
      return;
    }
    if (skills.length === 0) {
      setError('At least one skill is required');
      return;
    }

    // Validate skills
    for (const skill of skills) {
      if (!skill.name.trim()) {
        setError('All skills must have a name');
        return;
      }
      if (!skill.skillCommand.trim()) {
        setError('All skills must have a skill command');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const presetData: SkillPreset = {
        id,
        name,
        description,
        skills: skills.map((s, index) => ({
          id: `skill-${index}`,
          name: s.name,
          description: s.description,
          category: s.category,
          skillCommand: s.skillCommand,
          context: s.context,
          isBuiltIn: false,
        })),
        isBuiltIn: false,
      };

      const response = isEditing
        ? await window.codecafe.skillPreset.update(presetData)
        : await window.codecafe.skillPreset.create(presetData);

      if (response.success && response.data) {
        onSuccess(response.data);
        onClose();
      } else {
        throw new Error(response.error?.message || 'Failed to save preset');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Skill Preset' : 'New Skill Preset'}
      size="large"
    >
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="preset-id" className="block text-sm font-medium text-gray-400 mb-1">
              ID
            </label>
            <Input
              id="preset-id"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="e.g., my-custom-preset"
              disabled={isEditing}
            />
          </div>
          <div>
            <label htmlFor="preset-name" className="block text-sm font-medium text-gray-400 mb-1">
              Name
            </label>
            <Input
              id="preset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My Custom Preset"
            />
          </div>
        </div>

        <div>
          <label htmlFor="preset-desc" className="block text-sm font-medium text-gray-400 mb-1">
            Description
          </label>
          <Input
            id="preset-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A brief description of the skill preset"
          />
        </div>

        {/* Skills Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-400">
              Skills ({skills.length})
            </label>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowAddSkill(!showAddSkill)}
              className="flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Add Skill
            </Button>
          </div>

          {skills.length === 0 ? (
            <div className="text-center py-8 bg-gray-800/50 rounded-lg border border-dashed border-gray-700">
              <p className="text-gray-500 text-sm">No skills added yet</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAddSkill(true)}
                className="mt-2"
              >
                Add your first skill
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {skills.map((skill) => (
                <div key={skill.tempId} className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Skill Name</label>
                        <Input
                          value={skill.name}
                          onChange={(e) => handleSkillChange(skill.tempId, 'name', e.target.value)}
                          placeholder="e.g., Task Classifier"
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Category</label>
                        <select
                          value={skill.category}
                          onChange={(e) => handleSkillChange(skill.tempId, 'category', e.target.value as SkillCategory)}
                          className="w-full px-3 py-2 bg-background border border-border rounded text-bone text-sm focus:outline-none focus:ring-2 focus:ring-coffee/50"
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat.value} value={cat.value}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveSkill(skill.tempId)}
                      className="p-1 h-auto ml-2 text-red-400 hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Skill Command</label>
                      <select
                        value={skill.skillCommand}
                        onChange={(e) => handleSkillChange(skill.tempId, 'skillCommand', e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-border rounded text-bone text-sm focus:outline-none focus:ring-2 focus:ring-coffee/50"
                      >
                        <option value="">Select a command...</option>
                        {AVAILABLE_SKILL_COMMANDS.map((cmd) => (
                          <option key={cmd} value={cmd}>
                            {cmd}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Context</label>
                      <select
                        value={skill.context}
                        onChange={(e) => handleSkillChange(skill.tempId, 'context', e.target.value)}
                        className="w-full px-3 py-2 bg-background border border-border rounded text-bone text-sm focus:outline-none focus:ring-2 focus:ring-coffee/50"
                      >
                        <option value="fork">Fork (new context)</option>
                        <option value="inherit">Inherit (shared context)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Description</label>
                    <Input
                      value={skill.description}
                      onChange={(e) => handleSkillChange(skill.tempId, 'description', e.target.value)}
                      placeholder="Brief description of what this skill does"
                      className="text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {showAddSkill && (
            <div className="mt-2 p-3 bg-coffee/10 rounded-lg border border-coffee/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-coffee">Quick Add Skill</span>
                <button
                  onClick={() => setShowAddSkill(false)}
                  className="text-gray-400 hover:text-bone"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_SKILL_COMMANDS.slice(0, 8).map((cmd) => (
                  <Button
                    key={cmd}
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSkills([
                        ...skills,
                        {
                          tempId: `skill-${Date.now()}`,
                          name: cmd.replace(/^[/-]/, '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
                          description: `Execute ${cmd}`,
                          category: 'utility',
                          skillCommand: cmd,
                          context: 'fork',
                        },
                      ]);
                      setShowAddSkill(false);
                    }}
                    className="text-xs text-left justify-start"
                  >
                    {cmd}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Preset'}
        </Button>
      </div>
    </Dialog>
  );
}
