/**
 * 对话压缩处理器
 * 适配自 task/工具处理器/17种工具处理器/对话压缩处理器.ts
 * 
 * 功能：
 * - 压缩对话历史以节省 token 使用
 * - 创建对话摘要并替换旧内容
 * - 用户可以提供反馈或接受压缩
 * - 比 summarize 更温和的压缩方式
 * 
 * CLI 适配：
 * - 简化为命令行交互
 * - 移除 VSCode 特定功能
 * - 保留核心压缩逻辑
 */

import { ToolUse } from '../../assistant-message';
import { TaskConfig, ToolResponse, IToolHandler } from '../types';
import { ToolValidator } from '../validator';
import * as formatter from '../utils/response-formatter';

/**
 * 对话压缩处理器类
 */
export class CompressConversationHandler implements IToolHandler {
  readonly name = 'compress_conversation';
  
  constructor(private validator: ToolValidator) {}

  /**
   * 执行对话压缩工具
   * 
   * 工作流程：
   * 1. 验证必需参数（压缩摘要）
   * 2. 向用户展示压缩摘要
   * 3. 等待用户响应
   * 4. 如果用户提供反馈，返回给 AI
   * 5. 如果用户接受，执行对话历史截断
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

    try {
      // 2. 向用户展示压缩摘要
      await config.callbacks.say(
        'text' as any,
        `🗃️ 对话压缩摘要：\n\n${context}`,
      );

      // 3. 等待用户响应
      const result = await config.callbacks.ask(
        'followup' as any,
        '是否接受此压缩摘要？（输入反馈修改，或直接接受）',
      );

      // 4. 处理用户响应
      if (result.text) {
        // 用户提供了反馈
        await config.callbacks.say(
          'text' as any,
          `用户反馈: ${result.text}`,
        );
        
        return `The user provided feedback on the condensed conversation summary:\n<feedback>\n${result.text}\n</feedback>`;
      } else if (result.response === 'yesButtonClicked' as any) {
        // 5. 用户接受，执行对话历史截断
        // CLI 版本：标记需要压缩，实际截断由消息处理器完成
        config.taskState.shouldCompressHistory = true;
        
        await config.callbacks.say(
          'text' as any,
          '✅ 对话历史已压缩，继续任务...',
        );

        return `The conversation history has been condensed. The summary has been preserved and older messages have been removed to save context space.`;
      } else {
        // 用户拒绝
        return `The user declined to condense the conversation.`;
      }
    } catch (error: any) {
      return formatter.toolError(`Error compressing conversation: ${error.message}`);
    }
  }
}
