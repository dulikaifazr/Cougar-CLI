/**
 * 🔧 工具注册初始化
 * 来源: 提示词/系统提示词/工具定义（19个工具）/工具注册初始化.ts
 * 
 * 核心作用：注册所有工具变体到 ClineToolSet 提供者
 * 
 * 功能：
 * - 收集所有工具的所有变体（GENERIC、NEXT_GEN、GPT、GEMINI）
 * - 调用 ClineToolSet.register() 批量注册
 * - 在应用启动时调用，使工具在提示词构建时可用
 * 
 * CLI 适配：
 * - 保留所有核心功能
 * - ClineToolSet 将在后续阶段实现
 */

import type { ClineToolSpec } from './types';
import { ClineToolSet } from './toolset';

// 导入所有工具变体（将在创建工具文件后可用）
import { access_mcp_resource_variants } from './access-mcp-resource';
import { ask_followup_question_variants } from './ask-followup-question';
import { attempt_completion_variants } from './attempt-completion';
import { browser_action_variants } from './browser-action';
import { execute_command_variants } from './execute-command';
import { focus_chain_variants } from './focus-chain';
import { list_code_definition_names_variants } from './list-code-definition-names';
import { list_files_variants } from './list-files';
import { load_mcp_documentation_variants } from './load-mcp-documentation';
import { new_task_variants } from './new-task';
import { plan_mode_respond_variants } from './plan-mode-respond';
import { read_file_variants } from './read-file';
import { replace_in_file_variants } from './replace-in-file';
import { search_files_variants } from './search-files';
import { use_mcp_tool_variants } from './use-mcp-tool';
import { web_fetch_variants } from './web-fetch';
import { write_to_file_variants } from './write-to-file';

/**
 * 将所有工具变体注册到 ClineToolSet 提供程序
 * 此函数必须在提示词注册时调用，
 * 以使所有工具集在构建时可用。
 */
export function registerClineToolSets(): void {
  // 收集所有工具的所有变体
  const allToolVariants: ClineToolSpec[] = [
    ...access_mcp_resource_variants,
    ...ask_followup_question_variants,
    ...attempt_completion_variants,
    ...browser_action_variants,
    ...execute_command_variants,
    ...focus_chain_variants,
    ...list_code_definition_names_variants,
    ...list_files_variants,
    ...load_mcp_documentation_variants,
    ...new_task_variants,
    ...plan_mode_respond_variants,
    ...read_file_variants,
    ...replace_in_file_variants,
    ...search_files_variants,
    ...use_mcp_tool_variants,
    ...web_fetch_variants,
    ...write_to_file_variants,
  ];

  // 注册每个变体
  allToolVariants.forEach((variant) => {
    ClineToolSet.register(variant);
  });
  
  console.log(`✅ 已注册 ${allToolVariants.length} 个工具变体`);
}

/**
 * 获取所有已注册的工具 ID
 */
export function getRegisteredToolIds(): string[] {
  return ClineToolSet.getRegisteredModelIds();
}

/**
 * 检查工具是否已注册
 */
export function isToolRegistered(toolId: string): boolean {
  const registeredIds = getRegisteredToolIds();
  return registeredIds.includes(toolId);
}