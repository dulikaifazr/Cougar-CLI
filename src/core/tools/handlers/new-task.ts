/**
 * 新任务处理器
 * 适配自 task/工具处理器/17种工具处理器/新任务处理器.ts
 * 
 * 功能：
 * - AI 建议创建一个新的独立任务
 * - 用户可以接受或拒绝
 * - 支持用户反馈
 * 
 * CLI 适配：
 * - 简化为命令行交互
 * - 移除 VSCode 特定功能
 */

import { ToolUse } from '../../assistant-message';
import { TaskConfig, ToolResponse, IToolHandler } from '../types';
import { ToolValidator } from '../validator';
import * as formatter from '../utils/response-formatter';

/**
 * 新任务处理器类
 */
export class NewTaskHandler implements IToolHandler {
  readonly name = 'new_task';
  
  constructor(private validator: ToolValidator) {}

  /**
   * 执行新任务工具
   * 
   * 工作流程：
   * 1. 验证必需参数（任务上下文描述）
   * 2. 向用户显示新任务建议
   * 3. 如果用户提供反馈，将反馈返回给 AI（继续当前任务）
   * 4. 如果用户接受，创建新任务（开始新对话）
   */
  async execute(params: any, config: TaskConfig): Promise<ToolResponse> {
    const context: string | undefined = params.context;

    // 1. 验证必需参数
    const block: ToolUse = {
      type: 'tool_use',
      name: this.name as any,
      params: { context },
      partial: false,
    };

    const contextValidation = this.validator.assertRequiredParams(block, 'context');
    if (!contextValidation.ok) {
      config.taskState.consecutiveMistakeCount++;
      return formatter.missingParameter(this.name, 'context');
    }

    // 参数验证通过，重置错误计数器
    config.taskState.consecutiveMistakeCount = 0;

    // 2. 向用户显示新任务建议
    await config.callbacks.say(
      'text' as any,
      `AI 建议创建新任务:\n\n${context}`,
    );

    // 3. 等待用户响应
    const result = await config.callbacks.ask(
      'followup' as any,
      '是否创建新任务？（输入反馈继续当前任务，或直接接受）',
    );

    // 4. 处理用户响应
    if (result.text) {
      // 用户提供了反馈，继续当前任务
      await config.callbacks.say(
        'text' as any,
        `用户反馈: ${result.text}`,
      );
      
      return `The user provided feedback instead of creating a new task:\n<feedback>\n${result.text}\n</feedback>`;
    } else if (result.response === 'yesButtonClicked' as any) {
      // 用户接受创建新任务
      return `The user has accepted to create a new task with the provided context.`;
    } else {
      // 用户拒绝
      return `The user declined to create a new task.`;
    }
  }
}
