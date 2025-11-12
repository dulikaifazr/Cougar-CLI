/**
 * 文件上下文追踪器（CLI适配版）
 * 参考官方源代码：上下文/上下文追踪/文件上下文追踪.ts
 * 
 * 核心作用：
 * - 追踪已读取和已编辑的文件
 * - 防止AI重复读取相同文件
 * - 检测文件状态变化
 * - 在环境详情中显示已读取的文件
 * 
 * CLI适配：
 * - 移除VSCode API依赖
 * - 移除chokidar文件监听（CLI环境不需要实时监听）
 * - 简化为内存追踪
 * - 保留核心追踪逻辑
 */

import * as path from 'path';
import type { FileMetadataEntry } from './types';

/**
 * 文件上下文追踪器类
 */
export class FileContextTracker {
  private taskId: string;
  private cwd: string;
  
  // 内存中的文件追踪
  private filesInContext: FileMetadataEntry[] = [];
  private recentlyModifiedFiles = new Set<string>();
  private recentlyEditedByCline = new Set<string>();
  
  constructor(taskId: string, cwd: string) {
    this.taskId = taskId;
    this.cwd = cwd;
  }

  /**
   * 追踪文件操作（主要入口点）
   * 当文件通过工具、提及或编辑传递给AI时调用
   * 
   * 参考官方：trackFileContext方法
   */
  async trackFileContext(
    filePath: string,
    operation: 'read_tool' | 'user_edited' | 'cline_edited' | 'file_mentioned'
  ): Promise<void> {
    try {
      // 标准化路径
      const normalizedPath = this.normalizePath(filePath);
      
      // 添加到追踪列表
      await this.addFileToTracker(normalizedPath, operation);
    } catch (error: any) {
      console.warn(`Failed to track file operation: ${error.message}`);
    }
  }

  /**
   * 将文件添加到追踪器
   * 处理文件状态（新的、过期的、活跃的）
   * 
   * 参考官方：addFileToFileContextTracker方法
   */
  private async addFileToTracker(
    filePath: string,
    source: FileMetadataEntry['record_source']
  ): Promise<void> {
    const now = Date.now();

    // 将此文件的现有条目标记为过期
    this.filesInContext.forEach((entry) => {
      if (entry.path === filePath && entry.record_state === 'active') {
        entry.record_state = 'stale';
      }
    });

    // 辅助函数：获取特定字段的最新日期
    const getLatestDateForField = (
      path: string,
      field: keyof FileMetadataEntry
    ): number | null => {
      const relevantEntries = this.filesInContext
        .filter((entry) => entry.path === path && entry[field])
        .sort((a, b) => (b[field] as number) - (a[field] as number));

      return relevantEntries.length > 0 ? (relevantEntries[0][field] as number) : null;
    };

    // 创建新条目
    const newEntry: FileMetadataEntry = {
      path: filePath,
      record_state: 'active',
      record_source: source,
      cline_read_date: getLatestDateForField(filePath, 'cline_read_date'),
      cline_edit_date: getLatestDateForField(filePath, 'cline_edit_date'),
      user_edit_date: getLatestDateForField(filePath, 'user_edit_date'),
    };

    // 根据操作类型更新时间戳
    switch (source) {
      case 'user_edited':
        newEntry.user_edit_date = now;
        this.recentlyModifiedFiles.add(filePath);
        break;

      case 'cline_edited':
        newEntry.cline_read_date = now;
        newEntry.cline_edit_date = now;
        this.recentlyEditedByCline.add(filePath);
        break;

      case 'read_tool':
      case 'file_mentioned':
        newEntry.cline_read_date = now;
        break;
    }

    this.filesInContext.push(newEntry);
  }

  /**
   * 检查文件是否已在上下文中
   */
  isFileInContext(filePath: string): boolean {
    const normalizedPath = this.normalizePath(filePath);
    return this.filesInContext.some(
      (entry) => entry.path === normalizedPath && entry.record_state === 'active'
    );
  }

  /**
   * 获取所有活跃的文件
   */
  getActiveFiles(): string[] {
    return this.filesInContext
      .filter((entry) => entry.record_state === 'active')
      .map((entry) => entry.path);
  }

  /**
   * 获取已读取的文件列表
   */
  getReadFiles(): string[] {
    return this.filesInContext
      .filter(
        (entry) =>
          entry.record_state === 'active' &&
          (entry.record_source === 'read_tool' || entry.cline_read_date !== null)
      )
      .map((entry) => entry.path);
  }

  /**
   * 返回（然后清除）最近修改的文件集合
   * 参考官方：getAndClearRecentlyModifiedFiles方法
   */
  getAndClearRecentlyModifiedFiles(): string[] {
    const files = Array.from(this.recentlyModifiedFiles);
    this.recentlyModifiedFiles.clear();
    return files;
  }

  /**
   * 将文件标记为由AI编辑，防止误报
   * 参考官方：markFileAsEditedByCline方法
   */
  markFileAsEditedByCline(filePath: string): void {
    const normalizedPath = this.normalizePath(filePath);
    this.recentlyEditedByCline.add(normalizedPath);
  }

  /**
   * 标准化文件路径
   */
  private normalizePath(filePath: string): string {
    // 如果是绝对路径，转换为相对路径
    if (path.isAbsolute(filePath)) {
      return path.relative(this.cwd, filePath);
    }
    return filePath;
  }

  /**
   * 获取追踪统计信息
   */
  getStats(): {
    totalFiles: number;
    activeFiles: number;
    staleFiles: number;
    readFiles: number;
    editedFiles: number;
  } {
    const activeFiles = this.filesInContext.filter((e) => e.record_state === 'active');
    const staleFiles = this.filesInContext.filter((e) => e.record_state === 'stale');
    const readFiles = this.filesInContext.filter(
      (e) => e.record_source === 'read_tool' || e.cline_read_date !== null
    );
    const editedFiles = this.filesInContext.filter((e) => e.cline_edit_date !== null);

    return {
      totalFiles: this.filesInContext.length,
      activeFiles: activeFiles.length,
      staleFiles: staleFiles.length,
      readFiles: readFiles.length,
      editedFiles: editedFiles.length,
    };
  }

  /**
   * 清理资源
   * 参考官方：dispose方法
   */
  async dispose(): Promise<void> {
    this.filesInContext = [];
    this.recentlyModifiedFiles.clear();
    this.recentlyEditedByCline.clear();
  }
}
