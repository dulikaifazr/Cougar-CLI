/**
 * 企业级文件搜索工具处理器
 * 完全基于官方 Cline 实现，针对 CLI 环境优化
 * 
 * 核心特性：
 * - 高性能 ripgrep 集成（官方标准）
 * - 流式处理，防止内存溢出
 * - 字节大小控制（0.25MB 限制）
 * - 智能截断和进程管理
 * - 企业级错误处理
 * 
 * 性能优化：
 * - 最多 300 个结果
 * - 每个结果最多 5 行输出
 * - 主动进程终止机制
 * - 跨平台兼容性
 */
import path from 'path';
import { ToolUse } from '../../assistant-message';
import { TaskConfig, ToolResponse, IToolHandler } from '../types';
import { ToolValidator } from '../validator';
import * as fileOps from '../utils/file-operations';
import * as formatter from '../utils/response-formatter';
import { regexSearchFiles, checkRipgrepAvailability as checkRipgrepBinaryAvailable } from '../../../services/ripgrep';

/**
 * 企业级文件搜索工具处理器
 * 基于官方 Cline 实现，使用ripgrep服务模块
 */
export class SearchFilesHandler implements IToolHandler {
  readonly name = 'search_files';
  private ripgrepAvailable: boolean | null = null;

  constructor(private validator: ToolValidator) {}

  /**
   * 检查 ripgrep 可用性
   */
  private async checkRipgrepAvailability(): Promise<boolean> {
    if (this.ripgrepAvailable !== null) {
      return this.ripgrepAvailable;
    }

    try {
      this.ripgrepAvailable = await checkRipgrepBinaryAvailable();
      return this.ripgrepAvailable;
    } catch {
      this.ripgrepAvailable = false;
      return false;
    }
  }

  /**
   * 企业级搜索执行器
   * 
   * 工作流程：
   * 1. 验证必需参数
   * 2. 检查路径安全性
   * 3. 解析绝对路径
   * 4. 处理批准流程
   * 5. 执行高性能搜索
   * 6. 格式化结果
   * 7. 返回搜索结果
   */
  async execute(params: any, config: TaskConfig): Promise<ToolResponse> {
    const relPath: string | undefined = params.path;
    const regex: string | undefined = params.regex;
    const filePattern: string | undefined = params.file_pattern;

    // 1. 验证必需参数
    const block: ToolUse = {
      type: 'tool_use',
      name: this.name as any,
      params: { path: relPath, regex },
      partial: false,
    };

    const pathValidation = this.validator.assertRequiredParams(block, 'path');
    if (!pathValidation.ok) {
      config.taskState.consecutiveMistakeCount++;
      return formatter.missingParameter(this.name, 'path');
    }

    const regexValidation = this.validator.assertRequiredParams(block, 'regex');
    if (!regexValidation.ok) {
      config.taskState.consecutiveMistakeCount++;
      return formatter.missingParameter(this.name, 'regex');
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
        `企业级搜索请求: ${relPath}\n模式: ${regex}${filePattern ? `\n文件过滤: ${filePattern}` : ''}`,
      );

      const result = await config.callbacks.ask(
        'tool' as any,
        `允许执行高性能搜索 ${relPath} 吗？`,
      );

      if (result.response !== 'yesButtonClicked' as any) {
        return formatter.toolDenied();
      }
    }

    // 5. 执行企业级搜索
    try {
      // 检查路径是否存在
      if (!fileOps.fileExists(absolutePath)) {
        return formatter.fileNotFound(absolutePath);
      }

      // 企业级要求：必须使用 ripgrep
      if (!(await this.checkRipgrepAvailability())) {
        return formatter.toolError(
          'Enterprise-grade search requires ripgrep. Please install ripgrep for optimal performance.\n' +
          'Installation: https://github.com/BurntSushi/ripgrep#installation'
        );
      }

      // 使用ripgrep服务执行搜索
      const formattedResults = await regexSearchFiles(
        config.cwd,
        absolutePath,
        regex!,
        filePattern
      );

      return formattedResults;
    } catch (error: any) {
      return formatter.toolError(`Enterprise search failed: ${error.message}`);
    }
  }
}