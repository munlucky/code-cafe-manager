/**
 * Signal Format Templates for Stage Output
 *
 * Extracted from barista-engine-v2.ts for maintainability
 */

/**
 * Mandatory signals block template that must be included in every stage output
 */
export const SIGNAL_FORMAT_TEMPLATE = `## MANDATORY OUTPUT FORMAT

You MUST end your response with a signals block in this EXACT format:

\`\`\`yaml
signals:
  nextAction: proceed  # proceed | await_user | skip_next | retry
  needsUserInput: false  # true only if you MUST ask the user something
  complexity: medium  # simple | medium | complex
  uncertainties:  # optional: list questions only if needsUserInput is true
    - "Question for user"
\`\`\`

**Examples of valid signals:**
- Work completed successfully: nextAction=proceed, needsUserInput=false
- Need clarification: nextAction=await_user, needsUserInput=true, uncertainties=[...]
- Simple task, skip review: nextAction=skip_next, skipStages=[review]`;

/**
 * Critical reminder about non-interactive mode
 */
export const CRITICAL_REMINDER = `## CRITICAL REMINDER
- You are in NON-INTERACTIVE mode. Do NOT ask questions unless absolutely necessary.
- Make reasonable assumptions and proceed with the task.
- Output structured results, not conversational responses.
- **ALWAYS output a signals block at the end - this is MANDATORY!**`;

/**
 * Valid signal actions
 */
export type SignalAction = 'proceed' | 'await_user' | 'skip_next' | 'retry';

/**
 * Valid complexity levels
 */
export type SignalComplexity = 'simple' | 'medium' | 'complex';

/**
 * Expected signal structure in stage output
 */
export interface StageSignals {
  nextAction: SignalAction;
  needsUserInput: boolean;
  complexity?: SignalComplexity;
  uncertainties?: string[];
  skipStages?: string[];
}
