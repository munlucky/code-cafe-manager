import { Node, StageProfile } from '../types';

/**
 * Node execution context
 */
export interface NodeContext {
  nodeId: string;
  variables: Record<string, any>;
  results: Map<string, any>;
}

/**
 * Node execution result
 */
export interface NodeExecutionResult {
  nodeId: string;
  success: boolean;
  output: any;
  error?: string;
}

export interface DAGExecutorOptions {
  runNode?: (node: Node, context: NodeContext) => Promise<any>;
  exportValidator?: (
    data: any,
    schemaPath: string,
    node: Node,
    context: NodeContext
  ) => Promise<void>;
  onNodeStart?: (node: Node, context: NodeContext) => void;
  onNodeEnd?: (node: Node, output: any, context: NodeContext) => void;
  onNodeError?: (node: Node, error: string, context: NodeContext) => void;
}

/**
 * DAG Executor - Execute stage graphs with dependency resolution
 */
export class DAGExecutor {
  private profile: StageProfile;
  private context: NodeContext;
  private executedNodes: Set<string>;
  private executionOrder: string[];
  private options: DAGExecutorOptions;

  constructor(
    profile: StageProfile,
    initialContext: Record<string, any> = {},
    options: DAGExecutorOptions = {}
  ) {
    this.profile = profile;
    this.context = {
      nodeId: '',
      variables: initialContext,
      results: new Map(),
    };
    this.executedNodes = new Set();
    this.executionOrder = [];
    this.options = options;
  }

