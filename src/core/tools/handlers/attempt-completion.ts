/**
 * 尝试完成任务工具处理器
 * 适配自 task/工具处理器/17种工具处理器/完成任务处理器.ts
 * 
 * 功能：
 * - 标记任务完成
 * - 报告任务结果
 * - 可选执行验证命令
 * - 等待用户确认
 * 
 * CLI 适配：
 * - 简化为命令行交互
 * - 支持验证命令
 */

import { ToolUse } from '../../assistant-message';
import { TaskConfig, ToolResponse, IToolHandler } from '../types';
import { ToolValidator } from '../validator';
import * as commandExec from '../utils/command-executor';
import * as formatter from '../utils/response-formatter';

/**
 * 尝试完成任务工具处理器类
 */
export class AttemptCompletionHandler implements IToolHandler {
  readonly name = 'attempt_completion';
  
  constructor(private validator: ToolValidator) {}

  /**
   * 执行尝试完成任务工具
   * 
   * 工作流程：
   * 1. 验证必需参数（结果）
   * 2. 如果有命令，执行验证命令
   * 3. 显示任务结果
   * 4. 等待用户确认
   * 5. 返回结果
   */
  async execute(params: any, config: TaskConfig): Promise<ToolResponse> {
    const result: string | undefined = params.result;
    const command: string | undefined = params.command;

    // 1. 验证必需参数
    const block: ToolUse = {
      type: 'tool_use',
      name: this.name as any,
      params: { result },
      partial: false,
    };

    const resultValidation = this.validator.assertRequiredParams(block, 'result');
    if (!resultValidation.ok) {
      config.taskState.consecutiveMistakeCount++;
      return formatter.missingParameter(this.name, 'result');
    }

    // 参数验证通过，重置错误计数器
    config.taskState.consecutiveMistakeCount = 0;

    let commandOutput = '';

    // 2. 如果有命令，执行验证命令
    if (command) {
      // 请求执行验证命令
      await config.callbacks.say(
        'text' as any,
        `请求执行验证命令: ${command}`,
      );

      const approvalResult = await config.callbacks.ask(
        'completion_result' as any,
        `任务完成，是否执行验证命令 "${command}"？`,
      );

      if (approvalResult.response === 'yesButtonClicked' as any) {
        try {
          const cmdResult = await commandExec.executeCommand(command, {
            cwd: config.cwd,
            timeout: 60000, // 60秒超时
          });

          if (cmdResult.success) {
            commandOutput = `\n\n验证命令执行成功：\n${cmdResult.stdout}`;
          } else {
            commandOutput = `\n\n验证命令执行失败：\n${cmdResult.stderr || cmdResult.stdout}`;
          }
        } catch (error: any) {
          commandOutput = `\n\n验证命令执行错误：${error.message}`;
        }
      }
    }

    // 3. 显示任务结果
    const fullResult = `${result}${commandOutput}`;
    
    await config.callbacks.say(
      'completion_result' as any,
      fullResult,
    );

    // 4. 等待用户确认
    const confirmResult = await config.callbacks.ask(
      'completion_result' as any,
      '任务已完成，是否满意？',
    );

    // 5. 返回结果
    if (confirmResult.response === 'yesButtonClicked' as any) {
      return formatter.taskCompletion(fullResult);
    } else if (confirmResult.text) {
      return `用户反馈: ${confirmResult.text}`;
    } else {
      return '用户要求继续修改。';
    }
  }
}
