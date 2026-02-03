/**
 * Prompt Templates and Constants
 *
 * Centralized location for stage prompts, role instructions, and signal formats
 */

export {
  ROLE_DESCRIPTIONS,
  ROLE_INSTRUCTIONS,
  getRoleDescription,
  getRoleInstructions,
} from './role-instructions';

export {
  SIGNAL_FORMAT_TEMPLATE,
  CRITICAL_REMINDER,
  type SignalAction,
  type SignalComplexity,
  type StageSignals,
} from './signal-format';
