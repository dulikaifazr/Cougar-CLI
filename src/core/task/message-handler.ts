/**
 * 消息状态处理器
 * 适配自 task/消息状态.ts
 * 
 * 功能：
 * - 管理 API 对话历史（发给 AI 的原始消息）
 * - 管理 Cline 消息（UI 展示的富消息）
 * - 消息持久化存储
 * - 任务历史更新
 * 
 * CLI 适配说明：
 * - 移除 CheckpointTracker 依赖（简化版）
 * - 保留核心消息管理逻辑
 * - 使用简单的 JSON 文件存储
 */
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { TaskState } from './state';

/**
 * Cline 消息接口
 */
export interface ClineMessage {
  ts: number;
  type: 'say' | 'ask';
  say?: string;
  ask?: string;
  text?: string;
  images?: string[];
  conversationHistoryIndex?: number;
  conversationHistoryDeletedRange?: [number, number];
  lastCheckpointHash?: string;
  [key: string]: any;
}

/**
 * 任务历史项接口
 */
export interface HistoryItem {
  id: string;
  ulid: string;
  ts: number;
  task: string;
  tokensIn: number;
  tokensOut: number;
  cacheWrites?: number;
  cacheReads?: number;
  totalCost: number;
  size?: number;
  cwdOnTaskInitialization?: string;
  conversationHistoryDeletedRange?: [number, number];
  isFavorited?: boolean;
  checkpointManagerErrorMessage?: string;
  [key: string]: any;
}

/**
 * 消息状态处理器参数
 */
interface MessageStateHandlerParams {
  taskId: string;
  ulid: string;
  taskIsFavorited?: boolean;
  updateTaskHistory: (historyItem: HistoryItem) => Promise<HistoryItem[]>;
  taskState: TaskState;
  cwd: string;
}

/**
 * 消息状态处理器
 */
export class MessageStateHandler {
  private apiConversationHistory: Anthropic.MessageParam[] = [];
  private clineMessages: ClineMessage[] = [];
  private taskIsFavorited: boolean;
  private updateTaskHistory: (historyItem: HistoryItem) => Promise<HistoryItem[]>;
  private taskId: string;
  private ulid: string;
  private taskState: TaskState;
  private cwd: string;

  constructor(params: MessageStateHandlerParams) {
    this.taskId = params.taskId;
    this.ulid = params.ulid;
    this.taskState = params.taskState;
    this.taskIsFavorited = params.taskIsFavorited ?? false;
    this.updateTaskHistory = params.updateTaskHistory;
    this.cwd = params.cwd;
  }

  /**
   * 获取 API 对话历史
   */
  getApiConversationHistory(): Anthropic.MessageParam[] {
    return this.apiConversationHistory;
  }

  /**
   * 设置 API 对话历史
   */
  setApiConversationHistory(newHistory: Anthropic.MessageParam[]): void {
    this.apiConversationHistory = newHistory;
  }

  /**
   * 获取 Cline 消息列表
   */
  getClineMessages(): ClineMessage[] {
    return this.clineMessages;
  }

  /**
   * 设置 Cline 消息列表
   */
  setClineMessages(newMessages: ClineMessage[]): void {
    this.clineMessages = newMessages;
  }

  /**
   * 保存 Cline 消息并更新历史
   */
  async saveClineMessagesAndUpdateHistory(): Promise<void> {
    try {
      // 保存消息到文件
      await this.saveClineMessages();

      // 计算 API 指标
      const apiMetrics = this.calculateApiMetrics();

      // 获取任务消息（第一条消息）
      const taskMessage = this.clineMessages[0];
      
      // 获取最后一条相关消息
      const lastRelevantMessage = this.getLastRelevantMessage();

      // 获取任务目录大小
      const taskDirSize = await this.getTaskDirectorySize();

      // 更新任务历史
      await this.updateTaskHistory({
        id: this.taskId,
        ulid: this.ulid,
        ts: lastRelevantMessage.ts,
        task: taskMessage?.text ?? '',
        tokensIn: apiMetrics.totalTokensIn,
        tokensOut: apiMetrics.totalTokensOut,
        cacheWrites: apiMetrics.totalCacheWrites,
        cacheReads: apiMetrics.totalCacheReads,
        totalCost: apiMetrics.totalCost,
        size: taskDirSize,
        cwdOnTaskInitialization: this.cwd,
        conversationHistoryDeletedRange: this.taskState.conversationHistoryDeletedRange,
        isFavorited: this.taskIsFavorited,
        checkpointManagerErrorMessage: this.taskState.checkpointManagerErrorMessage,
      });
    } catch (error) {
      console.error('Failed to save cline messages:', error);
    }
  }

