/**
 * 🔄 95% 复用自原系统
 * 来源: 提示词/系统提示词/不同模型的提示词变体/通用的/配置.ts
 * 
 * 核心作用：使用构建器模式创建通用变体的配置
 * 
 * CLI 适配：
 * - 移除 VSCode 相关的工具（BROWSER）
 * - 保留 CLI 环境需要的核心工具
 */

import { ModelFamily } from '../../types';
import { SystemPromptSection } from '../../template/placeholders';
import { createVariant } from '../variant-builder';
import { validateVariant } from '../variant-validator';
import { baseTemplate } from './template';

export const config = createVariant(ModelFamily.GENERIC)
  .description('通用用例和模型的后备提示词，适用于大多数 AI 模型和任务场景。')
  .version(1)
  .tags('fallback', 'stable')
  .labels({
    stable: 1,
    fallback: 1,
  })
  .template(baseTemplate)
  .components(
    SystemPromptSection.AGENT_ROLE,
    SystemPromptSection.TOOL_USE,
    SystemPromptSection.TASK_PROGRESS,
    SystemPromptSection.MCP,
    SystemPromptSection.EDITING_FILES,
    SystemPromptSection.ACT_VS_PLAN,
    SystemPromptSection.TODO,
    SystemPromptSection.CAPABILITIES,
    SystemPromptSection.RULES,
    SystemPromptSection.SYSTEM_INFO,
    SystemPromptSection.OBJECTIVE,
    SystemPromptSection.USER_INSTRUCTIONS,
  )
  .tools(
    'execute_command',
    'read_file',
    'write_to_file',
    'replace_in_file',
    'search_files',
    'list_files',
    'list_code_definition_names',
    'web_fetch',
    'use_mcp_tool',
    'access_mcp_resource',
    'ask_followup_question',
    'attempt_completion',
    'new_task',
    'plan_mode_respond',
    'load_mcp_documentation',
    'focus_chain',
  )
  .placeholders({
    MODEL_FAMILY: 'generic',
  })
  .config({})
  .build();

// 编译时验证
const validationResult = validateVariant({ ...config, id: 'generic' }, { strict: true });
if (!validationResult.isValid) {
  console.error('通用变体配置验证失败:', validationResult.errors);
  throw new Error(`无效的通用变体配置: ${validationResult.errors.join(', ')}`);
}

if (validationResult.warnings.length > 0) {
  console.warn('通用变体配置警告:', validationResult.warnings);
}

// 导出类型信息以获得更好的 IDE 支持
export type GenericVariantConfig = typeof config;
