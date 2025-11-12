/**
 * 读取文件工具处理器
 * 适配自 task/工具处理器/17种工具处理器/read__file.ts
 * 
 * 功能：
 * - 读取文本文件内容
 * - 支持各种文件编码
 * - 路径验证和安全检查
 * 
 * CLI 适配：
 * - 移除 VSCode 特定功能
 * - 简化 UI 交互
 * - 使用 Node.js fs 模块
 */

import path from 'path';
import { ToolUse } from '../../assistant-message';
import { TaskConfig, ToolResponse, IToolHandler } from '../types';
import { ToolValidator } from '../validator';
import * as fileOps from '../utils/file-operations';
import * as formatter from '../utils/response-formatter';

/**
 * 读取文件工具处理器类
 */
export class ReadFileHandler implements IToolHandler {
  readonly name = 'read_file';
  
  constructor(private validator: ToolValidator) {}

  /**
   * 执行读取文件工具
   * 
   * 工作流程：
   * 1. 验证必需参数（文件路径）
   * 2. 检查路径安全性
   * 3. 解析绝对路径
   * 4. 处理批准流程
   * 5. 读取文件内容
   * 6. 返回文件内容
   */
  async execute(params: any, config: TaskConfig): Promise<ToolResponse> {
    const relPath: string | undefined = params.path;

    // 1. 验证必需参数
    const block: ToolUse = {
      type: 'tool_use',
      name: this.name as any,
      params: { path: relPath },
      partial: false,
    };

    const pathValidation = this.validator.assertRequiredParams(block, 'path');
    if (!pathValidation.ok) {
      config.taskState.consecutiveMistakeCount++;
      return formatter.missingParameter(this.name, 'path');
    }

    // 2. 检查路径安全性
    const safetyCheck = this.validator.checkPath(relPath!);
    if (!safetyCheck.ok) {
      return formatter.toolError(safetyCheck.error);
    }

    // 参数验证通过，重置错误计数器
    config.taskState.consecutiveMistakeCount = 0;

    // 3. 解析绝对路径
    const absolutePath = path.isAbsolute(relPath!)
      ? relPath!
      : path.resolve(config.cwd, relPath!);

    // 4. 处理批准流程
    const shouldAutoApprove = config.callbacks.shouldAutoApproveTool?.(this.name) ?? false;
    
    if (!shouldAutoApprove) {
      // 请求用户批准
      await config.callbacks.say(
        'tool' as any,
        `请求读取文件: ${relPath}`,
      );

      const result = await config.callbacks.ask(
        'tool' as any,
        `允许读取文件 ${relPath} 吗？`,
      );

      if (result.response !== 'yesButtonClicked' as any) {
        return formatter.toolDenied();
      }
    }

    // 5. 读取文件内容
    try {
      // 检查文件是否存在
      if (!fileOps.fileExists(absolutePath)) {
        return formatter.fileNotFound(absolutePath);
      }

      // 读取文件
      const content = await fileOps.readFile(absolutePath);

      // 追踪文件读取操作（参考官方实现）
      if (config.taskExecutor) {
        const fileTracker = config.taskExecutor.getFileTracker();
        await fileTracker.trackFileContext(relPath!, 'read_tool');
      }

      // 6. 返回文件内容
      return content;
    } catch (error: any) {
      return formatter.fileReadError(absolutePath, error.message);
    }
  }
}
