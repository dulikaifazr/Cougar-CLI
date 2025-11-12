/**
 * 执行命令工具处理器
 * 适配自 task/工具处理器/17种工具处理器/执行命令工具处理器.ts
 * 
 * 功能：
 * - 执行 Shell 命令
 * - 支持实时输出
 * - 命令安全检查
 * - 超时控制
 * 
 * CLI 适配：
 * - 使用 Node.js child_process
 * - 简化 UI 交互
 * - 支持跨平台
 */

import { ToolUse } from '../../assistant-message';
import { TaskConfig, ToolResponse, IToolHandler } from '../types';
import { ToolValidator } from '../validator';
import * as commandExec from '../utils/command-executor';
import * as formatter from '../utils/response-formatter';

/**
 * 执行命令工具处理器类
 */
export class ExecuteCommandHandler implements IToolHandler {
  readonly name = 'execute_command';
  
  constructor(private validator: ToolValidator) {}

  /**
   * 执行命令工具
   * 
   * 工作流程：
   * 1. 验证必需参数（命令）
   * 2. 检查命令安全性
   * 3. 处理批准流程
   * 4. 执行命令
   * 5. 返回结果
   */
  async execute(params: any, config: TaskConfig): Promise<ToolResponse> {
    const command: string | undefined = params.command;
    const timeout: number | undefined = params.timeout;

    // 1. 验证必需参数
    const block: ToolUse = {
      type: 'tool_use',
      name: this.name as any,
      params: { command },
      partial: false,
    };

    const commandValidation = this.validator.assertRequiredParams(block, 'command');
    if (!commandValidation.ok) {
      config.taskState.consecutiveMistakeCount++;
      return formatter.missingParameter(this.name, 'command');
    }

    // 2. 检查命令安全性
    const safetyCheck = this.validator.checkCommand(command!);
    if (!safetyCheck.ok) {
      return formatter.toolError(safetyCheck.error);
    }

    // 额外的安全检查
    if (!commandExec.isCommandSafe(command!)) {
      return formatter.toolError('命令包含危险模式，拒绝执行');
    }

    // 参数验证通过，重置错误计数器
    config.taskState.consecutiveMistakeCount = 0;

    // 3. 处理批准流程
    const shouldAutoApprove = config.callbacks.shouldAutoApproveTool?.(this.name) ?? false;
    
    if (!shouldAutoApprove) {
      // 请求用户批准
      await config.callbacks.say(
        'command' as any,
        `请求执行命令: ${command}`,
      );

      const result = await config.callbacks.ask(
        'command' as any,
        `允许执行命令 "${command}" 吗？`,
      );

      if (result.response !== 'yesButtonClicked' as any) {
        return formatter.toolDenied();
      }
    }

    // 4. 执行命令
    try {
      // 显示正在执行
      await config.callbacks.say(
        'command' as any,
        `正在执行: ${command}`,
      );

      const result = await commandExec.executeCommand(command!, {
        cwd: config.cwd,
        timeout: timeout ? timeout * 1000 : 30000, // 转换为毫秒
      });

      // 5. 返回结果
      if (result.success) {
        return formatter.commandSuccess(result.stdout, result.exitCode);
      } else {
        return formatter.commandError(command!, result.stderr || result.stdout);
      }
    } catch (error: any) {
      return formatter.commandError(command!, error.message);
    }
  }
}
