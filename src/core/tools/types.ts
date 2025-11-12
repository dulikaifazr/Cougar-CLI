/**
 * 工具类型定义
 * 适配自 task/工具处理器/类型/任务配置.ts
 * 
 * 核心作用：
 * - 定义传递给所有工具处理器的统一配置对象
 * - 包含执行工具所需的所有资源和服务
 * 
 * CLI 适配：
 * - 移除 VSCode 特定类型
 * - 简化服务接口
 * - 保留核心功能
 */

import type { ApiHandler } from '../../api/handler';
import type { TaskState, ClineAskResponse } from '../task/state';
import type { MessageStateHandler } from '../task/message-handler';
import Anthropic from '@anthropic-ai/sdk';

// 重新导出 ClineAskResponse
export { ClineAskResponse } from '../task/state';

/**
 * 工具响应类型
 */
export type ToolResponse = 
  | string 
  | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>;

/**
 * 模式类型
 */
export type Mode = 'act' | 'plan';

/**
 * Cline 询问类型
 */
export enum ClineAsk {
  tool = 'tool',
  command = 'command',
  completion_result = 'completion_result',
  followup = 'followup',
  mistake_limit_reached = 'mistake_limit_reached',
  resume_task = 'resume_task',
}

/**
 * Cline 说话类型
 */
export enum ClineSay {
  text = 'text',
  tool = 'tool',
  command = 'command',
  command_output = 'command_output',
  completion_result = 'completion_result',
  error = 'error',
  api_req_started = 'api_req_started',
}

/**
 * 任务配置接口
 * 传递给所有工具处理器的统一配置对象
 */
export interface TaskConfig {
  // 核心标识符
  taskId: string;
  ulid: string;
  cwd: string;
  mode: Mode;
  
  // 状态管理
  taskState: TaskState;
  messageState: MessageStateHandler;
  
  // API 和服务
  api: ApiHandler;
  services: TaskServices;
  
  // 设置
  autoApprovalSettings?: AutoApprovalSettings;
  
  // 回调函数
  callbacks: TaskCallbacks;
  
  // TaskExecutor 引用（用于访问 FileContextTracker）
  taskExecutor?: any;
}

/**
 * 任务服务接口
 */
export interface TaskServices {
  // CLI 版本简化，根据需要添加
  [key: string]: any;
}

/**
 * 自动批准设置
 */
export interface AutoApprovalSettings {
  enabled: boolean;
  [key: string]: any;
}

/**
 * 任务回调函数接口
 */
export interface TaskCallbacks {
  // 说话回调
  say: (
    type: ClineSay,
    text?: string,
    images?: string[],
    files?: string[],
    partial?: boolean
  ) => Promise<number | undefined>;
  
  // 询问回调
  ask: (
    type: ClineAsk,
    text?: string,
    partial?: boolean
  ) => Promise<{
    response: ClineAskResponse;
    text?: string;
    images?: string[];
    files?: string[];
  }>;
  
  // 工具执行
  executeCommandTool?: (command: string, timeoutSeconds?: number) => Promise<[boolean, any]>;
  
  // 自动批准
  shouldAutoApproveTool?: (toolName: string) => boolean;
  shouldAutoApproveToolWithPath?: (toolName: string, path?: string) => Promise<boolean>;
}

/**
 * 工具处理器接口
 */
export interface IToolHandler {
  name: string;
  execute(params: any, config: TaskConfig): Promise<ToolResponse>;
}

/**
 * 完全管理的工具接口
 */
export interface IFullyManagedTool extends IToolHandler {
  // 完全管理的工具需要实现完整的生命周期
}

/**
 * 验证 TaskConfig 是否完整
 */
export function validateTaskConfig(config: any): asserts config is TaskConfig {
  if (!config) {
    throw new Error('TaskConfig is null or undefined');
  }
  
  const requiredKeys: (keyof TaskConfig)[] = [
    'taskId',
    'ulid',
    'cwd',
    'mode',
    'taskState',
    'messageState',
    'api',
    'services',
    'callbacks',
  ];
  
  for (const key of requiredKeys) {
    if (!(key in config)) {
      throw new Error(`Missing ${key} in TaskConfig`);
    }
  }
}
