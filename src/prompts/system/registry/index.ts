/**
 * 🔄 100% 复用自原系统
 * 来源: 提示词/系统提示词/提示词注册表/
 * 
 * 核心作用：统一导出注册表相关模块
 * 
 * CLI 适配：100% 保留，无需修改
 */

export { PromptBuilder } from './builder';
export { PromptRegistry } from './registry';
