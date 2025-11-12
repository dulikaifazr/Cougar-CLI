/**
 * 🔄 100% 复用自原系统
 * 来源: 提示词/系统提示词/不同模型的提示词变体/index.ts
 * 
 * 核心作用：注册和管理所有提示词变体，提供动态加载
 * 
 * CLI 适配：100% 保留，无需修改
 */

import { ModelFamily } from '../types';
import { config as genericConfig } from './generic/config';

export { config as genericConfig, type GenericVariantConfig } from './generic/config';

/**
 * 用于动态加载的变体注册表
 *
 * 此注册表允许加载变体配置。
 * 只保留 Generic 变体用于 CLI 环境
 */
export const VARIANT_CONFIGS = {
  /**
   * 通用变体 - 所有模型类型的后备选项
   * 针对广泛的兼容性和稳定性能进行了优化
   */
  [ModelFamily.GENERIC]: genericConfig,
} as const;

/**
 * 类型安全的变体标识符
 * 确保在整个代码库中只能使用有效的变体 ID
 */
export type VariantId = keyof typeof VARIANT_CONFIGS;

/**
 * 获取所有可用变体 ID 的辅助函数
 */
export function getAvailableVariants(): VariantId[] {
  return Object.keys(VARIANT_CONFIGS) as VariantId[];
}

/**
 * 检查变体 ID 是否有效的辅助函数
 */
export function isValidVariantId(id: string): id is VariantId {
  return id in VARIANT_CONFIGS;
}

/**
 * 动态加载变体配置
 * @param variantId - 要加载的变体 ID
 * @returns 变体配置
 */
export function loadVariantConfig(variantId: VariantId) {
  return VARIANT_CONFIGS[variantId];
}

/**
 * 加载所有变体配置
 * @returns 所有变体配置的映射
 */
export function loadAllVariantConfigs() {
  return VARIANT_CONFIGS;
}
