/**
 * 🔧 ClineToolSet 工具集管理器
 * 来源: 提示词/系统提示词/提示词注册表/Cline工具集.ts
 * 
 * 核心作用：管理和注册所有工具的变体
 * 
 * 功能：
 * - 按模型家族存储工具列表
 * - 提供工具注册和检索接口
 * - 支持回退机制（找不到特定变体时回退到GENERIC）
 * 
 * CLI 适配：
 * - 100% 保留核心功能
 * - 移除 VSCode 依赖
 */

import { ModelFamily, type ClineToolSpec } from './types';

/**
 * ClineToolSet 工具集类
 * 单例模式管理所有工具变体
 */
export class ClineToolSet {
  // 按模型组映射的工具列表
  private static variants: Map<ModelFamily, Set<ClineToolSet>> = new Map();

  private constructor(
    public readonly id: string,
    public readonly config: ClineToolSpec,
  ) {
    this._register();
  }

  /**
   * 注册一个工具配置
   * @param config 工具规范配置
   * @returns ClineToolSet 实例
   */
  public static register(config: ClineToolSpec): ClineToolSet {
    return new ClineToolSet(config.id, config);
  }

  /**
   * 内部注册方法
   * 将工具添加到对应的模型家族集合中
   */
  private _register(): void {
    const existingTools = ClineToolSet.variants.get(this.config.variant) || new Set();
    
    // 避免重复注册同一个工具
    if (!Array.from(existingTools).some((t) => t.config.id === this.config.id)) {
      existingTools.add(this);
      ClineToolSet.variants.set(this.config.variant, existingTools);
    }
  }

  /**
   * 获取指定变体的所有工具
   * @param variant 模型家族
   * @returns 工具数组
   */
  public static getTools(variant: ModelFamily): ClineToolSet[] {
    const toolsSet = ClineToolSet.variants.get(variant) || new Set();
    const defaultSet = ClineToolSet.variants.get(ModelFamily.GENERIC) || new Set();

    return toolsSet.size > 0 ? Array.from(toolsSet) : Array.from(defaultSet);
  }

  /**
   * 获取所有已注册的模型 ID
   * @returns 模型 ID 数组
   */
  public static getRegisteredModelIds(): string[] {
    return Array.from(ClineToolSet.variants.keys());
  }

  /**
   * 根据名称获取工具
   * @param toolName 工具名称
   * @param variant 模型家族
   * @returns 工具实例或 undefined
   */
  public static getToolByName(toolName: string, variant: ModelFamily): ClineToolSet | undefined {
    const tools = ClineToolSet.getTools(variant);
    return tools.find((tool) => tool.config.id === toolName);
  }

  /**
   * 按名称返回工具，回退到 GENERIC，然后是存在该工具的任何其他变体
   * @param toolName 工具名称
   * @param variant 模型家族
   * @returns 工具实例或 undefined
   */
  public static getToolByNameWithFallback(
    toolName: string,
    variant: ModelFamily
  ): ClineToolSet | undefined {
    // 首先尝试精确变体
    const exact = ClineToolSet.getToolByName(toolName, variant);
    if (exact) {
      return exact;
    }

    // 回退到 GENERIC
    const generic = ClineToolSet.getToolByName(toolName, ModelFamily.GENERIC);
    if (generic) {
      return generic;
    }

    // 最终回退：在所有已注册的变体中搜索
    for (const [, tools] of ClineToolSet.variants) {
      const found = Array.from(tools).find((t) => t.config.id === toolName);
      if (found) {
        return found;
      }
    }

    return undefined;
  }

  /**
   * 使用请求的 ID 为变体构建工具列表，缺少时回退到 GENERIC
   * @param variant 模型家族
   * @param requestedIds 请求的工具 ID 列表
   * @returns 工具数组
   */
  public static getToolsForVariantWithFallback(
    variant: ModelFamily,
    requestedIds: string[]
  ): ClineToolSet[] {
    const resolved: ClineToolSet[] = [];
    
    for (const id of requestedIds) {
      const tool = ClineToolSet.getToolByNameWithFallback(id, variant);
      if (tool) {
        // 避免按 ID 重复
        if (!resolved.some((t) => t.config.id === tool.config.id)) {
          resolved.push(tool);
        }
      }
    }
    
    return resolved;
  }

  /**
   * 清空所有已注册的工具（主要用于测试）
   */
  public static clear(): void {
    ClineToolSet.variants.clear();
  }

  /**
   * 获取统计信息
   * @returns 统计对象
   */
  public static getStats(): { totalVariants: number; totalTools: number } {
    let totalTools = 0;
    for (const tools of ClineToolSet.variants.values()) {
      totalTools += tools.size;
    }
    
    return {
      totalVariants: ClineToolSet.variants.size,
      totalTools,
    };
  }
}