/**
 * 工具执行协调器
 * 适配自 task/工具处理器/工具执行协调器.ts
 * 
 * 核心作用：
 * - 注册、管理和路由所有工具处理器
 * - 提供统一的工具执行接口
 * - 支持工具共享和复用
 * 
 * CLI 适配：
 * - 简化接口
 * - 保留核心协调逻辑
 */

import { ToolUse } from '../assistant-message';
import { TaskConfig, ToolResponse, IToolHandler, IFullyManagedTool } from './types';

/**
 * 共享工具处理器
 * 允许单个工具处理器在多个名称下注册
 */
export class SharedToolHandler implements IFullyManagedTool {
  constructor(
    public readonly name: string,
    private baseHandler: IFullyManagedTool,
  ) {}

  async execute(params: any, config: TaskConfig): Promise<ToolResponse> {
    return this.baseHandler.execute(params, config);
  }
}

/**
 * 工具执行协调器
 * 通过路由到注册的处理器来协调工具执行
 */
export class ToolExecutorCoordinator {
  private handlers = new Map<string, IToolHandler>();

  /**
   * 注册一个工具处理器
   * 
   * @param handler - 工具处理器实例
   */
  register(handler: IToolHandler): void {
    this.handlers.set(handler.name, handler);
  }

  /**
   * 检查是否有一个处理器注册为给定的工具
   * 
   * @param toolName - 工具名称
   * @returns 是否有处理器
   */
  has(toolName: string): boolean {
    return this.handlers.has(toolName);
  }

  /**
   * 获取给定工具名称的处理器
   * 
   * @param toolName - 工具名称
   * @returns 工具处理器或 undefined
   */
  getHandler(toolName: string): IToolHandler | undefined {
    return this.handlers.get(toolName);
  }

  /**
   * 通过注册的处理器执行工具
   * 
   * @param toolName - 工具名称
   * @param params - 工具参数
   * @param config - 任务配置
   * @returns 工具响应
   */
  async execute(
    toolName: string,
    params: any,
    config: TaskConfig,
  ): Promise<ToolResponse> {
    const handler = this.handlers.get(toolName);
    
    if (!handler) {
      throw new Error(`No handler registered for tool: ${toolName}`);
    }

    return await handler.execute(params, config);
  }

  /**
   * 获取所有注册的工具名称
   * 
   * @returns 工具名称数组
   */
  getRegisteredTools(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * 清除所有注册的处理器
   */
  clear(): void {
    this.handlers.clear();
  }
}
