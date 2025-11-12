/**
 * 写入文件工具处理器
 * 适配自 task/工具处理器/17种工具处理器/写入文件工具处理器.ts
 * 
 * 功能：
 * - 创建新文件或完全重写现有文件
 * - 支持路径验证和安全检查
 * - 自动创建目录
 * 
 * CLI 适配：
 * - 移除 VSCode diff 编辑器
 * - 简化 UI 交互
 * - 直接写入文件
 */

import path from 'path';
import { ToolUse } from '../../assistant-message';
import { TaskConfig, ToolResponse, IToolHandler } from '../types';
import { ToolValidator } from '../validator';
import * as fileOps from '../utils/file-operations';
import * as formatter from '../utils/response-formatter';
import { formatResponse } from '../../../prompts/runtime/responses';

/**
 * 写入文件工具处理器类
 */
export class WriteFileHandler implements IToolHandler {
  readonly name = 'write_to_file';
  
  constructor(private validator: ToolValidator) {}

  /**
   * 执行写入文件工具
   * 
   * 工作流程：
   * 1. 验证必需参数（路径和内容）
   * 2. 检查路径安全性
   * 3. 解析绝对路径
   * 4. 检查文件是否存在
   * 5. 处理批准流程
   * 6. 写入文件内容
   * 7. 返回结果
   */
  async execute(params: any, config: TaskConfig): Promise<ToolResponse> {
    const relPath: string | undefined = params.path;
    const content: string | undefined = params.content;

    // 1. 验证必需参数
    const block: ToolUse = {
      type: 'tool_use',
      name: this.name as any,
      params: { path: relPath, content },
      partial: false,
    };

    const pathValidation = this.validator.assertRequiredParams(block, 'path');
    if (!pathValidation.ok) {
      config.taskState.consecutiveMistakeCount++;
      return formatter.missingParameter(this.name, 'path');
    }

    const contentValidation = this.validator.assertRequiredParams(block, 'content');
    if (!contentValidation.ok) {
      config.taskState.consecutiveMistakeCount++;
      return formatter.missingParameter(this.name, 'content');
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

    // 4. 检查文件是否存在
    const fileExists = fileOps.fileExists(absolutePath);
    const action = fileExists ? '更新' : '创建';

    // 5. 处理批准流程
    const shouldAutoApprove = config.callbacks.shouldAutoApproveTool?.(this.name) ?? false;
    
    if (!shouldAutoApprove) {
      // 生成显示内容
      let displayContent: string;
      
      if (fileExists) {
        // 文件存在，显示 diff
        const originalContent = await fileOps.readFile(absolutePath);
        const diffContent = formatResponse.createPrettyPatch(relPath!, originalContent, content!);
        displayContent = `文件差异对比：\n\n${diffContent}`;
      } else {
        // 新文件，显示内容预览
        displayContent = `新文件内容预览：\n${content!.substring(0, 300)}${content!.length > 300 ? '\n\n... (内容过长，已截断)' : ''}`;
      }

      // 请求用户批准
      await config.callbacks.say(
        'tool' as any,
        `请求${action}文件: ${relPath}`,
      );

      const result = await config.callbacks.ask(
        'tool' as any,
        `允许${action}文件 ${relPath} 吗？\n\n${displayContent}`,
      );

      if (result.response !== 'yesButtonClicked' as any) {
        return formatter.toolDenied();
      }
    }

    // 6. 写入文件内容
    try {
      await fileOps.writeFile(absolutePath, content!);

      // 记录文件编辑
      config.taskState.didEditFile = true;

      // 7. 返回结果
      return formatter.fileWriteSuccess(relPath!, !fileExists);
    } catch (error: any) {
      return formatter.fileWriteError(absolutePath, error.message);
    }
  }
}
