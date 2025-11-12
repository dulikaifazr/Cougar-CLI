/**
 * 🔄 95% 复用自原系统
 * 来源: 提示词/系统提示词/index.ts
 * 
 * 核心作用：提供简单的 API 获取系统提示词
 * 
 * CLI 适配：
 * - 移除 VSCode 相关的模型家族检测函数
 * - 简化为直接使用 GENERIC 变体
 */

import { PromptRegistry } from './registry/registry';
import type { SystemPromptContext } from './types';

// 导出核心模块
export { ClineToolSet } from './tools/toolset';
export { PromptBuilder } from './registry/builder';
export { PromptRegistry } from './registry/registry';
export * from './template/placeholders';
export { TemplateEngine } from './template/engine';
export * from './types';
export { VariantBuilder, createVariant } from './variants/variant-builder';
export { validateVariant } from './variants/variant-validator';
export { genericConfig, loadAllVariantConfigs } from './variants';

/**
 * 通过上下文获取系统提示词
 */
export async function getSystemPrompt(context: SystemPromptContext): Promise<string> {
  const registry = PromptRegistry.getInstance();
  return await registry.get(context);
}
