/**
 * 上下文优先级管理器
 * 新功能：为 CLI 系统添加消息优先级管理能力
 * 
 * 核心功能：
 * - 标记重要消息
 * - 计算消息优先级
 * - 在截断时保护高优先级消息
 * - 智能选择截断目标
 * 
 * 使用场景：
 * - 保护关键错误信息不被截断
 * - 保留重要的文件读取结果
 * - 确保任务目标始终可见
 * - 优先保留最近的交互
 */

import { Anthropic } from '@anthropic-ai/sdk';

/**
 * 优先级等级
 */
export enum Priority {
  CRITICAL = 100,  // 关键消息（任务目标、严重错误）
  HIGH = 75,       // 高优先级（重要文件、关键决策）
  NORMAL = 50,     // 普通优先级（常规交互）
  LOW = 25,        // 低优先级（冗余信息）
  MINIMAL = 0,     // 最低优先级（可随时删除）
}

/**
 * 消息优先级信息
 */
export interface MessagePriority {
  messageIndex: number;
  priority: Priority;
  reason: string;
  timestamp: number;
}

/**
 * 截断建议
 */
export interface TruncationSuggestion {
  startIndex: number;
  endIndex: number;
  messagesToRemove: number;
  estimatedSavings: number;
  protectedMessages: number[];
}

/**
 * 上下文优先级管理器
 */
export class ContextPriorityManager {
  private priorities: Map<number, MessagePriority> = new Map();
  private protectedIndices: Set<number> = new Set();

  /**
   * 标记消息为重要
   * @param messageIndex 消息索引
   * @param priority 优先级
   * @param reason 原因
   */
  markAsImportant(messageIndex: number, priority: Priority, reason: string): void {
    this.priorities.set(messageIndex, {
      messageIndex,
      priority,
      reason,
      timestamp: Date.now(),
    });

    // 关键和高优先级消息自动保护
    if (priority >= Priority.HIGH) {
      this.protectedIndices.add(messageIndex);
    }
  }

  /**
   * 自动计算消息优先级
   * @param message 消息
   * @param messageIndex 消息索引
   * @param totalMessages 总消息数
   * @returns 优先级分数
   */
  calculatePriority(
    message: Anthropic.MessageParam,
    messageIndex: number,
    totalMessages: number
  ): Priority {
    // 已手动设置优先级
    const existingPriority = this.priorities.get(messageIndex);
    if (existingPriority) {
      return existingPriority.priority;
    }

    let score = Priority.NORMAL;

    // 1. 位置因素：最近的消息更重要
    const recencyFactor = messageIndex / totalMessages;
    if (recencyFactor > 0.8) {
      score += 20; // 最近 20% 的消息
    } else if (recencyFactor > 0.6) {
      score += 10; // 最近 40% 的消息
    }

    // 2. 内容因素：检查消息内容
    const content = this.getMessageContent(message);
    
    // 检测错误信息
    if (this.containsError(content)) {
      score += 25;
      this.markAsImportant(messageIndex, Priority.HIGH, 'Contains error information');
    }

    // 检测任务目标
    if (this.containsTaskGoal(content)) {
      score += 30;
      this.markAsImportant(messageIndex, Priority.CRITICAL, 'Contains task goal');
    }

    // 检测重要文件操作
    if (this.containsImportantFileOperation(content)) {
      score += 15;
    }

    // 检测决策点
    if (this.containsDecisionPoint(content)) {
      score += 10;
    }

    // 3. 角色因素：用户消息通常更重要
    if (message.role === 'user') {
      score += 5;
    }

    // 4. 长度因素：过长的消息可能包含重要信息
    const length = content.length;
    if (length > 2000) {
      score += 5;
    }

    // 转换为优先级枚举
    if (score >= 90) return Priority.CRITICAL;
    if (score >= 70) return Priority.HIGH;
    if (score >= 40) return Priority.NORMAL;
    if (score >= 20) return Priority.LOW;
    return Priority.MINIMAL;
  }

  /**
   * 获取消息内容
   */
  private getMessageContent(message: Anthropic.MessageParam): string {
    if (Array.isArray(message.content)) {
      return message.content
        .filter(block => block.type === 'text')
        .map(block => (block as any).text)
        .join(' ');
    }
    return message.content || '';
  }

  /**
   * 检测是否包含错误信息
   */
  private containsError(content: string): boolean {
    const errorPatterns = [
      /error/i,
      /exception/i,
      /failed/i,
      /failure/i,
      /❌/,
      /⚠️/,
      /critical/i,
    ];
    return errorPatterns.some(pattern => pattern.test(content));
  }

  /**
   * 检测是否包含任务目标
   */
  private containsTaskGoal(content: string): boolean {
    const goalPatterns = [
      /task.*:/i,
      /goal.*:/i,
      /objective.*:/i,
      /requirement.*:/i,
      /需要.*:/,
      /目标.*:/,
    ];
    return goalPatterns.some(pattern => pattern.test(content));
  }

