/**
 * 🔄 100% 复用自原系统
 * 来源: 提示词/系统提示词/提示词组件/用户自定义指令集成.ts
 * 
 * 核心作用：集成用户自定义指令
 * 
 * 已修复：与官方源码100%一致
 */

import type { SystemPromptContext } from '../types';

/**
 * 获取用户自定义指令
 */
export function getUserInstructions(context: SystemPromptContext): string {
  const hasInstructions = context.customInstructions && context.customInstructions.trim().length > 0;
  
  if (!hasInstructions) {
    return '';
  }
  
  return `USER'S CUSTOM INSTRUCTIONS

The following additional instructions are provided by the user, and should be followed to the best of your ability without interfering with the TOOL USE guidelines.

<custom_instructions>
${context.customInstructions}
</custom_instructions>`;
}
