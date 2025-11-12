/**
 * 列出文件工具处理器
 * 适配自 task/工具处理器/17种工具处理器/生成结构树.ts
 * 
 * 功能：
 * - 查看目录结构和文件列表
 * - 支持两种模式：顶层模式和递归模式
 * - 显示文件大小和修改时间
 * 
 * CLI 适配：
 * - 移除 VSCode 特定功能
 * - 简化 UI 交互
 * - 使用 Node.js fs 模块
 */

import path from 'path';
import fs from 'fs/promises';
import { ToolUse } from '../../assistant-message';
import { TaskConfig, ToolResponse, IToolHandler } from '../types';
import { ToolValidator } from '../validator';
import * as fileOps from '../utils/file-operations';
import * as formatter from '../utils/response-formatter';

/**
 * 列出文件工具处理器类
 */
export class ListFilesHandler implements IToolHandler {
  readonly name = 'list_files';
  
  constructor(private validator: ToolValidator) {}

  /**
   * 执行列出文件工具
   * 
   * 工作流程：
   * 1. 验证必需参数（目录路径）
   * 2. 检查路径安全性
   * 3. 解析绝对路径
   * 4. 根据 recursive 参数决定列出模式
   * 5. 处理批准流程
   * 6. 列出文件
   * 7. 格式化文件列表
   * 8. 返回结果
   */
  async execute(params: any, config: TaskConfig): Promise<ToolResponse> {
    const relPath: string | undefined = params.path;
    const recursiveRaw: string | undefined = params.recursive;
    const recursive = recursiveRaw?.toLowerCase() === 'true';

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
        `请求列出文件: ${relPath}${recursive ? ' (递归)' : ' (顶层)'}`,
      );

      const result = await config.callbacks.ask(
        'tool' as any,
        `允许列出目录 ${relPath} 吗？`,
      );

      if (result.response !== 'yesButtonClicked' as any) {
        return formatter.toolDenied();
      }
    }

    // 5. 列出文件
    try {
      // 检查路径是否存在
      if (!fileOps.fileExists(absolutePath)) {
        return formatter.fileNotFound(absolutePath);
      }

      // 检查是否是目录
      const isDir = await fileOps.isDirectory(absolutePath);
      if (!isDir) {
        return formatter.toolError(`Path is not a directory: ${absolutePath}`);
      }

      // 根据 recursive 参数列出文件
      const files = await this.listFilesWithDetails(absolutePath, recursive);

      // 6. 格式化文件列表
      let resultText: string;
      if (files.length === 0) {
        resultText = `Directory is empty.`;
      } else {
        const maxFiles = 2000; // 提高限制：200 → 2000
        const didHitLimit = files.length > maxFiles;
        const displayFiles = didHitLimit ? files.slice(0, maxFiles) : files;

        resultText = `Found ${files.length} item${files.length > 1 ? 's' : ''}${didHitLimit ? ` (showing first ${maxFiles})` : ''}.\n\n`;
        
        // 格式化文件列表
        const formattedFiles = displayFiles.map(file => {
          const relativePath = path.relative(config.cwd, file.path);
          const type = file.isDirectory ? 'DIR' : 'FILE';
          const size = file.isDirectory ? '' : ` (${this.formatFileSize(file.size)})`;
          return `[${type}] ${relativePath}${size}`;
        });

        resultText += formattedFiles.join('\n');

        if (didHitLimit) {
          resultText += `\n\n... and ${files.length - maxFiles} more items.`;
        }
      }

      // 7. 返回结果
      return resultText;
    } catch (error: any) {
      return formatter.toolError(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * 列出文件并获取详细信息
   */
  private async listFilesWithDetails(
    dirPath: string,
    recursive: boolean
  ): Promise<Array<{ path: string; isDirectory: boolean; size: number }>> {
    const results: Array<{ path: string; isDirectory: boolean; size: number }> = [];

    async function scan(dir: string, isRecursive: boolean) {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        // 跳过隐藏文件和目录
        if (entry.name.startsWith('.')) {
          continue;
        }

        // 跳过常见的构建和依赖目录（参考官方实现）
        const ignoredDirs = [
          'node_modules',
          '__pycache__',
          'env',
          'venv',
          'dist',
          'out',
          'build',
          'bundle',
          'vendor',
          'tmp',
          'temp',
          'deps',
          'Pods',
          'target',
          'coverage',
          '.gradle',
          '.idea',
          '.next',
          '.nuxt',
          '.parcel-cache',
          '.pytest_cache',
          '.sass-cache',
          '.vs',
        ];
        
        if (ignoredDirs.includes(entry.name)) {
          continue;
        }

        if (entry.isDirectory()) {
          results.push({
            path: fullPath,
            isDirectory: true,
            size: 0,
          });

          if (isRecursive) {
            await scan(fullPath, true);
          }
        } else {
          try {
            const stats = await fs.stat(fullPath);
            results.push({
              path: fullPath,
              isDirectory: false,
              size: stats.size,
            });
          } catch {
            // 忽略无法访问的文件
          }
        }
      }
    }

    await scan(dirPath, recursive);
    return results;
  }

  /**
   * 格式化文件大小
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }
}