  /**
   * 检测是否包含重要文件操作
   */
  private containsImportantFileOperation(content: string): boolean {
    const filePatterns = [
      /write.*file/i,
      /create.*file/i,
      /delete.*file/i,
      /modify.*file/i,
      /写入.*文件/,
      /创建.*文件/,
    ];
    return filePatterns.some(pattern => pattern.test(content));
  }

  /**
   * 检测是否包含决策点
   */
  private containsDecisionPoint(content: string): boolean {
    const decisionPatterns = [
      /should.*\?/i,
      /would you like/i,
      /do you want/i,
      /choose/i,
      /decision/i,
      /是否/,
      /选择/,
    ];
    return decisionPatterns.some(pattern => pattern.test(content));
  }

  /**
   * 获取受保护的消息索引
   * @returns 受保护的消息索引数组
   */
  getProtectedMessages(): number[] {
    return Array.from(this.protectedIndices).sort((a, b) => a - b);
  }

  /**
   * 检查消息是否应该被保护
   * @param messageIndex 消息索引
   * @returns 是否应该保护
   */
  shouldProtect(messageIndex: number): boolean {
    return this.protectedIndices.has(messageIndex);
  }

  /**
   * 手动保护消息
   * @param messageIndex 消息索引
   */
  protectMessage(messageIndex: number): void {
    this.protectedIndices.add(messageIndex);
  }

  /**
   * 取消保护消息
   * @param messageIndex 消息索引
   */
  unprotectMessage(messageIndex: number): void {
    this.protectedIndices.delete(messageIndex);
  }

  /**
   * 生成智能截断建议
   * @param messages 消息数组
   * @param targetRemoval 目标删除数量
   * @returns 截断建议
   */
  generateTruncationSuggestion(
    messages: Anthropic.MessageParam[],
    targetRemoval: number
  ): TruncationSuggestion {
    // 计算所有消息的优先级
    const messagePriorities = messages.map((msg, index) => ({
      index,
      priority: this.calculatePriority(msg, index, messages.length),
      isProtected: this.shouldProtect(index),
    }));

    // 排序：优先删除低优先级且未保护的消息
    const candidates = messagePriorities
      .filter(m => !m.isProtected && m.index >= 2) // 保留前两条消息
      .sort((a, b) => a.priority - b.priority);

    // 选择要删除的消息
    let messagesToRemove = Math.min(targetRemoval, candidates.length);
    const toRemove = candidates.slice(0, messagesToRemove);

    if (toRemove.length === 0) {
      return {
        startIndex: 2,
        endIndex: 2,
        messagesToRemove: 0,
        estimatedSavings: 0,
        protectedMessages: this.getProtectedMessages(),
      };
    }

    // 计算连续范围
    const indices = toRemove.map(m => m.index).sort((a, b) => a - b);
    const startIndex = indices[0];
    const endIndex = indices[indices.length - 1];

    // 估算节省的字符数
    let estimatedSavings = 0;
    for (let i = startIndex; i <= endIndex; i++) {
      const content = this.getMessageContent(messages[i]);
      estimatedSavings += content.length;
    }

    return {
      startIndex,
      endIndex,
      messagesToRemove: endIndex - startIndex + 1,
      estimatedSavings,
      protectedMessages: this.getProtectedMessages(),
    };
  }

  /**
   * 获取优先级统计
   * @returns 优先级分布统计
   */
  getPriorityStats(): Record<string, number> {
    const stats: Record<string, number> = {
      critical: 0,
      high: 0,
      normal: 0,
      low: 0,
      minimal: 0,
    };

    for (const priority of this.priorities.values()) {
      if (priority.priority >= Priority.CRITICAL) stats.critical++;
      else if (priority.priority >= Priority.HIGH) stats.high++;
      else if (priority.priority >= Priority.NORMAL) stats.normal++;
      else if (priority.priority >= Priority.LOW) stats.low++;
      else stats.minimal++;
    }

    return stats;
  }

  /**
   * 清除所有优先级设置
   */
  clear(): void {
    this.priorities.clear();
    this.protectedIndices.clear();
  }

  /**
   * 打印优先级报告
   */
  printReport(): void {
    const stats = this.getPriorityStats();
    const protectedMsgs = this.getProtectedMessages();

    console.log('\n📊 上下文优先级报告');
    console.log('='.repeat(50));
    console.log(`关键消息: ${stats.critical}`);
    console.log(`高优先级: ${stats.high}`);
    console.log(`普通优先级: ${stats.normal}`);
    console.log(`低优先级: ${stats.low}`);
    console.log(`最低优先级: ${stats.minimal}`);
    console.log(`受保护消息: ${protectedMsgs.length}`);
    
    if (protectedMsgs.length > 0) {
      console.log(`\n🛡️  受保护的消息索引: ${protectedMsgs.join(', ')}`);
    }
    
    console.log('='.repeat(50));
  }
}

/**
 * 创建优先级管理器实例
 * @returns ContextPriorityManager 实例
 */
export function createPriorityManager(): ContextPriorityManager {
  return new ContextPriorityManager();
}
