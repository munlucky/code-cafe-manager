/**
 * Workflow Service
 * Business logic for workflow management, extracted from IPC handlers
 */

import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import {
  createLogger,
  safeParseWorkflowYaml,
  parseStageAssignment,
} from '@codecafe/core';
import type { StageAssignment, WorkflowInfo } from '@codecafe/core';

const logger = createLogger({ context: 'WorkflowService' });

/**
 * WorkflowService dependencies
 */
export interface WorkflowServiceDependencies {
  orchDir?: string;
}

/**
 * Default stages when not specified in workflow
 */
const DEFAULT_STAGES = ['plan', 'code', 'test', 'check'];

/**
 * WorkflowService - Business logic for workflow management
 */
export class WorkflowService {
  private readonly orchDir: string;

  constructor(deps?: WorkflowServiceDependencies) {
    this.orchDir = deps?.orchDir || this.resolveOrchDir();
  }

  // ============================================
  // Directory Resolution
  // ============================================

  /**
   * Resolve orchestrator directory from environment or defaults
   */
  private resolveOrchDir(): string {
    const envDir = process.env.CODECAFE_ORCH_DIR;
    if (envDir && fs.existsSync(envDir)) {
      return envDir;
    }

    const candidates = [
      process.cwd(),
      path.join(process.cwd(), '.orch'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return path.join(process.cwd(), '.orch');
  }

  /**
   * Get current orchestrator directory
   */
  getOrchDir(): string {
    return this.orchDir;
  }

  /**
   * Get workflows directory path
   */
  private getWorkflowsDir(): string {
    return path.join(this.orchDir, 'workflows');
  }

  /**
   * Get workflow file path by ID
   */
  private getWorkflowPath(id: string): string {
    return path.join(this.getWorkflowsDir(), `${id}.workflow.yml`);
  }

  // ============================================
  // Workflow CRUD Operations
  // ============================================

  /**
   * List all workflows
   */
  listWorkflows(): WorkflowInfo[] {
    const workflowsDir = this.getWorkflowsDir();
    logger.debug('Listing workflows', { workflowsDir });

    if (!fs.existsSync(workflowsDir)) {
      return [];
    }

    const files = fs.readdirSync(workflowsDir);
    const workflowFiles = files.filter((file: string) => file.endsWith('.workflow.yml'));

    return workflowFiles.map((file: string) => {
      const id = file.replace('.workflow.yml', '');
      const info = this.parseWorkflowFile(path.join(workflowsDir, file), id);
      if (info) {
        return info;
      }
      return this.createDefaultWorkflowInfo(id);
    });
  }

  /**
   * Get a single workflow by ID
   */
  getWorkflow(id: string): WorkflowInfo | null {
    const workflowPath = this.getWorkflowPath(id);

    if (!fs.existsSync(workflowPath)) {
      return null;
    }

    const parsed = this.parseWorkflowFile(workflowPath, id);
    if (parsed) {
      return parsed;
    }

    return this.createDefaultWorkflowInfo(id);
  }

  /**
   * Create a new workflow
   */
  createWorkflow(workflowData: WorkflowInfo): WorkflowInfo {
    const workflowsDir = this.getWorkflowsDir();
    if (!fs.existsSync(workflowsDir)) {
      fs.mkdirSync(workflowsDir, { recursive: true });
    }

    const filePath = this.getWorkflowPath(workflowData.id);
    if (fs.existsSync(filePath)) {
      throw new Error(`Workflow with id "${workflowData.id}" already exists.`);
    }

    this.writeWorkflowFile(filePath, workflowData);
    logger.info('Workflow created', { id: workflowData.id });
    return workflowData;
  }

  /**
   * Update an existing workflow
   */
  updateWorkflow(workflowData: WorkflowInfo): WorkflowInfo {
    const filePath = this.getWorkflowPath(workflowData.id);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Workflow with id "${workflowData.id}" not found.`);
    }

    // Check if workflow is protected
    const existingWorkflow = this.getWorkflow(workflowData.id);
    if (existingWorkflow?.protected) {
      throw new Error(`Cannot modify protected workflow: ${workflowData.id}`);
    }

    logger.debug('Updating workflow', { id: workflowData.id });

    this.writeWorkflowFile(filePath, workflowData);

    // Return freshly parsed data from file to ensure consistency
    const freshData = this.parseWorkflowFile(filePath, workflowData.id);
    if (freshData) {
      logger.info('Workflow updated', { id: workflowData.id });
      return freshData;
    }

    return workflowData;
  }

  /**
   * Delete a workflow
   */
  deleteWorkflow(id: string): { success: boolean } {
    // Check if workflow is protected
    const workflow = this.getWorkflow(id);
    if (workflow?.protected) {
      throw new Error(`Cannot delete protected workflow: ${id}`);
    }

    const filePath = this.getWorkflowPath(id);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info('Workflow deleted', { id });
    }
    return { success: true };
  }

  // ============================================
  // YAML Parsing & Writing
  // ============================================

  /**
   * Parse workflow info from YAML file
   */
  parseWorkflowFile(filePath: string, id: string): WorkflowInfo | null {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return this.parseWorkflowContent(content, filePath, id);
    } catch (error) {
      logger.error('Error reading workflow file', { filePath, error });
      return null;
    }
  }

  /**
   * Parse workflow content from YAML string
   */
  parseWorkflowContent(content: string, filePath: string, id: string): WorkflowInfo | null {
    try {
      const raw = yaml.load(content);
      const parseResult = safeParseWorkflowYaml(raw);

      if (!parseResult.success) {
        logger.warn('Invalid workflow YAML format', {
          filePath,
          error: parseResult.error.message
        });
        // Fall through to use raw data with defaults
      }

      // Use parsed data or raw data
      const parsed = parseResult.success ? parseResult.data : (raw as Record<string, unknown>);
      const workflow = (parsed?.workflow as Record<string, unknown>) || parsed;

      const stages = Array.isArray(workflow?.stages)
        ? (workflow.stages as string[])
        : DEFAULT_STAGES;
      const name = this.extractName(workflow, id);
      const description = this.extractDescription(workflow, id);

      logger.debug('Parsing workflow', { filePath, id, stages });

      // Parse stage configs (provider/role/profile settings)
      // Note: stage settings are at root level, not inside workflow object
      const stageConfigs = this.parseStageConfigs(parsed, stages);

      logger.debug('Parsed stageConfigs', { stages: Object.keys(stageConfigs) });

      return {
        id,
        name,
        description,
        stages,
        stageConfigs: Object.keys(stageConfigs).length > 0 ? stageConfigs : undefined,
        isDefault: workflow?.isDefault === true,
        protected: workflow?.protected === true,
      };
    } catch (error) {
      logger.error('Error parsing workflow content', { filePath, error });
      return null;
    }
  }

  /**
   * Write workflow to YAML file
   */
  private writeWorkflowFile(filePath: string, workflowData: WorkflowInfo): void {
    const assignments = workflowData.stageConfigs || {};

    const stageConfigs: Record<string, unknown> = {};
    for (const stage of workflowData.stages) {
      const config = assignments[stage];
      if (config) {
        const cleanConfig = Object.fromEntries(
          Object.entries(config).filter(([_, v]) => v !== undefined)
        );
        stageConfigs[stage] = cleanConfig;
      } else {
        stageConfigs[stage] = 'simple';
      }
    }

    const yamlData = {
      workflow: {
        name: workflowData.name,
        description: workflowData.description,
        stages: workflowData.stages,
      },
      ...stageConfigs,
    };

    const content = yaml.dump(yamlData);
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Create default workflow info for fallback
   */
  private createDefaultWorkflowInfo(id: string): WorkflowInfo {
    return {
      id,
      name: id.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      description: `Workflow: ${id}`,
      stages: DEFAULT_STAGES,
    };
  }

  /**
   * Extract workflow name from parsed data
   */
  private extractName(workflow: Record<string, unknown> | undefined, id: string): string {
    if (typeof workflow?.name === 'string' && workflow.name) {
      return workflow.name;
    }
    return id.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  }

  /**
   * Extract workflow description from parsed data
   */
  private extractDescription(workflow: Record<string, unknown> | undefined, id: string): string {
    if (typeof workflow?.description === 'string' && workflow.description) {
      return workflow.description;
    }
    return `Workflow: ${id}`;
  }

  /**
   * Parse stage configurations from workflow data
   */
  private parseStageConfigs(
    parsed: Record<string, unknown> | null,
    stages: string[]
  ): Record<string, StageAssignment> {
    const stageConfigs: Record<string, StageAssignment> = {};

    if (!parsed) {
      return stageConfigs;
    }

    for (const stage of stages) {
      const stageConfig = parsed[stage];
      const assignment = parseStageAssignment(stageConfig);

      if (assignment) {
        // Ensure provider has a default value
        if (!assignment.provider) {
          assignment.provider = 'claude-code';
        }
        // Handle legacy profile extraction from string format
        if (typeof stageConfig === 'object' && stageConfig !== null) {
          const config = stageConfig as Record<string, unknown>;
          if (!assignment.profile && typeof config.profile !== 'string') {
            assignment.profile = 'simple';
          }
        }
        logger.debug('Stage config parsed', { stage, skills: assignment.skills });
        stageConfigs[stage] = assignment;
      }
    }

    return stageConfigs;
  }
}
