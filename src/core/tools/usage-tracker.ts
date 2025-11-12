/**
 * 工具使用统计追踪器
 * 新功能：为 CLI 系统添加工具使用分析能力
 * 
 * 核心功能：
 * - 记录工具调用次数
 * - 追踪成功/失败率
 * - 计算平均执行时间
 * - 生成使用报告
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * 工具统计信息
 */
export interface ToolStats {
  toolName: string;
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  successRate: number;
  totalDuration: number;
  averageDuration: number;
  lastUsed: number;
}

/**
 * 工具执行记录
 */
interface ToolExecutionRecord {
  toolName: string;
  success: boolean;
  duration: number;
  timestamp: number;
}

/**
 * 使用报告
 */
export interface UsageReport {
  totalExecutions: number;
  totalTools: number;
  mostUsedTools: ToolStats[];
  leastReliableTools: ToolStats[];
  averageExecutionTime: number;
  generatedAt: number;
}

/**
 * 工具使用追踪器
 */
export class ToolUsageTracker {
  private stats: Map<string, ToolStats> = new Map();
  private sessionId: string;

  constructor(sessionId: string = 'default') {
    this.sessionId = sessionId;
  }

  /**
   * 记录工具执行
   */
  trackToolExecution(toolName: string, success: boolean, duration: number): void {
    let stats = this.stats.get(toolName);

    if (!stats) {
      stats = {
        toolName,
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        successRate: 0,
        totalDuration: 0,
        averageDuration: 0,
        lastUsed: Date.now(),
      };
      this.stats.set(toolName, stats);
    }

    // 更新统计
    stats.totalCalls++;
    if (success) {
      stats.successfulCalls++;
    } else {
      stats.failedCalls++;
    }
    stats.totalDuration += duration;
    stats.averageDuration = stats.totalDuration / stats.totalCalls;
    stats.successRate = stats.successfulCalls / stats.totalCalls;
    stats.lastUsed = Date.now();
  }

  /**
   * 获取工具统计
   */
  getToolStats(toolName: string): ToolStats | undefined {
    return this.stats.get(toolName);
  }

  /**
   * 获取所有统计
   */
  getAllStats(): ToolStats[] {
    return Array.from(this.stats.values());
  }

  /**
   * 获取最常用的工具
   */
  getMostUsedTools(limit: number = 5): ToolStats[] {
    return this.getAllStats()
      .sort((a, b) => b.totalCalls - a.totalCalls)
      .slice(0, limit);
  }

  /**
   * 获取最不可靠的工具
   */
  getLeastReliableTools(limit: number = 5): ToolStats[] {
    return this.getAllStats()
      .filter(s => s.totalCalls >= 3) // 至少调用 3 次
      .sort((a, b) => a.successRate - b.successRate)
      .slice(0, limit);
  }

  /**
   * 生成使用报告
   */
  generateUsageReport(): UsageReport {
    const allStats = this.getAllStats();
    const totalExecutions = allStats.reduce((sum, s) => sum + s.totalCalls, 0);
    const totalDuration = allStats.reduce((sum, s) => sum + s.totalDuration, 0);

    return {
      totalExecutions,
      totalTools: allStats.length,
      mostUsedTools: this.getMostUsedTools(5),
      leastReliableTools: this.getLeastReliableTools(3),
      averageExecutionTime: totalExecutions > 0 ? totalDuration / totalExecutions : 0,
      generatedAt: Date.now(),
    };
  }

  /**
   * 打印报告
   */
  printReport(): void {
    const report = this.generateUsageReport();

    console.log('\n📊 工具使用统计报告');
    console.log('='.repeat(50));
    console.log(`总执行次数: ${report.totalExecutions}`);
    console.log(`使用工具数: ${report.totalTools}`);
    console.log(`平均执行时间: ${report.averageExecutionTime.toFixed(2)}ms`);

    if (report.mostUsedTools.length > 0) {
      console.log('\n🏆 最常用工具:');
      report.mostUsedTools.forEach((tool, index) => {
        console.log(`  ${index + 1}. ${tool.toolName}: ${tool.totalCalls} 次 (成功率: ${(tool.successRate * 100).toFixed(1)}%)`);
      });
    }

    if (report.leastReliableTools.length > 0) {
      console.log('\n⚠️  最不可靠工具:');
      report.leastReliableTools.forEach((tool, index) => {
        console.log(`  ${index + 1}. ${tool.toolName}: 成功率 ${(tool.successRate * 100).toFixed(1)}% (${tool.totalCalls} 次调用)`);
      });
    }

    console.log('='.repeat(50));
  }

  /**
   * 保存统计到磁盘
   */
  async saveStats(): Promise<void> {
    try {
      const statsDir = path.join(os.homedir(), '.cline', 'stats');
      await fs.mkdir(statsDir, { recursive: true });

      const filePath = path.join(statsDir, `tool-usage-${this.sessionId}.json`);
      const data = {
        sessionId: this.sessionId,
        stats: Array.from(this.stats.entries()),
        savedAt: Date.now(),
      };

      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      console.warn('⚠️  保存工具统计失败:', error);
    }
  }

  /**
   * 从磁盘加载统计
   */
  async loadStats(): Promise<void> {
    try {
      const statsDir = path.join(os.homedir(), '.cline', 'stats');
      const filePath = path.join(statsDir, `tool-usage-${this.sessionId}.json`);

      const data = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(data);

      this.stats = new Map(parsed.stats);
    } catch (error) {
      // 文件不存在或读取失败，使用默认空统计
    }
  }

  /**
   * 清除统计
   */
  clearStats(): void {
    this.stats.clear();
  }
}

/**
 * 全局工具追踪器实例
 */
let globalTracker: ToolUsageTracker | null = null;

/**
 * 获取全局追踪器
 */
export function getGlobalTracker(sessionId?: string): ToolUsageTracker {
  if (!globalTracker) {
    globalTracker = new ToolUsageTracker(sessionId);
  }
  return globalTracker;
}

/**
 * 重置全局追踪器
 */
export function resetGlobalTracker(): void {
  globalTracker = null;
}
