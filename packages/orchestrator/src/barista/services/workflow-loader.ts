/**
 * Workflow Loader Service
 *
 * Extracted from barista-engine-v2.ts loadDefaultWorkflow() (80 lines)
 * Centralizes workflow loading, YAML parsing, and skill loading
 */

import * as path from 'path';
import * as yaml from 'yaml';
import * as fs from 'fs/promises';
import { createLogger } from '@codecafe/core';
import { SKILL_FILE_MAP } from '../../constants/skills';
import type { WorkflowConfig, SessionStageConfig } from '../../session';

const logger = createLogger({ context: 'WorkflowLoader' });

/**
 * Raw workflow stage configuration from YAML
 */
interface RawStageConfig {
  provider?: string;
  role?: string;
  mode?: string;
  on_failure?: string;
  skills?: string[];
}

/**
 * Raw workflow configuration from YAML
 */
interface RawWorkflowConfig {
  workflow: { stages: string[] };
  [key: string]: RawStageConfig | { stages: string[] } | undefined;
}

/**
 * Skill cache entry
 */
interface SkillCacheEntry {
  content: string;
  timestamp: number;
}

/**
 * Workflow loader configuration
 */
export interface WorkflowLoaderConfig {
  /** Path to workflow YAML file */
  workflowPath?: string;

  /** Project root path */
  projectRoot?: string;

  /** Enable skill caching */
  enableCache?: boolean;

  /** Cache TTL in milliseconds */
  cacheTtl?: number;
}

/**
 * Workflow Loader Service
 *
 * Loads workflow configuration from YAML files, including:
 * - Workflow stage definitions
 * - Skill instruction loading
 * - Stage prompt building with role instructions
 */
export class WorkflowLoader {
  private readonly skillCache = new Map<string, SkillCacheEntry>();
  private readonly skillCacheStats = { hits: 0, misses: 0 };
  private readonly config: Required<WorkflowLoaderConfig>;

  // Cache configuration
  private readonly SKILL_CACHE_MAX_SIZE = 100;

  constructor(config: WorkflowLoaderConfig = {}) {
    this.config = {
      workflowPath: config.workflowPath ?? 'desktop/workflows/moonshot-lite.workflow.yml',
      projectRoot: config.projectRoot ?? path.join(__dirname, '../../..'),
      enableCache: config.enableCache ?? true,
      cacheTtl: config.cacheTtl ?? 5 * 60 * 1000, // 5 minutes
    };
  }

  /**
   * Load workflow from YAML file
   * @param orderPrompt User prompt for the order
   * @returns Workflow configuration
   */
  async load(orderPrompt: string): Promise<WorkflowConfig> {
    const workflowPath = path.join(this.config.projectRoot, this.config.workflowPath);

    logger.debug('Loading workflow', { workflowPath });

    try {
      const rawConfig = await this.loadYamlFile(workflowPath);
      const skills = await this.loadSkills(rawConfig);
      return this.buildWorkflowConfig(rawConfig, skills, orderPrompt);
    } catch (error) {
      logger.warn('Failed to load default workflow', { error });
      return this.getFallbackWorkflow(orderPrompt);
    }
  }

  /**
   * Load and parse YAML workflow file
   */
  private async loadYamlFile(workflowPath: string): Promise<RawWorkflowConfig> {
    const content = await fs.readFile(workflowPath, 'utf-8');
    const parsed = yaml.parse(content) as RawWorkflowConfig;

    logger.debug('Parsed workflow stages', { stages: parsed.workflow.stages });

    return parsed;
  }

  /**
   * Load skill contents for all stages in the workflow
   */
  private async loadSkills(rawConfig: RawWorkflowConfig): Promise<Map<string, string[]>> {
    const skillsMap = new Map<string, string[]>();

    // Load skills for each stage
    for (const stageId of rawConfig.workflow.stages) {
      const stageConfig = rawConfig[stageId] as RawStageConfig;

      if (stageConfig?.skills && stageConfig.skills.length > 0) {
        const skillContents: string[] = [];

        // Load skills in parallel
        const skillPromises = stageConfig.skills.map(skillName =>
          this.loadSkillContent(skillName)
        );
        const loadedSkills = await Promise.all(skillPromises);

        // Filter out null results
        for (const content of loadedSkills) {
          if (content !== null) {
            skillContents.push(content);
          }
        }

        skillsMap.set(stageId, skillContents);
      }
    }

    return skillsMap;
  }

  /**
   * Load skill content from JSON file with caching
   */
  private async loadSkillContent(skillName: string): Promise<string | null> {
    if (!this.config.enableCache) {
      return this.loadSkillContentFromDisk(skillName);
    }

    const cacheKey = `${skillName}:${this.config.projectRoot}`;
    const now = Date.now();

    // Check cache
    const cached = this.skillCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < this.config.cacheTtl) {
      this.skillCacheStats.hits++;
      logger.debug(`Skill cache hit: ${skillName}`, { cacheKey });
      return cached.content;
    }

    this.skillCacheStats.misses++;

    // Load from disk
    const content = await this.loadSkillContentFromDisk(skillName);

    if (content !== null) {
      this.cacheSkillContent(cacheKey, content);
    }

