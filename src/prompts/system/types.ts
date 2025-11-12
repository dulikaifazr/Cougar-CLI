/**
 * 🔄 80% 复用自原系统
 * 来源: 提示词/系统提示词/类型.ts
 * 
 * 核心作用：定义提示词系统的所有核心类型
 * 
 * 主要改动：
 * - 移除 VSCode API 依赖
 * - 简化 API 配置类型
 * - 适配 CLI 环境
 */

import { SystemPromptSection } from './template/placeholders';

// 重新导出以便其他模块使用
export { SystemPromptSection };

/**
 * 模型家族枚举
 * 用于区分不同的模型类型，以便选择合适的提示词变体
 */
export enum ModelFamily {
  GENERIC = 'generic',           // 通用模型（默认回退）
  NEXT_GEN = 'next-gen',         // 下一代模型（如 Claude 3.5 Sonnet、GPT-4）
  XS = 'xs',                     // 小型模型（如 Claude 3 Haiku）
}

/**
 * 系统提示词上下文
 * 包含构建提示词所需的所有信息
 */
export interface SystemPromptContext {
  // 基本信息
  cwd: string;                              // 当前工作目录
  modelId: string;                          // 模型 ID
  
  // API 配置
  apiConfiguration?: {
    apiKey?: string;
    baseUrl?: string;
    modelId?: string;
  };
  
  // 用户信息
  user?: {
    username?: string;
    homedir?: string;
  };
  
  // 任务目标
  taskObjective?: string;
  
  // 用户自定义指令
  customInstructions?: string;
  
  // Cline 规则
  clineRules?: string;
  
  // 工作流
  workflows?: string;
  
  // 待办事项
  todos?: string;
  
  // MCP 服务器
  mcpServers?: Array<{
    name: string;
    tools?: Array<{ name: string; description?: string }>;
    resources?: Array<{ name: string; description?: string }>;
  }>;
  
  // 模式设置
  mode?: 'act' | 'plan';
  
  // 额外的自定义数据
  [key: string]: any;
}

/**
 * 组件函数类型
 * 接收上下文，返回格式化的提示词内容
 */
export type ComponentFunction = (context: SystemPromptContext) => string | Promise<string>;

/**
 * 组件注册表
 * 将占位符映射到对应的组件函数
 */
export type ComponentRegistry = {
  [key: string]: ComponentFunction | undefined;
} & Partial<Record<SystemPromptSection, ComponentFunction>>;

/**
 * 配置覆盖
 * 允许为特定组件或工具提供自定义配置
 */
export interface ConfigOverride {
  enabled?: boolean;              // 是否启用
  content?: string;               // 自定义内容
  order?: number;                 // 排序优先级
  [key: string]: any;            // 其他自定义配置
}

/**
 * 提示词变体配置
 * 定义一个完整的提示词变体
 */
export interface PromptVariant {
  readonly id: string;                                              // 唯一标识符
  readonly version: number;                                         // 版本号
  readonly family: ModelFamily;                                     // 模型家族
  readonly description?: string;                                    // 描述
  readonly tags: readonly string[];                                 // 标签
  readonly labels: Readonly<Record<string, number>>;               // 标签权重
  readonly config: PromptConfig;                                    // 配置
  readonly baseTemplate: string;                                    // 基础模板
  readonly componentOrder: readonly SystemPromptSection[];          // 组件顺序
  readonly componentOverrides: Readonly<Partial<Record<SystemPromptSection, ConfigOverride>>>; // 组件覆盖
  readonly placeholders: Readonly<Record<string, string>>;         // 占位符值
  readonly tools?: readonly string[];                               // 工具列表
  readonly toolOverrides?: Readonly<Partial<Record<string, ConfigOverride>>>; // 工具覆盖
}

/**
 * 可变的提示词变体（用于构建过程）
 */
export interface MutablePromptVariant {
  id?: string;
  version: number;
  tags: string[];
  labels: Record<string, number>;
  family: ModelFamily;
  description?: string;
  config: PromptConfig;
  baseTemplate?: string;
  componentOrder: SystemPromptSection[];
  componentOverrides: Partial<Record<SystemPromptSection, ConfigOverride>>;
  placeholders: Record<string, string>;
  tools?: string[];
  toolOverrides?: Partial<Record<string, ConfigOverride>>;
}

/**
 * 提示词配置
 */
export interface PromptConfig {
  readonly modelName?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly [key: string]: unknown;      // 额外的任意配置
}

/**
 * 验证结果
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 类型守卫：检查是否为有效的模型家族
 */
export function isValidModelFamily(value: string): value is ModelFamily {
  return Object.values(ModelFamily).includes(value as ModelFamily);
}

/**
 * 类型守卫：检查是否为有效的提示词变体
 */
export function isPromptVariant(obj: any): obj is PromptVariant {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.version === 'number' &&
    isValidModelFamily(obj.family) &&
    typeof obj.baseTemplate === 'string' &&
    Array.isArray(obj.componentOrder)
  );
}

/**
 * 类型守卫：检查是否为有效的上下文
 */
export function isSystemPromptContext(obj: any): obj is SystemPromptContext {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.cwd === 'string' &&
    typeof obj.modelId === 'string'
  );
}
