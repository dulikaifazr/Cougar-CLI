/**
 * 🔄 100% 复用自原系统
 * 来源: 提示词/系统提示词/提示词组件/使用工具/工具使用章节整合.ts
 * 
 * 核心作用：主入口文件，整合工具使用的所有子部分
 */

import type { SystemPromptContext } from '../../types';
import { getToolUseFormatting } from './formatting';
import { getToolUseTools } from './tools';
import { getToolUseExamples } from './examples';
import { getToolUseGuidelines } from './guidelines';

/**
 * 获取完整的 TOOL USE 章节
 */
export async function getToolUse(context: SystemPromptContext): Promise<string> {
  const formatting = getToolUseFormatting(context);
  const tools = await getToolUseTools(context);
  const examples = getToolUseExamples(context);
  const guidelines = getToolUseGuidelines(context);
  
  return `TOOL USE

You have access to a set of tools that are executed upon the user's approval. You can use one tool per message, and will receive the result of that tool use in the user's response. You use tools step-by-step to accomplish a given task, with each tool use informed by the result of the previous tool use.

${formatting}

${tools}

${examples}

${guidelines}`;
}
