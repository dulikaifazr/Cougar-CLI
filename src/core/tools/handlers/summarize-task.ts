/**
 * 总结任务处理器
 * 适配自 task/工具处理器/17种工具处理器/总结任务处理器.ts
 * 
 * 功能：
 * - 当对话上下文变得非常长时，创建任务摘要
 * - 清除旧的对话历史，只保留摘要
 * - 在接近 token 限制时使用
 * - 保留任务的关键进度和结果
 * 
 * CLI 适配：
 * - 简化上下文管理
 * - 移除 VSCode 特定功能
 * - 保留核心总结逻辑
 */

import { ToolUse } from '../../assistant-message';
import { TaskConfig, ToolResponse, IToolHandler } from '../types';
import { ToolValidator } from '../validator';
import * as formatter from '../utils/response-formatter';

/**
 * 总结任务处理器类
 */
export class SummarizeTaskHandler implements IToolHandler {
  readonly name = 'summarize_task';
  
  constructor(private validator: ToolValidator) {}

  /**
   * 执行总结任务工具
   * 
   * 工作流程：
   * 1. 验证必需参数（摘要内容）
   * 2. 在 UI 中显示摘要
   * 3. 标记对话历史需要清除
   * 4. 设置总结状态标志
   * 5. 返回延续提示，让 AI 继续任务
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
      // 2. 在 UI 中显示摘要
      await config.callbacks.say(
        'text' as any,
        `📝 任务摘要：\n\n${context}`,
      );

      // 3. 标记对话历史需要清除
      // CLI 版本：简化为标记状态，实际清除由消息处理器完成
      config.taskState.shouldClearHistory = true;

      // 4. 设置总结状态标志
      config.taskState.currentlySummarizing = true;

      // 5. 返回延续提示
      const continuationPrompt = `Task has been summarized. Here's what we've accomplished so far:\n\n${context}\n\nYou may now continue working on the task based on this summary.`;
      
      return continuationPrompt;
    } catch (error: any) {
      return formatter.toolError(`Error summarizing task: ${error.message}`);
    }
  }
}
