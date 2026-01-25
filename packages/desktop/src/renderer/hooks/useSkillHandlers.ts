/**
 * Skill CRUD handlers hook
 */

import { useCallback } from 'react';
import type { Skill as DesignSkill } from '../types/design';
import { convertToDesignSkill, convertToBackendSkill } from '../utils/converters';

interface UseSkillHandlersOptions {
  onSkillsChange: React.Dispatch<React.SetStateAction<DesignSkill[]>>;
}

export function useSkillHandlers({ onSkillsChange }: UseSkillHandlersOptions) {
  const handleAddSkill = useCallback(
    async (skill: DesignSkill) => {
      const backendSkill = convertToBackendSkill(skill);
      const res = await window.codecafe.skill.create(backendSkill);
      if (res.success && res.data) {
        onSkillsChange((prev) => [...prev, convertToDesignSkill(res.data!)]);
      }
    },
    [onSkillsChange]
  );

  const handleUpdateSkill = useCallback(
    async (skill: DesignSkill) => {
      const backendSkill = convertToBackendSkill(skill);
      const res = await window.codecafe.skill.update(backendSkill);
      if (res.success && res.data) {
        onSkillsChange((prev) =>
          prev.map((s) =>
            s.id === skill.id ? convertToDesignSkill(res.data!) : s
          )
        );
      }
    },
    [onSkillsChange]
  );

  const handleDeleteSkill = useCallback(
    async (id: string) => {
      const res = await window.codecafe.skill.delete(id);
      if (res.success) {
        onSkillsChange((prev) => prev.filter((s) => s.id !== id));
      }
    },
    [onSkillsChange]
  );

  const handleDuplicateSkill = useCallback(
    async (skill: DesignSkill) => {
      const duplicatedSkill: DesignSkill = {
        ...skill,
        id: `${skill.id}-copy-${Date.now()}`,
        name: `${skill.name} (Copy)`,
        isBuiltIn: false,
      };
      const backendSkill = convertToBackendSkill(duplicatedSkill);
      const res = await window.codecafe.skill.create(backendSkill);
      if (res.success && res.data) {
        onSkillsChange((prev) => [...prev, convertToDesignSkill(res.data!)]);
      }
    },
    [onSkillsChange]
  );

  return {
    handleAddSkill,
    handleUpdateSkill,
    handleDeleteSkill,
    handleDuplicateSkill,
  };
}
