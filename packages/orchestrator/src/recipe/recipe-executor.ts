/**
 * Recipe Executor
 * 
 * 레시피 스테이지 순차/병렬 실행 관리
 * moonshot-orchestrator 패턴 구현
 */

import { ClaudeCodeAdapter, ExecutionContext } from '../terminal/adapters/claude-code-adapter';
import { RecipeContext, ContextPatch, ContextData } from './recipe-context';

// ============================================================================
// Types
// ============================================================================

export interface RecipeStage {
  id: string;
  name: string;
  prompt: string;
  systemPrompt?: string;
  continueSession?: boolean;
  timeout?: number;
  role?: {
    name: string;
    template?: string;
  };
}

export interface RecipeStageResult {
  stageId: string;
  success: boolean;
  output?: string;
  error?: string;
  contextPatch?: ContextPatch;
  duration: number;
}

export interface ParallelGroup {
  stages: RecipeStage[];
}

export interface RecipeExecutorOptions {
  cwd: string;
  context: RecipeContext;
  adapter?: ClaudeCodeAdapter;
  onStageStart?: (stage: RecipeStage) => void;
  onStageComplete?: (result: RecipeStageResult) => void;
  onOutput?: (stageId: string, data: string) => void;
}

// ============================================================================
// RecipeExecutor Class
// ============================================================================

export class RecipeExecutor {
  private context: RecipeContext;
  private adapter: ClaudeCodeAdapter;
  private cwd: string;
  private onStageStart?: (stage: RecipeStage) => void;
  private onStageComplete?: (result: RecipeStageResult) => void;
  private onOutput?: (stageId: string, data: string) => void;

  constructor(options: RecipeExecutorOptions) {
    this.context = options.context;
    this.cwd = options.cwd;
    this.adapter = options.adapter || new ClaudeCodeAdapter();
    this.onStageStart = options.onStageStart;
    this.onStageComplete = options.onStageComplete;
    this.onOutput = options.onOutput;
  }

  /**
   * Execute a single stage
   */
  async executeStage(stage: RecipeStage): Promise<RecipeStageResult> {
    const startTime = Date.now();
    
    // Notify stage start
    this.onStageStart?.(stage);

    // Build system prompt with context
    const systemPrompt = this.buildSystemPrompt(stage);

    try {
      // Create execution context
      const execCtx: ExecutionContext = {
        prompt: stage.prompt,
        systemPrompt,
        continueSession: stage.continueSession,
        cwd: this.cwd,
      };

      // Spawn and execute
      const ptyProcess = await this.adapter.spawn({ cwd: this.cwd });
      const result = await this.adapter.execute(
        ptyProcess,
        execCtx,
        (data) => this.onOutput?.(stage.id, data)
      );

      // Try to extract context patch from output
      const contextPatch = this.extractContextPatch(result.output || '');

      // Merge patch into context
      if (contextPatch) {
        this.context.merge(contextPatch);
      }

      // Add success note
      this.context.addNote(`✅ Stage ${stage.id} completed`);

      const stageResult: RecipeStageResult = {
        stageId: stage.id,
        success: result.success,
        output: result.output,
        error: result.error,
        contextPatch,
        duration: Date.now() - startTime,
      };

      // Notify stage complete
      this.onStageComplete?.(stageResult);

      // Save context after each stage
      await this.context.save();

      return stageResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Add error note
      this.context.addNote(`❌ Stage ${stage.id} failed: ${errorMessage}`);
      await this.context.save();

      const stageResult: RecipeStageResult = {
        stageId: stage.id,
        success: false,
        error: errorMessage,
        duration: Date.now() - startTime,
      };

      this.onStageComplete?.(stageResult);
      return stageResult;
    }
  }

  /**
   * Execute stages sequentially
   */
  async executeSequential(stages: RecipeStage[]): Promise<RecipeStageResult[]> {
    const results: RecipeStageResult[] = [];

    for (const stage of stages) {
      const result = await this.executeStage(stage);
      results.push(result);

      // Stop on failure (optional: could be configurable)
      if (!result.success) {
        break;
      }
    }

    return results;
  }

  /**
   * Execute stages in parallel
   */
  async executeParallel(stages: RecipeStage[]): Promise<RecipeStageResult[]> {
    // Take snapshot for all parallel workers
    const snapshot = this.context.snapshot();

    // Execute all stages in parallel
    const promises = stages.map(stage => 
      this.executeStageWithSnapshot(stage, snapshot)
    );

    const results = await Promise.all(promises);

    // Merge all patches
    const patches = results
      .filter((r): r is RecipeStageResult & { contextPatch: ContextPatch } => 
        r.contextPatch !== undefined
      )
      .map(r => r.contextPatch);
    
    this.context.mergePatches(patches);
    await this.context.save();

    return results;
  }

