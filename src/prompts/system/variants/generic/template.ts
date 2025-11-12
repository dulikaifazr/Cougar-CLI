/**
 * 🔄 100% 复用自原系统
 * 来源: 提示词/系统提示词/不同模型的提示词变体/通用的/模板.ts
 * 
 * 核心作用：定义通用的系统提示词模板结构
 * 
 * CLI 适配：100% 保留，无需修改
 */

import { SystemPromptSection } from '../../template/placeholders';

export const baseTemplate = `{{${SystemPromptSection.AGENT_ROLE}}}

{{${SystemPromptSection.TOOL_USE}}}

====

{{${SystemPromptSection.TODO}}}

====

{{${SystemPromptSection.MCP}}}

====

{{${SystemPromptSection.EDITING_FILES}}}

====

{{${SystemPromptSection.ACT_VS_PLAN}}}

====

{{${SystemPromptSection.TASK_PROGRESS}}}

====

{{${SystemPromptSection.CAPABILITIES}}}

====

{{${SystemPromptSection.FEEDBACK}}}

====

{{${SystemPromptSection.RULES}}}

====

{{${SystemPromptSection.SYSTEM_INFO}}}

====

{{${SystemPromptSection.OBJECTIVE}}}

====

{{${SystemPromptSection.USER_INSTRUCTIONS}}}`;
