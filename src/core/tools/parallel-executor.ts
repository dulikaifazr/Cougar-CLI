/**
 * 并行工具执行器
 * 新功能：为 CLI 系统添加并行执行能力
 * 
 * 核心功能：
 * - 分析工具依赖关系
 * - 并行执行独立工具
 * - 合并执行结果
 * - 错误隔离
 * 
 * 使用场景：
 * - 同时读取多个文件
 * - 并行执行多个搜索操作
 * - 同时进行多个独立的命令
 * - 提升整体执行效率
 */

import { ToolUse as BaseToolUse } from '../assistant-message';
import { ToolResponse } from './types';

/**
 * 扩展 ToolUse 接口，添加 id 字段
 */
export interface ToolUse extends BaseToolUse {
  id?: string;
}

/**
 * 依赖关系图
 */
export interface DependencyGraph {
  nodes: Map<string, ToolUse>;
  edges: Map<string, Set<string>>; // toolId -> dependencies
  independent: Set<string>; // 独立工具
  groups: string[][]; // 可并行执行的工具组
}

/**
 * 执行结果
 */
export interface ExecutionResult {
  toolId: string;
  toolName: string;
  success: boolean;
  result: ToolResponse;
  duration: number;
  error?: Error;
}

/**
 * 并行执行统计
 */
export interface ParallelExecutionStats {
  totalTools: number;
  parallelGroups: number;
  totalDuration: number;
  averageDuration: number;
  successCount: number;
  failureCount: number;
  speedup: number; // 相比串行执行的加速比
}

/**
 * 并行工具执行器
 */
export class ParallelToolExecutor {
  /**
   * 分析工具依赖关系
   * @param tools 工具数组
   * @returns 依赖关系图
   */
  static analyzeDependencies(tools: ToolUse[]): DependencyGraph {
    const nodes = new Map<string, ToolUse>();
    const edges = new Map<string, Set<string>>();
    const independent = new Set<string>();

    // 构建节点
    for (const tool of tools) {
      const toolId = tool.id || `${tool.name}_${Date.now()}_${Math.random()}`;
      // 添加 id 到 tool 对象
      const toolWithId = { ...tool, id: toolId } as ToolUse;
      nodes.set(toolId, toolWithId);
      edges.set(toolId, new Set());
    }

    // 分析依赖关系
    const toolIds = Array.from(nodes.keys());
    for (let i = 0; i < toolIds.length; i++) {
      const currentId = toolIds[i];
      const currentTool = nodes.get(currentId)!;
      let hasDependency = false;

      for (let j = 0; j < i; j++) {
        const prevId = toolIds[j];
        const prevTool = nodes.get(prevId)!;

        // 检查是否有依赖
        if (this.hasDependency(currentTool, prevTool)) {
          edges.get(currentId)!.add(prevId);
          hasDependency = true;
        }
      }

      // 如果没有依赖，标记为独立工具
      if (!hasDependency) {
        independent.add(currentId);
      }
    }

    // 生成并行执行组
    const groups = this.generateExecutionGroups(nodes, edges);

    return { nodes, edges, independent, groups };
  }

  /**
   * 检查两个工具是否有依赖关系
   * @param tool1 工具1
   * @param tool2 工具2
   * @returns 是否有依赖
   */
  private static hasDependency(tool1: ToolUse, tool2: ToolUse): boolean {
    // 1. 文件操作依赖
    if (this.isFileOperation(tool1) && this.isFileOperation(tool2)) {
      const path1 = this.getFilePath(tool1);
      const path2 = this.getFilePath(tool2);
      
      // 同一文件的操作有依赖
      if (path1 === path2) {
        return true;
      }

      // 写操作后的读操作有依赖
      if (this.isWriteOperation(tool2) && this.isReadOperation(tool1)) {
        return true;
      }
    }

    // 2. 命令执行依赖（保守策略：命令串行执行）
    if ((tool1.name as string) === 'execute_command' && (tool2.name as string) === 'execute_command') {
      return true;
    }

    // 3. 交互工具依赖（ask_followup 不能并行）
    if ((tool1.name as string) === 'ask_followup' || (tool2.name as string) === 'ask_followup') {
      return true;
    }

    return false;
  }

  /**
   * 检查是否是文件操作
   */
  private static isFileOperation(tool: ToolUse): boolean {
    const fileOps = ['read_file', 'write_to_file', 'replace_in_file', 'search_files', 'list_files'];
    return fileOps.includes(tool.name as string);
  }

  /**
   * 检查是否是写操作
   */
  private static isWriteOperation(tool: ToolUse): boolean {
    return ['write_to_file', 'replace_in_file'].includes(tool.name as string);
  }

  /**
   * 检查是否是读操作
   */
  private static isReadOperation(tool: ToolUse): boolean {
    return ['read_file'].includes(tool.name as string);
  }

  /**
   * 获取文件路径
   */
  private static getFilePath(tool: ToolUse): string | null {
    const params = tool.params as any;
    return params.path || params.file_path || null;
  }

