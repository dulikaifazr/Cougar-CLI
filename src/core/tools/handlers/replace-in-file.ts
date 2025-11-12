/**
 * 替换文件内容工具处理器
 * 适配自 task/工具处理器/17种工具处理器/写入文件工具处理器.ts
 * 
 * 功能：
 * - 使用搜索-替换模式编辑现有文件
 * - 支持精确匹配和替换
 * - 保留文件的其他部分不变
 * 
 * CLI 适配：
 * - 移除 VSCode diff 编辑器
 * - 简化为直接文件操作
 * - 保留核心搜索替换逻辑
 */

import path from 'path';
import { ToolUse } from '../../assistant-message';
import { TaskConfig, ToolResponse, IToolHandler } from '../types';
import { ToolValidator } from '../validator';
import * as fileOps from '../utils/file-operations';
import * as formatter from '../utils/response-formatter';
import { formatResponse } from '../../../prompts/runtime/responses';

/**
 * 替换文件内容工具处理器类
 */
export class ReplaceInFileHandler implements IToolHandler {
  readonly name = 'replace_in_file';
  
  constructor(private validator: ToolValidator) {}

  /**
   * 执行替换文件内容工具
   * 
   * 工作流程：
   * 1. 验证必需参数（路径、diff）
   * 2. 检查路径安全性
   * 3. 解析绝对路径
   * 4. 读取原文件内容
   * 5. 解析并应用 diff
   * 6. 处理批准流程
   * 7. 写入修改后的内容
   * 8. 返回结果
   */
  async execute(params: any, config: TaskConfig): Promise<ToolResponse> {
    const relPath: string | undefined = params.path;
    const diff: string | undefined = params.diff;

    // 1. 验证必需参数
    const block: ToolUse = {
      type: 'tool_use',
      name: this.name as any,
      params: { path: relPath, diff },
      partial: false,
    };

    const pathValidation = this.validator.assertRequiredParams(block, 'path');
    if (!pathValidation.ok) {
      config.taskState.consecutiveMistakeCount++;
      return formatter.missingParameter(this.name, 'path');
    }

    const diffValidation = this.validator.assertRequiredParams(block, 'diff');
    if (!diffValidation.ok) {
      config.taskState.consecutiveMistakeCount++;
      return formatter.missingParameter(this.name, 'diff');
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

    // 4. 读取原文件内容
    try {
      // 检查文件是否存在
      if (!fileOps.fileExists(absolutePath)) {
        return formatter.fileNotFound(absolutePath);
      }

      const originalContent = await fileOps.readFile(absolutePath);

      // 5. 解析并应用 diff
      const newContent = this.applyDiff(originalContent, diff!);
      
      if (!newContent) {
        return formatter.toolError('Failed to apply diff: search string not found in file');
      }

      // 6. 处理批准流程
      const shouldAutoApprove = config.callbacks.shouldAutoApproveTool?.(this.name) ?? false;
      
      if (!shouldAutoApprove) {
        // 生成格式化的 diff 对比
        const prettyDiff = formatResponse.createPrettyPatch(relPath!, originalContent, newContent);
        
        // 请求用户批准
        await config.callbacks.say(
          'tool' as any,
          `请求替换文件内容: ${relPath}`,
        );

        const result = await config.callbacks.ask(
          'tool' as any,
          `允许修改文件 ${relPath} 吗？\n\n文件差异对比：\n\n${prettyDiff}`,
        );

        if (result.response !== 'yesButtonClicked' as any) {
          return formatter.toolDenied();
        }
      }

      // 7. 写入修改后的内容
      await fileOps.writeFile(absolutePath, newContent);

      // 记录文件编辑
      config.taskState.didEditFile = true;

      // 8. 返回结果
      return formatter.fileWriteSuccess(relPath!, false);
    } catch (error: any) {
      return formatter.fileWriteError(absolutePath, error.message);
    }
  }

  /**
   * 应用 diff 到文件内容
   * 
   * diff 格式：
   * <<<<<<< SEARCH
   * 要搜索的内容
   * =======
   * 替换后的内容
   * >>>>>>> REPLACE
   */
  private applyDiff(originalContent: string, diff: string): string | null {
    // 解析 diff 块
    const diffBlocks = this.parseDiffBlocks(diff);
    
    if (diffBlocks.length === 0) {
      return null;
    }

    let modifiedContent = originalContent;

    // 按顺序应用每个 diff 块
    for (const block of diffBlocks) {
      const { search, replace } = block;
      
      // 检查搜索字符串是否存在
      if (!modifiedContent.includes(search)) {
        console.error(`Search string not found in file:\n${search}`);
        return null;
      }

      // 执行替换（只替换第一次出现）
      modifiedContent = modifiedContent.replace(search, replace);
    }

    return modifiedContent;
  }

  /**
   * 解析 diff 字符串为搜索-替换块
   */
  private parseDiffBlocks(diff: string): Array<{ search: string; replace: string }> {
    const blocks: Array<{ search: string; replace: string }> = [];
    
    // 匹配 diff 块格式
    const diffBlockRegex = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
    
    let match;
    while ((match = diffBlockRegex.exec(diff)) !== null) {
      blocks.push({
        search: match[1],
        replace: match[2],
      });
    }

    // 如果没有找到标准格式，尝试简化格式
    if (blocks.length === 0) {
      // 尝试匹配简化格式（没有标记的直接搜索-替换）
      const lines = diff.split('\n');
      if (lines.length >= 2) {
        const midpoint = Math.floor(lines.length / 2);
        blocks.push({
          search: lines.slice(0, midpoint).join('\n'),
          replace: lines.slice(midpoint).join('\n'),
        });
      }
    }

    return blocks;
  }
}
