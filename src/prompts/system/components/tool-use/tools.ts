/**
 * 🔄 100% 复用自原系统
 * 来源: 提示词/系统提示词/提示词组件/使用工具/可用工具列表.ts
 * 
 * 核心作用：动态生成可用工具列表（包含详细描述）
 * 
 * CLI 适配：
 * - 使用 PromptBuilder.getToolsPrompts() 生成详细工具描述
 * - 确保 AI 能看到完整的工具参数和使用示例
 */

import type { SystemPromptContext, PromptVariant } from '../../types';
import { PromptBuilder } from '../../registry/builder';
import { ModelFamily } from '../../types';

/**
 * 获取可用工具列表（包含详细描述）
 * 
 * 这个函数会生成完整的工具文档，包括：
 * - 工具描述
 * - 参数列表（必需/可选）
 * - 使用示例
 * 
 * 这样 AI 就能根据详细的工具描述正确选择工具
 */
export async function getToolUseTools(context: SystemPromptContext): Promise<string> {
  // 创建一个简化的 variant 对象用于获取工具
  const variant: PromptVariant = {
    id: 'generic',
    family: ModelFamily.GENERIC,
    version: 1,
    tags: [],
    labels: {},
    config: {},
    baseTemplate: '',
    componentOrder: [],
    componentOverrides: {},
    placeholders: {},
    tools: [], // 空数组表示使用所有已注册的工具
  };

  // 使用 PromptBuilder 生成详细的工具描述
  const toolPrompts = await PromptBuilder.getToolsPrompts(variant, context);
  
  // 组合所有工具描述
  const toolsSection = toolPrompts.join('\n\n');
  
  return `# Tools\n\n${toolsSection}`;
}
