/**
 * 🔄 100% 复用自原系统
 * 来源: 提示词/系统提示词/提示词组件/提示词组件统一导出.ts
 * 
 * 核心作用：统一导出所有组件函数
 */

import type { SystemPromptContext, ComponentFunction, ComponentRegistry } from '../types';
import { SystemPromptSection } from '../template/placeholders';
import { getAgentRole } from './agent-role';
import { getCapabilities } from './capabilities';
import { getToolUse } from './tool-use';
import { getEditingFiles } from './editing-files';
import { getObjective } from './objective';
import { getTaskProgress } from './task-progress';
import { getTodo } from './todo';
import { getActVsPlan } from './act-vs-plan';
import { getRules } from './rules';
import { getMcp } from './mcp';
import { getFeedback } from './feedback';
import { getSystemInfo } from './system-info';
import { getUserInstructions } from './user-instructions';

/**
 * 组件注册表
 * 将占位符映射到对应的组件函数
 */
export const COMPONENT_REGISTRY: ComponentRegistry = {
  [SystemPromptSection.AGENT_ROLE]: getAgentRole,
  [SystemPromptSection.CAPABILITIES]: getCapabilities,
  [SystemPromptSection.TOOL_USE]: getToolUse,
  [SystemPromptSection.EDITING_FILES]: getEditingFiles,
  [SystemPromptSection.OBJECTIVE]: getObjective,
  [SystemPromptSection.TASK_PROGRESS]: getTaskProgress,
  [SystemPromptSection.TODO]: getTodo,
  [SystemPromptSection.ACT_VS_PLAN]: getActVsPlan,
  [SystemPromptSection.RULES]: getRules,
  [SystemPromptSection.MCP]: getMcp,
  [SystemPromptSection.FEEDBACK]: getFeedback,
  [SystemPromptSection.SYSTEM_INFO]: getSystemInfo,
  [SystemPromptSection.USER_INSTRUCTIONS]: getUserInstructions,
};

/**
 * 获取指定组件
 */
export async function getComponent(
  section: SystemPromptSection,
  context: SystemPromptContext
): Promise<string> {
  const componentFn = COMPONENT_REGISTRY[section];
  
  if (!componentFn) {
    console.warn(`Component not found for section: ${section}`);
    return '';
  }
  
  try {
    const result = componentFn(context);
    return typeof result === 'string' ? result : await result;
  } catch (error) {
    console.error(`Error generating component ${section}:`, error);
    return '';
  }
}

/**
 * 导出所有组件函数
 */
export {
  getAgentRole,
  getCapabilities,
  getToolUse,
  getEditingFiles,
  getObjective,
  getTaskProgress,
  getTodo,
  getActVsPlan,
  getRules,
  getMcp,
  getFeedback,
  getSystemInfo,
  getUserInstructions,
};