  /**
   * Execute a stage with a frozen snapshot (for parallel execution)
   */
  private async executeStageWithSnapshot(
    stage: RecipeStage,
    snapshot: Readonly<ContextData>
  ): Promise<RecipeStageResult> {
    const startTime = Date.now();
    
    this.onStageStart?.(stage);

    // Build system prompt from snapshot
    const systemPrompt = this.buildSystemPromptFromSnapshot(stage, snapshot);

    try {
      const execCtx: ExecutionContext = {
        prompt: stage.prompt,
        systemPrompt,
        continueSession: false, // No continue in parallel mode
        cwd: this.cwd,
      };

      const ptyProcess = await this.adapter.spawn({ cwd: this.cwd });
      const result = await this.adapter.execute(
        ptyProcess,
        execCtx,
        (data) => this.onOutput?.(stage.id, data)
      );

      const contextPatch = this.extractContextPatch(result.output || '');

      const stageResult: RecipeStageResult = {
        stageId: stage.id,
        success: result.success,
        output: result.output,
        error: result.error,
        contextPatch,
        duration: Date.now() - startTime,
      };

      this.onStageComplete?.(stageResult);
      return stageResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      const stageResult: RecipeStageResult = {
        stageId: stage.id,
        success: false,
        error: errorMessage,
        duration: Date.now() - startTime,
      };

      this.onStageComplete?.(stageResult);
      return stageResult;
    }
  }

  /**
   * Execute a workflow with sequential and parallel groups
   */
  async executeWorkflow(
    sequentialStages: RecipeStage[],
    parallelGroups?: ParallelGroup[]
  ): Promise<RecipeStageResult[]> {
    const allResults: RecipeStageResult[] = [];

    // Execute sequential stages first
    const seqResults = await this.executeSequential(sequentialStages);
    allResults.push(...seqResults);

    // Check if sequential succeeded
    const seqFailed = seqResults.some(r => !r.success);
    if (seqFailed) {
      return allResults;
    }

    // Execute parallel groups
    if (parallelGroups) {
      for (const group of parallelGroups) {
        const parallelResults = await this.executeParallel(group.stages);
        allResults.push(...parallelResults);
      }
    }

    return allResults;
  }

  /**
   * Build system prompt including context
   */
  private buildSystemPrompt(stage: RecipeStage): string {
    const contextSection = this.context.toSystemPromptSection();
    const stagePrompt = stage.systemPrompt || '';
    
    // Role Template 적용
    let roleSection = '';
    if (stage.role) {
      if (stage.role.template) {
        roleSection = stage.role.template;
      } else {
        roleSection = `You are acting as ${stage.role.name}.`;
      }
    }

    return `
${roleSection}

${stagePrompt}

${contextSection}

# Output Format
결과를 YAML 패치로 반환:
\`\`\`yaml
contextPatch:
  signals:
    stepCompleted: true
  notes:
    - "발견된 내용"
\`\`\`
`.trim();
  }

  /**
   * Build system prompt from a snapshot (for parallel execution)
   */
  private buildSystemPromptFromSnapshot(
    stage: RecipeStage,
    snapshot: Readonly<ContextData>
  ): string {
    const stagePrompt = stage.systemPrompt || '';

    const contextSection = `
# Current Context
- Task Type: ${snapshot.request.taskType}
- Phase: ${snapshot.phase}
- Complexity: ${snapshot.complexity}

## Signals
${Object.entries(snapshot.signals)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join('\n')}
`.trim();

    return `
${stagePrompt}

${contextSection}

# Output Format
결과를 YAML 패치로 반환:
\`\`\`yaml
contextPatch:
  signals:
    stepCompleted: true
  notes:
    - "발견된 내용"
\`\`\`
`.trim();
  }

  /**
   * Extract context patch from Claude output
   */
  private extractContextPatch(output: string): ContextPatch | undefined {
    // Look for YAML code block with contextPatch
    const yamlMatch = output.match(/```ya?ml\s*([\s\S]*?)```/);
    if (!yamlMatch) {
      return undefined;
    }

    try {
      // Dynamic import would be better but for simplicity:
      const yaml = require('yaml');
      const parsed = yaml.parse(yamlMatch[1]);
      return parsed?.contextPatch || parsed;
    } catch {
      return undefined;
    }
  }
}
