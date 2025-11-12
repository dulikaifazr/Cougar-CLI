/**
 * 助手消息类型定义
 * 适配自 消息处理/index.ts
 * 
 * 核心作用：
 * - 定义助手消息的数据结构和类型
 * - 导出消息解析函数
 * 
 * CLI 适配：
 * - 使用本地的 ClineDefaultTool 定义
 * - 保持核心逻辑不变
 */

import { ClineDefaultTool } from '../../prompts/system/tools/types';

// 导出解析函数
export { parseAssistantMessageV2 } from './parse-assistant-message';

/**
 * 助手消息内容类型：可以是文本内容或工具使用
 */
export type AssistantMessageContent = TextContent | ToolUse;

/**
 * 文本内容接口
 */
export interface TextContent {
  type: 'text';
  content: string;
  partial: boolean;
}

/**
 * 工具参数名称列表
 */
export const toolParamNames = [
  'command',
  'requires_approval',
  'path',
  'content',
  'diff',
  'regex',
  'file_pattern',
  'recursive',
  'action',
  'url',
  'coordinate',
  'text',
  'server_name',
  'tool_name',
  'arguments',
  'uri',
  'question',
  'options',
  'response',
  'result',
  'context',
  'title',
  'what_happened',
  'steps_to_reproduce',
  'api_request_output',
  'additional_context',
  'needs_more_exploration',
  'task_progress',
  'timeout',
] as const;

/**
 * 工具参数名称类型
 */
export type ToolParamName = (typeof toolParamNames)[number];

/**
 * 工具使用接口
 */
export interface ToolUse {
  type: 'tool_use';
  name: ClineDefaultTool; // 正在使用的工具的 ID
  // params 是一个部分记录，仅允许使用某些或不使用任何可能的参数
  params: Partial<Record<ToolParamName, string>>;
  partial: boolean; // 指示工具使用块是否完全闭合
}

/**
 * 工具名称列表（从 ClineDefaultTool 提取）
 */
export const toolUseNames = Object.values(ClineDefaultTool) as string[];
