/**
 * 自动批准逻辑
 * 适配自 task/工具处理器/自动批准.ts
 * 
 * 核心作用：
 * - 根据用户设置决定工具是否需要自动批准
 * - 支持本地和外部文件的不同策略
 * - 缓存工作区信息提升性能
 * 
 * CLI 适配：
 * - 简化工作区检查
 * - 保留核心批准逻辑
 * - 移除 VSCode 特定功能
 */

import path from 'path';
import { AutoApprovalSettings } from './types';

/**
 * 工具名称枚举（简化版）
 */
export enum ToolName {
  READ_FILE = 'read_file',
  WRITE_FILE = 'write_to_file',
  EXECUTE_COMMAND = 'execute_command',
  SEARCH_FILES = 'search_files',
  LIST_FILES = 'list_files',
  ASK_FOLLOWUP = 'ask_followup_question',
  ATTEMPT_COMPLETION = 'attempt_completion',
}

/**
 * 自动批准类
 */
export class AutoApprove {
  private cwd: string;
  private settings: AutoApprovalSettings;

  constructor(cwd: string, settings?: AutoApprovalSettings) {
    this.cwd = cwd;
    this.settings = settings || { enabled: false };
  }

  /**
   * 检查工具是否应该自动批准
   * 
   * @param toolName - 工具名称
   * @returns 是否自动批准
   */
  shouldAutoApproveTool(toolName: string): boolean {
    if (!this.settings.enabled) {
      return false;
    }

    // CLI 版本简化：基本的自动批准规则
    switch (toolName) {
      case ToolName.READ_FILE:
      case ToolName.SEARCH_FILES:
      case ToolName.LIST_FILES:
        // 读取操作通常可以自动批准
        return true;

      case ToolName.WRITE_FILE:
        // 写入操作需要更谨慎
        return false;

      case ToolName.EXECUTE_COMMAND:
        // 命令执行需要特别小心
        return false;

      case ToolName.ASK_FOLLOWUP:
      case ToolName.ATTEMPT_COMPLETION:
        // 交互类工具可以自动批准
        return true;

      default:
        return false;
    }
  }

  /**
   * 检查带路径的工具是否应该自动批准
   * 
   * @param toolName - 工具名称
   * @param filePath - 文件路径
   * @returns 是否自动批准
   */
  async shouldAutoApproveToolWithPath(
    toolName: string,
    filePath?: string,
  ): Promise<boolean> {
    if (!this.settings.enabled) {
      return false;
    }

    // 基本工具检查
    const basicApproval = this.shouldAutoApproveTool(toolName);
    if (!basicApproval) {
      return false;
    }

    // 如果没有路径，使用基本检查结果
    if (!filePath) {
      return basicApproval;
    }

    // 检查路径是否在工作目录内
    const isLocal = this.isPathInWorkspace(filePath);

    // 本地文件更容易自动批准
    if (isLocal) {
      return true;
    }

    // 外部文件需要更谨慎
    return false;
  }

  /**
   * 检查路径是否在工作区内
   * 
   * @param filePath - 文件路径
   * @returns 是否在工作区内
   */
  private isPathInWorkspace(filePath: string): boolean {
    try {
      // 解析为绝对路径
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(this.cwd, filePath);

      // 检查是否在 cwd 下
      const relativePath = path.relative(this.cwd, absolutePath);
      
      // 如果相对路径以 '..' 开头，说明在外部
      return !relativePath.startsWith('..');
    } catch (error) {
      // 出错时谨慎处理，返回 false
      return false;
    }
  }

  /**
   * 更新设置
   * 
   * @param settings - 新的设置
   */
  updateSettings(settings: AutoApprovalSettings): void {
    this.settings = settings;
  }

  /**
   * 获取当前设置
   * 
   * @returns 当前设置
   */
  getSettings(): AutoApprovalSettings {
    return { ...this.settings };
  }
}
