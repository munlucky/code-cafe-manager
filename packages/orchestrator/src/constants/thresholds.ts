/**
 * Output size thresholds (in bytes)
 */
export const OUTPUT_THRESHOLDS = {
  /** Minimum output size to be considered substantial (500 bytes) */
  SUBSTANTIAL: 500,

  /** Very large output size (10KB) */
  VERY_SUBSTANTIAL: 10000,

  /** Question density threshold (per 1KB) */
  QUESTION_DENSITY: 1000,
} as const;
