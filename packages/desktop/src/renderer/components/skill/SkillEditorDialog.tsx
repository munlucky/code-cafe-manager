import { useState, useEffect, type ReactElement } from 'react';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { Skill, SkillCategory } from '../../types/models';

interface SkillEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (skill: Skill) => void;
  skill?: Skill | null;
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

export function SkillEditorDialog({
  isOpen,
  onClose,
  onSuccess,
  skill,
}: SkillEditorDialogProps): ReactElement {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<SkillCategory>('utility');
  const [skillCommand, setSkillCommand] = useState('');
  const [context, setContext] = useState<'fork' | 'inherit'>('fork');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!skill;

  useEffect(() => {
    if (isOpen) {
      if (skill) {
        setId(skill.id);
        setName(skill.name);
        setDescription(skill.description);
        setCategory(skill.category);
        setSkillCommand(skill.skillCommand);
        setContext(skill.context || 'fork');
      } else {
        setId('');
        setName('');
        setDescription('');
        setCategory('utility');
        setSkillCommand('');
        setContext('fork');
      }
      setError(null);
    }
  }, [isOpen, skill]);

  const handleSubmit = async () => {
    // Validation
    if (!id.trim()) {
      setError('Skill ID is required');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(id)) {
      setError('Skill ID must contain only lowercase letters, numbers, and hyphens');
      return;
    }
    if (!name.trim()) {
      setError('Skill name is required');
      return;
    }
    if (!skillCommand.trim()) {
      setError('Skill command is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const skillData: Skill = {
        id,
        name,
        description,
        category,
        skillCommand,
        context,
        isBuiltIn: false,
      };

      const response = isEditing
        ? await window.codecafe.skill.update(skillData)
        : await window.codecafe.skill.create(skillData);

      if (response.success && response.data) {
        onSuccess(response.data);
        onClose();
      } else {
        throw new Error(response.error?.message || 'Failed to save skill');
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
      title={isEditing ? 'Edit Skill' : 'New Skill'}
      size="medium"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="skill-id" className="block text-sm font-medium text-gray-400 mb-1">
              ID
            </label>
            <Input
              id="skill-id"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="e.g., my-custom-skill"
              disabled={isEditing}
            />
            <p className="text-xs text-gray-500 mt-1">
              Workflow stage에서 이 ID로 스킬을 참조합니다
            </p>
          </div>
          <div>
            <label htmlFor="skill-name" className="block text-sm font-medium text-gray-400 mb-1">
              Name
            </label>
            <Input
              id="skill-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My Custom Skill"
            />
          </div>
        </div>

        <div>
          <label htmlFor="skill-desc" className="block text-sm font-medium text-gray-400 mb-1">
            Description
          </label>
          <Input
            id="skill-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A brief description of what this skill does"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="skill-category" className="block text-sm font-medium text-gray-400 mb-1">
              Category
            </label>
            <select
              id="skill-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as SkillCategory)}
              className="w-full px-3 py-2 bg-background border border-border rounded text-bone focus:outline-none focus:ring-2 focus:ring-coffee/50"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="skill-context" className="block text-sm font-medium text-gray-400 mb-1">
              Context Mode
            </label>
            <select
              id="skill-context"
              value={context}
              onChange={(e) => setContext(e.target.value as 'fork' | 'inherit')}
              className="w-full px-3 py-2 bg-background border border-border rounded text-bone focus:outline-none focus:ring-2 focus:ring-coffee/50"
            >
              <option value="fork">Fork (new context)</option>
              <option value="inherit">Inherit (shared context)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Fork: 독립 컨텍스트 / Inherit: 이전 단계 컨텍스트 공유
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="skill-command" className="block text-sm font-medium text-gray-400 mb-1">
            Skill Command
          </label>
          <select
            id="skill-command"
            value={skillCommand}
            onChange={(e) => setSkillCommand(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded text-bone focus:outline-none focus:ring-2 focus:ring-coffee/50"
          >
            <option value="">Select a command...</option>
            {AVAILABLE_SKILL_COMMANDS.map((cmd) => (
              <option key={cmd} value={cmd}>
                {cmd}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            또는 직접 입력:
          </p>
          <Input
            value={skillCommand}
            onChange={(e) => setSkillCommand(e.target.value)}
            placeholder="e.g., /my-custom-command or custom-agent"
            className="mt-1"
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Skill'}
        </Button>
      </div>
    </Dialog>
  );
}