  /**
   * 生成执行组（拓扑排序）
   * @param nodes 节点
   * @param edges 边
   * @returns 执行组
   */
  private static generateExecutionGroups(
    nodes: Map<string, ToolUse>,
    edges: Map<string, Set<string>>
  ): string[][] {
    const groups: string[][] = [];
    const visited = new Set<string>();
    const inDegree = new Map<string, number>();

    // 计算入度
    for (const [nodeId] of nodes) {
      inDegree.set(nodeId, 0);
    }
    for (const [nodeId, deps] of edges) {
      inDegree.set(nodeId, deps.size);
    }

    // 分层执行
    while (visited.size < nodes.size) {
      const currentGroup: string[] = [];

      // 找出所有入度为 0 的节点
      for (const [nodeId, degree] of inDegree) {
        if (degree === 0 && !visited.has(nodeId)) {
          currentGroup.push(nodeId);
        }
      }

      if (currentGroup.length === 0) {
        // 存在循环依赖，强制添加一个未访问的节点
        for (const [nodeId] of nodes) {
          if (!visited.has(nodeId)) {
            currentGroup.push(nodeId);
            break;
          }
        }
      }

      // 添加到组
      groups.push(currentGroup);

      // 更新状态
      for (const nodeId of currentGroup) {
        visited.add(nodeId);
        
        // 减少依赖该节点的其他节点的入度
        for (const [otherId, deps] of edges) {
          if (deps.has(nodeId)) {
            inDegree.set(otherId, (inDegree.get(otherId) || 0) - 1);
          }
        }
      }
    }

    return groups;
  }

  /**
   * 并行执行工具
   * @param tools 工具数组
   * @param executor 工具执行函数
   * @returns 执行结果数组
   */
  static async executeInParallel(
    tools: ToolUse[],
    executor: (tool: ToolUse) => Promise<ToolResponse>
  ): Promise<ExecutionResult[]> {
    const startTime = Date.now();
    const results: ExecutionResult[] = [];

    // 分析依赖
    const graph = this.analyzeDependencies(tools);

    console.log(`\n🚀 并行执行: ${tools.length} 个工具，${graph.groups.length} 个执行组`);

    // 按组执行
    for (let i = 0; i < graph.groups.length; i++) {
      const group = graph.groups[i];
      console.log(`   组 ${i + 1}: ${group.length} 个工具`);

      // 并行执行该组的所有工具
      const groupResults = await Promise.allSettled(
        group.map(async (toolId) => {
          const tool = graph.nodes.get(toolId)!;
          const toolStartTime = Date.now();

          try {
            const result = await executor(tool as any);
            const duration = Date.now() - toolStartTime;

            return {
              toolId,
              toolName: tool.name,
              success: true,
              result,
              duration,
            } as ExecutionResult;
          } catch (error: any) {
            const duration = Date.now() - toolStartTime;

            return {
              toolId,
              toolName: tool.name,
              success: false,
              result: `Error: ${error.message}`,
              duration,
              error,
            } as ExecutionResult;
          }
        })
      );

      // 收集结果
      for (const result of groupResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error(`   ❌ 工具执行失败:`, result.reason);
        }
      }
    }

    const totalDuration = Date.now() - startTime;
    console.log(`   ✓ 并行执行完成，耗时: ${totalDuration}ms`);

    return results;
  }

  /**
   * 检查两个工具是否可以并行执行
   * @param tool1 工具1
   * @param tool2 工具2
   * @returns 是否可以并行
   */
  static canExecuteInParallel(tool1: ToolUse, tool2: ToolUse): boolean {
    return !this.hasDependency(tool1, tool2) && !this.hasDependency(tool2, tool1);
  }

  /**
   * 合并执行结果
   * @param results 执行结果数组
   * @returns 合并后的结果
   */
  static mergeResults(results: ExecutionResult[]): ToolResponse {
    const successResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);

    if (failedResults.length > 0) {
      const errors = failedResults.map(r => `${r.toolName}: ${r.error?.message || 'Unknown error'}`);
      return `Parallel execution completed with ${failedResults.length} error(s):\n${errors.join('\n')}`;
    }

    const outputs = successResults.map(r => `[${r.toolName}] ${r.result}`);
    return outputs.join('\n\n');
  }

  /**
   * 生成执行统计
   * @param results 执行结果
   * @param graph 依赖图
   * @returns 统计信息
   */
  static generateStats(results: ExecutionResult[], graph: DependencyGraph): ParallelExecutionStats {
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    // 计算串行执行时间（估算）
    const serialDuration = results.reduce((sum, r) => sum + r.duration, 0);
    
    // 计算并行执行时间（每组取最长时间）
    let parallelDuration = 0;
    for (const group of graph.groups) {
      const groupDurations = group.map(toolId => {
        const result = results.find(r => r.toolId === toolId);
        return result?.duration || 0;
      });
      parallelDuration += Math.max(...groupDurations);
    }

    const speedup = serialDuration > 0 ? serialDuration / parallelDuration : 1;

    return {
      totalTools: results.length,
      parallelGroups: graph.groups.length,
      totalDuration: parallelDuration,
      averageDuration: results.length > 0 ? totalDuration / results.length : 0,
      successCount,
      failureCount,
      speedup,
    };
  }

  /**
   * 打印执行统计
   * @param stats 统计信息
   */
  static printStats(stats: ParallelExecutionStats): void {
    console.log('\n📊 并行执行统计');
    console.log('='.repeat(50));
    console.log(`总工具数: ${stats.totalTools}`);
    console.log(`执行组数: ${stats.parallelGroups}`);
    console.log(`总耗时: ${stats.totalDuration.toFixed(2)}ms`);
    console.log(`平均耗时: ${stats.averageDuration.toFixed(2)}ms`);
    console.log(`成功: ${stats.successCount}`);
    console.log(`失败: ${stats.failureCount}`);
    console.log(`加速比: ${stats.speedup.toFixed(2)}x`);
    console.log('='.repeat(50));
  }
}

/**
 * 导出便捷函数
 */
export const executeToolsInParallel = ParallelToolExecutor.executeInParallel;
export const canExecuteInParallel = ParallelToolExecutor.canExecuteInParallel;
export const analyzeDependencies = ParallelToolExecutor.analyzeDependencies;