  /**
   * 添加消息到 API 对话历史
   */
  async addToApiConversationHistory(message: Anthropic.MessageParam): Promise<void> {
    this.apiConversationHistory.push(message);
    await this.saveApiConversationHistory();
  }

  /**
   * 覆盖 API 对话历史
   */
  async overwriteApiConversationHistory(newHistory: Anthropic.MessageParam[]): Promise<void> {
    this.apiConversationHistory = newHistory;
    await this.saveApiConversationHistory();
  }

  /**
   * 添加 Cline 消息
   */
  async addToClineMessages(message: ClineMessage): Promise<void> {
    // 记录对话历史索引
    message.conversationHistoryIndex = this.apiConversationHistory.length - 1;
    message.conversationHistoryDeletedRange = this.taskState.conversationHistoryDeletedRange;
    
    this.clineMessages.push(message);
    await this.saveClineMessagesAndUpdateHistory();
  }

  /**
   * 覆盖 Cline 消息
   */
  async overwriteClineMessages(newMessages: ClineMessage[]): Promise<void> {
    this.clineMessages = newMessages;
    await this.saveClineMessagesAndUpdateHistory();
  }

  /**
   * 更新指定索引的 Cline 消息
   */
  async updateClineMessage(index: number, updates: Partial<ClineMessage>): Promise<void> {
    if (index < 0 || index >= this.clineMessages.length) {
      throw new Error(`Invalid message index: ${index}`);
    }

    // 应用更新
    Object.assign(this.clineMessages[index], updates);

    // 保存更改
    await this.saveClineMessagesAndUpdateHistory();
  }

  /**
   * 保存 API 对话历史到文件
   */
  private async saveApiConversationHistory(): Promise<void> {
    const taskDir = await this.ensureTaskDirectory();
    const filePath = path.join(taskDir, 'api_conversation_history.json');
    await fs.writeFile(
      filePath,
      JSON.stringify(this.apiConversationHistory, null, 2),
      'utf-8'
    );
  }

  /**
   * 保存 Cline 消息到文件
   */
  private async saveClineMessages(): Promise<void> {
    const taskDir = await this.ensureTaskDirectory();
    const filePath = path.join(taskDir, 'cline_messages.json');
    await fs.writeFile(
      filePath,
      JSON.stringify(this.clineMessages, null, 2),
      'utf-8'
    );
  }

  /**
   * 确保任务目录存在
   */
  private async ensureTaskDirectory(): Promise<string> {
    const baseDir = path.join(os.homedir(), '.cline', 'tasks');
    const taskDir = path.join(baseDir, this.taskId);
    await fs.mkdir(taskDir, { recursive: true });
    return taskDir;
  }

  /**
   * 计算 API 指标
   */
  private calculateApiMetrics() {
    let totalTokensIn = 0;
    let totalTokensOut = 0;
    let totalCacheWrites = 0;
    let totalCacheReads = 0;
    let totalCost = 0;

    for (const message of this.clineMessages) {
      if (message.text) {
        try {
          const info = JSON.parse(message.text);
          if (info.tokensIn) totalTokensIn += info.tokensIn;
          if (info.tokensOut) totalTokensOut += info.tokensOut;
          if (info.cacheWrites) totalCacheWrites += info.cacheWrites;
          if (info.cacheReads) totalCacheReads += info.cacheReads;
          if (info.cost) totalCost += info.cost;
        } catch {
          // 忽略解析错误
        }
      }
    }

    return {
      totalTokensIn,
      totalTokensOut,
      totalCacheWrites,
      totalCacheReads,
      totalCost,
    };
  }

  /**
   * 获取最后一条相关消息
   */
  private getLastRelevantMessage(): ClineMessage {
    // 从后往前查找，跳过 resume 消息
    for (let i = this.clineMessages.length - 1; i >= 0; i--) {
      const message = this.clineMessages[i];
      if (message.ask !== 'resume_task' && message.ask !== 'resume_completed_task') {
        return message;
      }
    }
    // 如果没有找到，返回最后一条
    return this.clineMessages[this.clineMessages.length - 1] || { ts: Date.now(), type: 'say' };
  }

  /**
   * 获取任务目录大小
   */
  private async getTaskDirectorySize(): Promise<number> {
    try {
      const taskDir = await this.ensureTaskDirectory();
      const files = await fs.readdir(taskDir);
      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(taskDir, file);
        const stats = await fs.stat(filePath);
        if (stats.isFile()) {
          totalSize += stats.size;
        }
      }

      return totalSize;
    } catch (error) {
      console.error('Failed to get task directory size:', error);
      return 0;
    }
  }
}
