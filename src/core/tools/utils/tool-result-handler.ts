/**
 * 工具结果处理器
 * 适配自 task/工具处理器/工具/工具结果工具类.ts
 * 
 * 核心作用：
 * - 处理工具执行结果
 * - 管理用户反馈和批准流程
 * - 格式化工具结果输出
 * 
 * CLI 适配：
 * - 移除 VSCode 特定功能
 * - 简化为 console 交互
 * - 保留核心逻辑
 */

import Anthropic from '@anthropic-ai/sdk';
import { ToolUse } from '../../assistant-message';
import { TaskConfig, ToolResponse, ClineAsk, ClineAskResponse } from '../types';
import { ToolExecutorCoordinator } from '../coordinator';
import * as formatter from './response-formatter';

// 定义消息内容类型
type MessageContent = Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>;

/**
 * 工具结果处理工具类
 */
export class ToolResultHandler {
  /**
   * 推送工具结果到用户消息内容
   * 
   * @param content - 工具执行结果
   * @param block - 工具使用块
   * @param userMessageContent - 用户消息内容数组
   * @param toolDescription - 工具描述函数
   * @param markToolAsUsed - 标记工具已使用的回调
   * @param coordinator - 可选的工具协调器
   */
  static pushToolResult(
    content: ToolResponse,
    block: ToolUse,
    userMessageContent: MessageContent,
    toolDescription: (block: ToolUse) => string,
    markToolAsUsed: () => void,
    coordinator?: ToolExecutorCoordinator,
  ): void {
    if (typeof content === 'string') {
      const resultText = content || '(tool did not return anything)';

      // 首先尝试从协调器获取描述，否则使用提供的函数
      const description = coordinator
        ? (() => {
            const handler = coordinator.getHandler(block.name);
            return handler ? `[${block.name}]` : toolDescription(block);
          })()
        : toolDescription(block);

      // 使用带标题的传统格式
      userMessageContent.push({
        type: 'text',
        text: `${description} Result:`,
      });
      userMessageContent.push({
        type: 'text',
        text: resultText,
      });
    } else {
      // 如果是数组，直接推送所有元素
      userMessageContent.push(...content);
    }

    // 标记工具已使用
    markToolAsUsed();
  }

  /**
   * 推送额外的工具反馈从用户到消息内容
   * 
   * @param userMessageContent - 用户消息内容数组
   * @param feedback - 用户反馈文本
   */
  static pushAdditionalToolFeedback(
    userMessageContent: MessageContent,
    feedback?: string,
  ): void {
    if (!feedback) {
      return;
    }

    const content = `The user provided the following feedback:\n<feedback>\n${feedback}\n</feedback>`;
    
    userMessageContent.push({
      type: 'text',
      text: content,
    });
  }

  /**
   * 处理工具批准流程并处理任何用户反馈
   * 
   * @param type - 询问类型
   * @param completeMessage - 完整消息
   * @param config - 任务配置
   * @returns 是否批准
   */
  static async askApprovalAndPushFeedback(
    type: ClineAsk,
    completeMessage: string,
    config: TaskConfig,
  ): Promise<boolean> {
    const result = await config.callbacks.ask(type, completeMessage, false);

    // 处理用户反馈
    if (result.text) {
      ToolResultHandler.pushAdditionalToolFeedback(
        config.taskState.userMessageContent,
        result.text,
      );
      
      // 显示用户反馈
      await config.callbacks.say('user_feedback' as any, result.text);
    }

    // 检查是否批准
    if (result.response !== ClineAskResponse.yesButtonClicked) {
      // 用户拒绝或回复消息
      config.taskState.didRejectTool = true;
      return false;
    } else {
      // 用户批准
      return true;
    }
  }

  /**
   * 格式化工具结果为可读字符串
   * 
   * @param toolName - 工具名称
   * @param result - 工具结果
   * @returns 格式化后的字符串
   */
  static formatToolResult(toolName: string, result: ToolResponse): string {
    if (typeof result === 'string') {
      return `[${toolName}] ${result}`;
    } else {
      // 如果是数组，提取文本内容
      const textParts: string[] = [];
      for (const item of result) {
        if (item.type === 'text') {
          textParts.push(item.text);
        }
      }
      return `[${toolName}] ${textParts.join('\n')}`;
    }
  }

  /**
   * 创建工具结果消息
   * 
   * @param toolName - 工具名称
   * @param params - 工具参数
   * @param result - 工具结果
   * @returns 格式化后的消息
   */
  static createToolResultMessage(
    toolName: string,
    params: Record<string, any>,
    result: ToolResponse,
  ): string {
    const paramsStr = JSON.stringify(params, null, 2);
    const resultStr = ToolResultHandler.formatToolResult(toolName, result);
    
    return `Tool: ${toolName}\nParams: ${paramsStr}\nResult: ${resultStr}`;
  }
}
