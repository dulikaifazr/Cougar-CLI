/**
 * 计划模式响应处理器
 * 适配自 task/工具处理器/17种工具处理器/计划模式响应处理器.ts
 * 
 * 功能：
 * - 在计划模式中使用，AI 先制定执行计划
 * - 向用户展示执行计划
 * - 提供可选的操作选项
 * - 根据用户反馈调整计划
 * 
 * CLI 适配：
 * - 简化为命令行交互
 * - 移除 VSCode 特定功能
 * - 保留核心计划模式逻辑
 */

import { ToolUse } from '../../assistant-message';
import { TaskConfig, ToolResponse, IToolHandler } from '../types';
import { ToolValidator } from '../validator';
import * as formatter from '../utils/response-formatter';

/**
 * 计划模式响应处理器类
 */
export class PlanModeRespondHandler implements IToolHandler {
  readonly name = 'plan_mode_respond';
  
  constructor(private validator: ToolValidator) {}

  /**
   * 执行计划模式响应工具
   * 
   * 工作流程：
   * 1. 验证必需参数（响应内容）
   * 2. 处理 needs_more_exploration 标志
   * 3. 向用户展示计划
   * 4. 等待用户响应
   * 5. 处理用户选择或反馈
   * 6. 返回结果
   */
  async execute(params: any, config: TaskConfig): Promise<ToolResponse> {
    const response: string | undefined = params.response;
    const optionsRaw: string | undefined = params.options;
    const needsMoreExploration: boolean = params.needs_more_exploration === 'true';

    // 1. 验证必需参数
    const block: ToolUse = {
      type: 'tool_use',
      name: this.name as any,
      params: { response },
      partial: false,
    };

    const responseValidation = this.validator.assertRequiredParams(block, 'response');
    if (!responseValidation.ok) {
      config.taskState.consecutiveMistakeCount++;
      return formatter.missingParameter(this.name, 'response');
    }

    // 参数验证通过，重置错误计数器
    config.taskState.consecutiveMistakeCount = 0;

    // 2. 处理 needs_more_exploration 标志
    if (needsMoreExploration) {
      return `[You have indicated that you need more exploration. Proceed with calling tools to continue the planning process.]`;
    }

    // 解析选项
    let options: string[] = [];
    if (optionsRaw) {
      try {
        options = JSON.parse(optionsRaw);
      } catch {
        // 如果解析失败，尝试简单分割
        options = optionsRaw.split(',').map(o => o.trim()).filter(o => o);
      }
    }

    // 3. 向用户展示计划
    let displayMessage = `AI 计划:\n\n${response}`;
    if (options.length > 0) {
      displayMessage += `\n\n可选操作：\n${options.map((opt, idx) => `${idx + 1}. ${opt}`).join('\n')}`;
    }

    await config.callbacks.say(
      'text' as any,
      displayMessage,
    );

    // 设置等待计划响应状态
    config.taskState.isAwaitingPlanResponse = true;

    // 4. 等待用户响应
    const result = await config.callbacks.ask(
      'followup' as any,
      '请选择操作或提供反馈：',
    );

    config.taskState.isAwaitingPlanResponse = false;

    // 5. 处理用户响应
    const userText = result.text || '';

    // 检查用户是否选择了预定义选项
    if (options.length > 0 && userText) {
      // 检查是否是数字选择
      const optionIndex = parseInt(userText) - 1;
      if (optionIndex >= 0 && optionIndex < options.length) {
        const selectedOption = options[optionIndex];
        await config.callbacks.say(
          'text' as any,
          `用户选择: ${selectedOption}`,
        );
        return `<user_message>\n${selectedOption}\n</user_message>`;
      }

      // 检查是否直接匹配选项文本
      if (options.includes(userText)) {
        await config.callbacks.say(
          'text' as any,
          `用户选择: ${userText}`,
        );
        return `<user_message>\n${userText}\n</user_message>`;
      }
    }

    // 6. 用户提供了自定义反馈
    if (userText) {
      await config.callbacks.say(
        'text' as any,
        `用户反馈: ${userText}`,
      );
      return `<user_message>\n${userText}\n</user_message>`;
    }

    // 用户没有提供任何响应，默认继续
    return `[The user acknowledged the plan. You may proceed.]`;
  }
}