    return content;
  }

  /**
   * Load skill content from disk (no cache)
   */
  private async loadSkillContentFromDisk(skillName: string): Promise<string | null> {
    const jsonFileName = SKILL_FILE_MAP[skillName as keyof typeof SKILL_FILE_MAP] ?? skillName;

    const possiblePaths = [
      path.join(this.config.projectRoot, `desktop/skills/${jsonFileName}.json`),
      path.join(this.config.projectRoot, `packages/desktop/skills/${jsonFileName}.json`),
    ];

    for (const skillPath of possiblePaths) {
      try {
        const content = await fs.readFile(skillPath, 'utf-8');
        const skillData = JSON.parse(content) as { instructions?: string };
        if (skillData.instructions) {
          logger.debug(`Loaded skill instructions: ${skillName}`, { skillPath });
          return skillData.instructions;
        }
      } catch (error: unknown) {
        const err = error as { code?: string };
        if (err.code !== 'ENOENT') {
          logger.warn(`Error loading skill "${skillName}"`, { skillPath, error });
        }
      }
    }

    logger.warn(`Skill not found or no instructions: ${skillName}`);
    return null;
  }

  /**
   * Cache skill content with LRU eviction
   */
  private cacheSkillContent(cacheKey: string, content: string): void {
    // Evict oldest entries if cache is full
    if (this.skillCache.size >= this.SKILL_CACHE_MAX_SIZE) {
      const oldestKey = this.findOldestCacheEntry();
      if (oldestKey) {
        this.skillCache.delete(oldestKey);
      }
    }

    this.skillCache.set(cacheKey, {
      content,
      timestamp: Date.now(),
    });
  }

  /**
   * Find oldest cache entry for eviction
   */
  private findOldestCacheEntry(): string | null {
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [key, entry] of this.skillCache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * Build workflow configuration from raw config and skills
   */
  private buildWorkflowConfig(
    rawConfig: RawWorkflowConfig,
    skillsMap: Map<string, string[]>,
    orderPrompt: string
  ): WorkflowConfig {
    // Import prompt builders dynamically to avoid circular dependency
    const { getRoleDescription, getRoleInstructions, SIGNAL_FORMAT_TEMPLATE, CRITICAL_REMINDER } = require('../prompts');

    const stages: SessionStageConfig[] = rawConfig.workflow.stages.map((stageId: string) => {
      const stageConfig = rawConfig[stageId] as RawStageConfig;
      const skillContents = skillsMap.get(stageId) ?? [];

      logger.debug('Stage config', {
        stageId,
        skills: stageConfig.skills,
        provider: stageConfig.provider,
        role: stageConfig.role
      });

      // Build stage prompt with role instructions and skill contents
      const stagePrompt = this.buildStagePrompt(
        stageId,
        orderPrompt,
        skillContents,
        getRoleDescription,
        getRoleInstructions,
        SIGNAL_FORMAT_TEMPLATE,
        CRITICAL_REMINDER
      );

      return {
        id: stageId,
        name: stageConfig.role || stageId,
        provider: (stageConfig.provider || 'claude-code') as 'claude-code' | 'codex' | 'gemini' | 'grok',
        prompt: stagePrompt,
        role: stageConfig.role,
        mode: (stageConfig.mode || 'sequential') as 'sequential' | 'parallel',
        dependsOn: [],
        skills: stageConfig.skills,
      };
    });

    logger.info(`Loaded workflow with ${stages.length} stages`, {
      stages: stages.map(s => ({ id: s.id, name: s.name, skills: s.skills }))
    });

    return { stages, vars: {} };
  }

  /**
   * Build stage prompt with skill instructions
   */
  private buildStagePrompt(
    stageId: string,
    orderPrompt: string,
    skillContents: string[],
    getRoleDescription: (id: string) => string,
    getRoleInstructions: (id: string) => string,
    signalFormatTemplate: string,
    criticalReminder: string
  ): string {
    const parts: string[] = [
      `# Stage: ${stageId.toUpperCase()}`,
      '',
      getRoleDescription(stageId),
      '',
      '## Role Instructions',
      getRoleInstructions(stageId),
      '',
    ];

    // Add skill instructions if available
    if (skillContents.length > 0) {
      parts.push('## Skills to Execute', '');
      parts.push('Follow these skill instructions in order:', '');
      for (const skillContent of skillContents) {
        parts.push(`---\n${skillContent}\n---`, '');
      }
    }

    parts.push('## User Request', '', orderPrompt, '');
    parts.push(signalFormatTemplate, '');
    parts.push(criticalReminder);

    return parts.join('\n');
  }

  /**
   * Get fallback workflow when loading fails
   */
  private getFallbackWorkflow(orderPrompt: string): WorkflowConfig {
    return {
      stages: [{
        id: 'main',
        name: 'Main',
        provider: 'claude-code',
        prompt: orderPrompt,
        mode: 'sequential',
        dependsOn: [],
      }],
      vars: {},
    };
  }

  /**
   * Get skill cache statistics
   */
  getSkillCacheStatistics(): { hits: number; misses: number; hitRate: string; size: number } {
    const total = this.skillCacheStats.hits + this.skillCacheStats.misses;
    const hitRate = total > 0
      ? ((this.skillCacheStats.hits / total) * 100).toFixed(1) + '%'
      : '0%';

    return {
      hits: this.skillCacheStats.hits,
      misses: this.skillCacheStats.misses,
      hitRate,
      size: this.skillCache.size,
    };
  }

  /**
   * Clear skill cache
   */
  clearSkillCache(): void {
    this.skillCache.clear();
    this.skillCacheStats.hits = 0;
    this.skillCacheStats.misses = 0;
    logger.debug('Skill cache cleared');
  }
}

/**
 * Create workflow loader with default configuration
 */
export function createWorkflowLoader(config?: WorkflowLoaderConfig): WorkflowLoader {
  return new WorkflowLoader(config);
}
