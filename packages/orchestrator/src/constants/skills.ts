/**
 * Skill Name Constants
 *
 * Extracted from barista-engine-v2.ts skillNameMap for type safety
 */

/**
 * Known skill identifiers
 */
export const SKILL_NAMES = {
  CLASSIFY_TASK: 'classify-task',
  EVALUATE_COMPLEXITY: 'evaluate-complexity',
  DETECT_UNCERTAINTY: 'detect-uncertainty',
  DECIDE_SEQUENCE: 'decide-sequence',
  PRE_FLIGHT_CHECK: 'pre-flight-check',
  IMPLEMENTATION_RUNNER: 'implementation-runner',
  CODEX_REVIEW_CODE: 'codex-review-code',
  CODEX_TEST_INTEGRATION: 'codex-test-integration',
  REQUIREMENTS_ANALYZER: 'requirements-analyzer',
  CONTEXT_BUILDER: 'context-builder',
} as const;

/**
 * Type for skill names
 */
export type SkillName = (typeof SKILL_NAMES)[keyof typeof SKILL_NAMES];

/**
 * Map of skill IDs to their corresponding JSON file names
 * Used for loading skill instructions from desktop/skills/*.json
 */
export const SKILL_FILE_MAP: Record<SkillName, string> = {
  [SKILL_NAMES.CLASSIFY_TASK]: 'classify-task',
  [SKILL_NAMES.EVALUATE_COMPLEXITY]: 'evaluate-complexity',
  [SKILL_NAMES.DETECT_UNCERTAINTY]: 'detect-uncertainty',
  [SKILL_NAMES.DECIDE_SEQUENCE]: 'decide-sequence',
  [SKILL_NAMES.PRE_FLIGHT_CHECK]: 'pre-flight-check',
  [SKILL_NAMES.IMPLEMENTATION_RUNNER]: 'implementation-runner',
  [SKILL_NAMES.CODEX_REVIEW_CODE]: 'codex-review-code',
  [SKILL_NAMES.CODEX_TEST_INTEGRATION]: 'codex-test-integration',
  [SKILL_NAMES.REQUIREMENTS_ANALYZER]: 'requirements-analyzer',
  [SKILL_NAMES.CONTEXT_BUILDER]: 'context-builder',
};

/**
 * Get the JSON file name for a skill
 */
export function getSkillFileName(skillName: string): string {
  return SKILL_FILE_MAP[skillName as SkillName] ?? skillName;
}

/**
 * Check if a string is a known skill name
 */
export function isKnownSkill(name: string): name is SkillName {
  return Object.values(SKILL_NAMES).includes(name as SkillName);
}
