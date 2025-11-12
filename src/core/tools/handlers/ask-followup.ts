/**
 * 询问跟进问题工具处理器
 * 适配自 task/工具处理器/17种工具处理器/询问跟进问题工具处理器.ts
 * 
 * 功能：
 * - AI 向用户询问问题
 * - 获取用户输入
 * - 支持文本和文件输入
 * 
 * CLI 适配：
 * - 简化为命令行交互
 * - 支持文本输入
 */

import { ToolUse } from '../../assistant-message';
import { TaskConfig, ToolResponse, IToolHandler } from '../types';
import { ToolValidator } from '../validator';
import * as formatter from '../utils/response-formatter';

/**
 * 询问跟进问题工具处理器类
 */
export class AskFollowupHandler implements IToolHandler {
  readonly name = 'ask_followup_question';
  
  constructor(private validator: ToolValidator) {}

  /**
   * 执行询问跟进问题工具
   * 
   * 工作流程：
   * 1. 验证必需参数（问题）
   * 2. 向用户显示问题
   * 3. 等待用户回答
   * 4. 返回用户的回答
   */
  async execute(params: any, config: TaskConfig): Promise<ToolResponse> {
    const question: string | undefined = params.question;

    // 1. 验证必需参数
    const block: ToolUse = {
      type: 'tool_use',
      name: this.name as any,
      params: { question },
      partial: false,
    };

    const questionValidation = this.validator.assertRequiredParams(block, 'question');
    if (!questionValidation.ok) {
      config.taskState.consecutiveMistakeCount++;
      return formatter.missingParameter(this.name, 'question');
    }

    // 参数验证通过，重置错误计数器
    config.taskState.consecutiveMistakeCount = 0;

    // 2. 向用户显示问题
    await config.callbacks.say(
      'text' as any,
      `AI 问题: ${question}`,
    );

    // 3. 等待用户回答
    const result = await config.callbacks.ask(
      'followup' as any,
      question!,
    );

    // 4. 返回用户的回答
    if (result.text) {
      return `用户回答: ${result.text}`;
    } else {
      return '用户没有提供回答。';
    }
  }
}
