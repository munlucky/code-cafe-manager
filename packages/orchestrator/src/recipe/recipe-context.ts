/**
 * Recipe Context
 * 
 * 스테이지 간 상태 공유를 위한 컨텍스트 관리
 * moonshot-orchestrator의 analysisContext 패턴 구현
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';

// ============================================================================
// Types
// ============================================================================

export interface ContextData {
  schemaVersion: string;
  request: {
    prompt: string;
    taskType: string;
    keywords: string[];
  };
  signals: Record<string, boolean>;
  estimates: {
    estimatedFiles: number;
    estimatedLines: number;
    estimatedTime: string;
  };
  phase: string;
  complexity: string;
  notes: string[];
  sessionId?: string;
}

export interface ContextPatch {
  signals?: Record<string, boolean>;
  notes?: string[];
  estimates?: Partial<ContextData['estimates']>;
  phase?: string;
  [key: string]: any;
}

export interface RecipeContextOptions {
  contextPath: string;
  maxTokens?: number;
  warningThreshold?: number;
}

// ============================================================================
// RecipeContext Class
// ============================================================================

export class RecipeContext {
  private data: ContextData;
  private contextPath: string;
  private archivesPath: string;
  private version: number = 1;
  
  private readonly MAX_TOKENS: number;
  private readonly WARNING_THRESHOLD: number;

  constructor(options: RecipeContextOptions) {
    this.contextPath = options.contextPath;
    this.archivesPath = path.join(path.dirname(options.contextPath), 'archives');
    this.MAX_TOKENS = options.maxTokens || 8000;
    this.WARNING_THRESHOLD = options.warningThreshold || 0.8;
    
    this.data = this.createDefaultContext();
  }

  /**
   * Create default context structure
   */
  private createDefaultContext(): ContextData {
    return {
      schemaVersion: '1.0',
      request: {
        prompt: '',
        taskType: 'unknown',
        keywords: [],
      },
      signals: {
        hasContextMd: false,
        hasPendingQuestions: false,
        requirementsClear: false,
        implementationReady: false,
        implementationComplete: false,
      },
      estimates: {
        estimatedFiles: 0,
        estimatedLines: 0,
        estimatedTime: 'unknown',
      },
      phase: 'unknown',
      complexity: 'unknown',
      notes: [],
    };
  }

  /**
   * Load context from file
   */
  async load(): Promise<void> {
    try {
      const content = await fs.readFile(this.contextPath, 'utf-8');
      
      // Parse YAML frontmatter or full YAML
      if (content.startsWith('---')) {
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        if (match) {
          this.data = yaml.parse(match[1]);
        }
      } else {
        this.data = yaml.parse(content);
      }
    } catch (error) {
      // File doesn't exist, use default
      this.data = this.createDefaultContext();
    }
  }

  /**
   * Save context to file
   */
  async save(): Promise<void> {
    const tokens = this.estimateTokens();
    
    // Warning at 80%
    if (tokens > this.MAX_TOKENS * this.WARNING_THRESHOLD) {
      this.data.notes.push(
        `⚠️ Token warning: ${tokens}/${this.MAX_TOKENS} (${new Date().toISOString()})`
      );
    }
    
    // Archive at 100%
    if (tokens >= this.MAX_TOKENS) {
      await this.archiveAndReset();
    }
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(this.contextPath), { recursive: true });
    
    // Write as YAML
    const content = yaml.stringify(this.data);
    await fs.writeFile(this.contextPath, content, 'utf-8');
  }

  /**
   * Merge a patch into context
   */
  merge(patch: ContextPatch): void {
    // Signals: OR merge for booleans
    if (patch.signals) {
      for (const [key, val] of Object.entries(patch.signals)) {
        if (typeof val === 'boolean') {
          this.data.signals[key] = this.data.signals[key] || val;
        } else {
          this.data.signals[key] = val;
        }
      }
    }

    // Notes: append
    if (patch.notes && Array.isArray(patch.notes)) {
      this.data.notes.push(...patch.notes);
    }

    // Estimates: merge
    if (patch.estimates) {
      Object.assign(this.data.estimates, patch.estimates);
    }

    // Phase
    if (patch.phase) {
      this.data.phase = patch.phase;
    }
  }

  /**
   * Merge multiple patches (for parallel execution results)
   */
  mergePatches(patches: ContextPatch[]): void {
    for (const patch of patches) {
      this.merge(patch);
    }
  }

  /**
   * Create a readonly snapshot for parallel workers
   */
  snapshot(): Readonly<ContextData> {
    return JSON.parse(JSON.stringify(this.data));
  }

  /**
   * Get context data
   */
  getData(): ContextData {
    return this.data;
  }

  /**
   * Set request prompt
   */
  setRequest(prompt: string, taskType?: string): void {
    this.data.request.prompt = prompt;
    if (taskType) {
      this.data.request.taskType = taskType;
    }
  }

  /**
   * Set session ID
   */
  setSessionId(sessionId: string): void {
    this.data.sessionId = sessionId;
  }

  /**
   * Get session ID
   */
  getSessionId(): string | undefined {
    return this.data.sessionId;
  }

  /**
   * Add a note
   */
  addNote(note: string): void {
    this.data.notes.push(note);
  }

  /**
   * Set signal
   */
  setSignal(key: string, value: boolean): void {
    this.data.signals[key] = value;
  }

  /**
   * Get signal
   */
  getSignal(key: string): boolean {
    return this.data.signals[key] || false;
  }

  /**
   * Generate system prompt section from context
   */
  toSystemPromptSection(): string {
    return `
# Current Context
- Task Type: ${this.data.request.taskType}
- Phase: ${this.data.phase}
- Complexity: ${this.data.complexity}

## Signals
${Object.entries(this.data.signals)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join('\n')}

## Notes
${this.data.notes.slice(-5).map(n => `- ${n}`).join('\n')}
`.trim();
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(): number {
    const content = yaml.stringify(this.data);
    // Rough estimate: 1 token ≈ 4 characters (English), 2 characters (Korean)
    return Math.ceil(content.length / 3);
  }

  /**
   * Archive current context and reset
   */
  private async archiveAndReset(): Promise<void> {
    // Ensure archives directory exists
    await fs.mkdir(this.archivesPath, { recursive: true });

    // Save current version to archives
    const archivePath = path.join(
      this.archivesPath,
      `context-v${this.version}.yaml`
    );
    const content = yaml.stringify(this.data);
    await fs.writeFile(archivePath, content, 'utf-8');

    // Increment version
    this.version++;

    // Reset notes but keep other data
    const archivedNotesCount = this.data.notes.length;
    this.data.notes = [
      `📁 Archived ${archivedNotesCount} notes to context-v${this.version - 1}.yaml`,
    ];
  }
}
