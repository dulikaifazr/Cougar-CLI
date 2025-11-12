/**
 * 🔧 工具类型定义
 * 来源: 提示词/系统提示词/spec.ts
 * 
 * 核心作用：定义工具规范、参数、上下文要求等核心类型
 * 
 * CLI 适配：
 * - 移除 VSCode 特定类型
 * - 保留所有核心功能
 */

import type { SystemPromptContext } from '../types';

/**
 * 模型家族枚举
 */
export enum ModelFamily {
  GENERIC = 'generic',
  NEXT_GEN = 'next-gen',
  GPT = 'gpt',
  GEMINI = 'gemini',
  XS = 'xs',
}

/**
 * Cline 默认工具枚举
 */
export enum ClineDefaultTool {
  BASH = 'execute_command',
  READ_FILE = 'read_file',
  WRITE_FILE = 'write_to_file',
  REPLACE_IN_FILE = 'replace_in_file',
  SEARCH_FILES = 'search_files',
  LIST_FILES = 'list_files',
  LIST_CODE_DEFINITION_NAMES = 'list_code_definition_names',
  ASK_FOLLOWUP_QUESTION = 'ask_followup_question',
  ATTEMPT_COMPLETION = 'attempt_completion',
  BROWSER_ACTION = 'browser_action',
  USE_MCP_TOOL = 'use_mcp_tool',
  ACCESS_MCP_RESOURCE = 'access_mcp_resource',
  LOAD_MCP_DOCUMENTATION = 'load_mcp_documentation',
  WEB_FETCH = 'web_fetch',
  NEW_TASK = 'new_task',
  PLAN_MODE_RESPOND = 'plan_mode_respond',
  FOCUS_CHAIN = 'focus_chain',
}

/**
 * 上下文要求函数
 * 用于动态判断参数是否需要
 */
export type ContextRequirements = (context: SystemPromptContext) => boolean;

/**
 * 工具参数定义
 */
export interface ClineToolParameter {
  /** 参数名称 */
  name: string;
  
  /** 是否必需 */
  required: boolean;
  
  /** 上下文要求（可选） */
  contextRequirements?: ContextRequirements;
  
  /** 参数说明 */
  instruction: string;
  
  /** 使用示例（可选） */
  usage?: string;
  
  /** 依赖其他工具（可选） */
  dependencies?: string[];
  
  /** 参数描述（可选） */
  description?: string;
}

/**
 * 工具规范
 */
export interface ClineToolSpec {
  /** 模型变体 */
  variant: ModelFamily;
  
  /** 工具 ID */
  id: string;
  
  /** 工具名称 */
  name: string;
  
  /** 工具描述 */
  description: string;
  
  /** 工具参数 */
  parameters: ClineToolParameter[];
  
  /** 上下文要求（可选） */
  contextRequirements?: ContextRequirements;
}

/**
 * 通用的 task_progress 参数
 * 用于跟踪任务进度
 */
export const TASK_PROGRESS_PARAMETER: ClineToolParameter = {
  name: 'task_progress',
  required: false,
  contextRequirements: (context) => context.focusChainSettings?.enabled === true,
  instruction:
    '如果您已完成任务的一部分并需要继续工作，请提供简短的进度更新。包括：1) 已完成的工作，2) 当前步骤，3) 剩余工作。保持简洁。',
  usage: '已完成：创建了 API 路由。当前：添加错误处理。剩余：编写测试。',
};

/**
 * 类型守卫：检查是否为有效的模型家族
 */
export function isValidModelFamily(value: string): value is ModelFamily {
  return Object.values(ModelFamily).includes(value as ModelFamily);
}

/**
 * 类型守卫：检查是否为有效的工具规范
 */
export function isClineToolSpec(obj: any): obj is ClineToolSpec {
  return (
    obj !== null &&
    obj !== undefined &&
    typeof obj === 'object' &&
    typeof obj.variant === 'string' &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.description === 'string' &&
    Array.isArray(obj.parameters)
  );
}