  /**
   * Execute the entire DAG
   */
  async execute(): Promise<{
    success: boolean;
    results: Map<string, any>;
    executionOrder: string[];
    error?: string;
  }> {
    try {
      // Build dependency graph
      const dependencyGraph = this.buildDependencyGraph();

      // Determine execution order (topological sort)
      const order = this.topologicalSort(dependencyGraph);

      if (!order) {
        return {
          success: false,
          results: this.context.results,
          executionOrder: this.executionOrder,
          error: 'Circular dependency detected in graph',
        };
      }

      // Execute nodes in order
      for (const nodeId of order) {
        const node = this.findNode(nodeId);
        if (!node) {
          return {
            success: false,
            results: this.context.results,
            executionOrder: this.executionOrder,
            error: `Node not found: ${nodeId}`,
          };
        }

        this.options.onNodeStart?.(node, this.context);
        const result = await this.executeNode(node);

        if (!result.success) {
          this.options.onNodeError?.(node, result.error || 'Unknown error', this.context);
          return {
            success: false,
            results: this.context.results,
            executionOrder: this.executionOrder,
            error: `Node ${nodeId} failed: ${result.error}`,
          };
        }

        this.options.onNodeEnd?.(node, result.output, this.context);

        // Store result
        this.context.results.set(nodeId, result.output);
        this.executedNodes.add(nodeId);
        this.executionOrder.push(nodeId);
      }

      return {
        success: true,
        results: this.context.results,
        executionOrder: this.executionOrder,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          success: false,
          results: this.context.results,
          executionOrder: this.executionOrder,
          error: error.message,
        };
      }
      return {
        success: false,
        results: this.context.results,
        executionOrder: this.executionOrder,
        error: 'Unknown error',
      };
    }
  }

  /**
   * Execute a single node
   */
  private async executeNode(node: Node): Promise<NodeExecutionResult> {
    this.context.nodeId = node.id;

    try {
      let output: any;

      switch (node.type) {
        case 'run':
          output = await this.executeRunNode(node);
          break;

        case 'foreach':
          output = await this.executeForeachNode(node);
          break;

        case 'reduce':
          output = await this.executeReduceNode(node);
          break;

        case 'branch':
          output = await this.executeBranchNode(node);
          break;

        case 'export':
          output = await this.executeExportNode(node);
          break;

        default:
          throw new Error(`Unknown node type: ${(node as any).type}`);
      }

      return {
        nodeId: node.id,
        success: true,
        output,
      };
    } catch (error) {
      if (error instanceof Error) {
        return {
          nodeId: node.id,
          success: false,
          output: null,
          error: error.message,
        };
      }
      return {
        nodeId: node.id,
        success: false,
        output: null,
        error: 'Unknown error',
      };
    }
  }

  /**
   * Execute run node (provider + role execution)
   */
  private async executeRunNode(node: Node): Promise<any> {
    if (this.options.runNode) {
      return this.options.runNode(node, this.context);
    }

    // Placeholder for now - will be implemented with provider integration
    console.log(`[DAG] Executing run node: ${node.id}`);
    console.log(`  Provider: ${node.provider}`);
    console.log(`  Role: ${node.role}`);

    return {
      type: 'run',
      nodeId: node.id,
      provider: node.provider,
      role: node.role,
      // Actual execution will be added later
      result: 'mock_result',
    };
  }

  /**
   * Execute foreach node (dynamic N executions)
   */
  private async executeForeachNode(node: Node): Promise<any> {
    if (!node.items) {
      throw new Error(`foreach node ${node.id} missing items`);
    }

    // Resolve items from variables
    const items = this.resolveVariable(node.items);

    if (!Array.isArray(items)) {
      throw new Error(`foreach items must be an array: ${node.items}`);
    }

    console.log(`[DAG] Executing foreach node: ${node.id}`);
    console.log(`  Items count: ${items.length}`);
    console.log(`  Mode: ${node.mode || 'sequential'}`);

    const results: any[] = [];

    if (node.mode === 'parallel') {
      // Execute in parallel
      const promises = items.map(async (item, index) => {
        console.log(`  [${index}] Executing with item:`, item);
        // Create a mock result for now
        return {
          index,
          item,
          result: `result_${index}`,
        };
      });

      const parallelResults = await Promise.all(promises);
      results.push(...parallelResults);
    } else {
      // Execute sequentially
      for (let i = 0; i < items.length; i++) {
        console.log(`  [${i}] Executing with item:`, items[i]);
        results.push({
          index: i,
          item: items[i],
          result: `result_${i}`,
        });
      }
    }

    // Store results in output variable if specified
    if (node.out) {
      this.context.variables[node.out] = results;
    }

    return results;
  }

  /**
   * Execute reduce node (combine multiple results)
   */
  private async executeReduceNode(node: Node): Promise<any> {
    if (!node.from) {
      throw new Error(`reduce node ${node.id} missing from`);
    }

    console.log(`[DAG] Executing reduce node: ${node.id}`);
    console.log(`  From: ${node.from}`);
    console.log(`  Strategy: ${node.strategy || 'summarize'}`);

    // Get results from source node
    const sourceResults = this.context.results.get(node.from);

    if (!sourceResults) {
      throw new Error(`reduce node ${node.id} source not found: ${node.from}`);
    }

    // Apply reduce strategy
    let reduced: any;

    switch (node.strategy) {
      case 'summarize':
      default:
        // Simple summarization for now
        reduced = {
          type: 'reduced',
          source: node.from,
          count: Array.isArray(sourceResults) ? sourceResults.length : 1,
          summary: 'Combined results',
        };
        break;
    }

    return reduced;
  }

  /**
   * Execute branch node (conditional execution)
   */
  private async executeBranchNode(node: Node): Promise<any> {
    console.log(`[DAG] Executing branch node: ${node.id}`);

    if (!node.when || node.when.length === 0) {
      throw new Error(`branch node ${node.id} missing conditions`);
    }

    // Evaluate conditions
    for (const condition of node.when) {
      // Simple condition evaluation (placeholder)
      console.log(`  Evaluating: ${condition.condition}`);
      // In real implementation, use JSONPath or expression evaluator
      const conditionMet = true; // Placeholder

      if (conditionMet) {
        console.log(`  Condition met, next: ${condition.then}`);
        return {
          type: 'branch',
          taken: condition.then,
        };
      }
    }

    return {
      type: 'branch',
      taken: null,
    };
  }

  /**
   * Execute export node (export stage result)
   */
  private async executeExportNode(node: Node): Promise<any> {
    if (!node.from) {
      throw new Error(`export node ${node.id} missing from`);
    }

    console.log(`[DAG] Executing export node: ${node.id}`);
    console.log(`  From: ${node.from}`);
    console.log(`  Schema: ${node.output_schema}`);

    // Get result from source node
    const sourceResult = this.context.results.get(node.from);

    if (!sourceResult) {
      throw new Error(`export node ${node.id} source not found: ${node.from}`);
    }

    if (node.output_schema && this.options.exportValidator) {
      await this.options.exportValidator(sourceResult, node.output_schema, node, this.context);
    }

    return {
      type: 'export',
      source: node.from,
      schema: node.output_schema,
      data: sourceResult,
    };
  }

  /**
   * Build dependency graph
   */
  private buildDependencyGraph(): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    for (const node of this.profile.graph) {
      const dependencies: string[] = [];

      // Check inputs
      if (node.inputs && Array.isArray(node.inputs)) {
        for (const input of node.inputs) {
          // If input is a node ID, add as dependency
          const inputNode = this.findNode(input);
          if (inputNode) {
            dependencies.push(input);
          }
        }
      }

      // Check from reference
      if (node.from) {
        dependencies.push(node.from);
      }

      graph.set(node.id, dependencies);
    }

    return graph;
  }

  /**
   * Topological sort for execution order
   */
  private topologicalSort(graph: Map<string, string[]>): string[] | null {
    const visited = new Set<string>();
    const tempMark = new Set<string>();
    const order: string[] = [];

    const visit = (nodeId: string): boolean => {
      if (tempMark.has(nodeId)) {
        // Circular dependency
        return false;
      }

      if (visited.has(nodeId)) {
        return true;
      }

      tempMark.add(nodeId);

      const dependencies = graph.get(nodeId) || [];
      for (const dep of dependencies) {
        if (!visit(dep)) {
          return false;
        }
      }

      tempMark.delete(nodeId);
      visited.add(nodeId);
      order.push(nodeId);

      return true;
    };

    // Visit all nodes
    for (const nodeId of graph.keys()) {
      if (!visited.has(nodeId)) {
        if (!visit(nodeId)) {
          return null; // Circular dependency
        }
      }
    }

    return order;
  }

  /**
   * Find node by ID
   */
  private findNode(nodeId: string): Node | null {
    return this.profile.graph.find((n) => n.id === nodeId) || null;
  }

  /**
   * Resolve variable reference
   */
  private resolveVariable(ref: any): any {
    // Simple variable resolution
    // Format: ${vars.varName} or ${nodes.nodeId.result}

    if (typeof ref !== 'string') {
      return ref;
    }

    if (ref.startsWith('${') && ref.endsWith('}')) {
      const path = ref.slice(2, -1);

      if (path.startsWith('vars.')) {
        const varName = path.slice(5);
        return this.context.variables[varName];
      }

      if (path.startsWith('nodes.')) {
        const parts = path.slice(6).split('.');
        const nodeId = parts[0];
        return this.context.results.get(nodeId);
      }
    }

    // Return as-is if not a variable reference
    return ref;
  }

  /**
   * Get execution context
   */
  getContext(): NodeContext {
    return this.context;
  }

  /**
   * Get executed nodes
   */
  getExecutedNodes(): string[] {
    return Array.from(this.executedNodes);
  }
}
