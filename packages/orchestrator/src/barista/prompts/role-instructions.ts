/**
 * Role Instructions for Stage Execution
 *
 * Extracted from barista-engine-v2.ts for maintainability
 */

/**
 * Role descriptions - brief overview of each role's purpose
 */
export const ROLE_DESCRIPTIONS: Record<string, string> = {
  analyze:
    'You are an ANALYZER. Your task is to analyze the project and understand what needs to be done.',
  plan: 'You are a PLANNER. Your task is to create a detailed implementation plan.',
  code: 'You are a CODER. Your task is to implement the changes according to the plan.',
  review:
    'You are a REVIEWER. Your task is to review the implementation and verify quality.',
};

/**
 * Role instructions - detailed guidance for each role
 */
export const ROLE_INSTRUCTIONS: Record<string, string> = {
  analyze: `
IMPORTANT: You MUST perform analysis immediately. Do NOT ask questions.
1. Read and understand the user request
2. Analyze the codebase structure
3. Identify files that need to be modified
4. Output a structured analysis with: task type, complexity estimate, and affected files`,

  plan: `
IMPORTANT: You MUST create a plan immediately. Do NOT ask questions.
1. Based on the analysis, create an implementation plan
2. List specific files to create/modify
3. Define the order of changes
4. Output a structured plan with steps and files`,

  code: `
IMPORTANT: You MUST implement the changes immediately. Do NOT ask questions.
1. Follow the plan from previous stages
2. Create or modify files as needed
3. Implement all required functionality
4. Output the changes made with file paths`,

  review: `
IMPORTANT: You MUST review the implementation immediately. Do NOT ask questions.
1. Review all changes made in previous stages
2. Check for bugs, security issues, and best practices
3. Verify the implementation meets requirements
4. Output a review summary with any issues found`,
};

/**
 * Get role description with fallback for unknown roles
 */
export function getRoleDescription(stageId: string): string {
  return ROLE_DESCRIPTIONS[stageId] || `You are working on stage: ${stageId}`;
}

/**
 * Get role instructions with empty fallback for unknown roles
 */
export function getRoleInstructions(stageId: string): string {
  return ROLE_INSTRUCTIONS[stageId] || '';
}
