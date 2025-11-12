/**
 * 智能上下文压缩优化器
 * 适配自官方 上下文/上下文管理核心/上下文管理器.ts
 * 
 * 核心功能：
 * - 查找重复的文件读取
 * - 替换为简短引用
 * - 计算节省的字符数
 * - 决定是否需要截断
 * 
 * CLI 适配：
 * - 简化为基于消息内容的优化
 * - 移除 VSCode 特定逻辑
 * - 保留核心压缩算法
 */

import { Anthropic } from '@anthropic-ai/sdk';

/**
 * 文件读取信息
 */
export interface FileReadInfo {
  filePath: string;
  content: string;
  messageIndex: number;
  blockIndex: number;
}

/**
 * 优化结果
 */
export interface OptimizationResult {
  optimized: boolean;
  charactersSaved: number;
  totalCharacters: number;
  savingsPercentage: number;
  duplicateFiles: string[];
}

/**
 * 上下文优化器
 * 基于官方 ContextManager.applyContextOptimizations
 */
export class ContextOptimizer {
  /**
   * 应用上下文优化
   * 基于官方 applyContextOptimizations (上下文管理器.ts:491-506)
   */
  static applyOptimizations(
    messages: Anthropic.MessageParam[],
    startFromIndex: number = 2
  ): OptimizationResult {
    const fileReads = this.findDuplicateFileReads(messages, startFromIndex);
    
    if (fileReads.length === 0) {
      return {
        optimized: false,
        charactersSaved: 0,
        totalCharacters: this.calculateTotalCharacters(messages),
        savingsPercentage: 0,
        duplicateFiles: [],
      };
    }

    // 计算原始字符数
    const originalCharacters = this.calculateTotalCharacters(messages);

    // 替换重复内容
    const optimizedMessages = this.replaceWithReferences(messages, fileReads);
    
    // 计算优化后的字符数
    const optimizedCharacters = this.calculateTotalCharacters(optimizedMessages);
    const charactersSaved = originalCharacters - optimizedCharacters;
    const savingsPercentage = originalCharacters > 0 ? charactersSaved / originalCharacters : 0;

    // 更新原始消息数组
    messages.splice(0, messages.length, ...optimizedMessages);

    return {
      optimized: true,
      charactersSaved,
      totalCharacters: originalCharacters,
      savingsPercentage,
      duplicateFiles: fileReads.map(f => f.filePath),
    };
  }

  /**
   * 查找重复的文件读取
   * 基于官方 getPossibleDuplicateFileReads (上下文管理器.ts:591-650)
   */
  private static findDuplicateFileReads(
    messages: Anthropic.MessageParam[],
    startFromIndex: number
  ): FileReadInfo[] {
    const fileReads: FileReadInfo[] = [];
    const seenFiles = new Map<string, FileReadInfo>();

    for (let i = startFromIndex; i < messages.length; i++) {
      const message = messages[i];
      if (message.role !== 'user') continue;

      const content = Array.isArray(message.content) ? message.content : [{ type: 'text', text: message.content }];
      
      content.forEach((block, blockIndex) => {
        if (block.type === 'text') {
          // 检测文件读取模式：[read_file for 'path/to/file.ts']
          const fileReadPattern = /\[read_file for ['"]([^'"]+)['"]\]/g;
          let match;
          
          while ((match = fileReadPattern.exec(block.text)) !== null) {
            const filePath = match[1];
            
            if (seenFiles.has(filePath)) {
              // 发现重复文件
              fileReads.push({
                filePath,
                content: block.text,
                messageIndex: i,
                blockIndex,
              });
            } else {
              // 记录首次出现
              seenFiles.set(filePath, {
                filePath,
                content: block.text,
                messageIndex: i,
                blockIndex,
              });
            }
          }
        }
      });
    }

    return fileReads;
  }

  /**
   * 替换为简短引用
   * 基于官方 applyFileReadContextHistoryUpdates (上下文管理器.ts:652-750)
   */
  private static replaceWithReferences(
    messages: Anthropic.MessageParam[],
    fileReads: FileReadInfo[]
  ): Anthropic.MessageParam[] {
    const optimizedMessages = JSON.parse(JSON.stringify(messages)) as Anthropic.MessageParam[];

    for (const fileRead of fileReads) {
      const message = optimizedMessages[fileRead.messageIndex];
      if (message.role !== 'user') continue;

      const content = Array.isArray(message.content) ? message.content : [{ type: 'text', text: message.content }];
      const block = content[fileRead.blockIndex];

      if (block && block.type === 'text') {
        // 替换为简短引用
        const referenceText = `[File '${fileRead.filePath}' was read earlier in the conversation. Content omitted to save context space.]`;
        
        // 查找并替换文件内容
        const fileContentPattern = new RegExp(
          `\\[read_file for ['"]${this.escapeRegex(fileRead.filePath)}['"]\\][\\s\\S]*?(?=\\[read_file|$)`,
          'g'
        );
        
        block.text = block.text.replace(fileContentPattern, referenceText);
      }
    }

    return optimizedMessages;
  }

  /**
   * 计算总字符数
   * 基于官方 calculateContextOptimizationMetrics (上下文管理器.ts:752-800)
   */
  private static calculateTotalCharacters(messages: Anthropic.MessageParam[]): number {
    let total = 0;

    for (const message of messages) {
      if (Array.isArray(message.content)) {
        for (const block of message.content) {
          if (block.type === 'text') {
            total += block.text.length;
          }
        }
      } else if (typeof message.content === 'string') {
        total += message.content.length;
      }
    }

    return total;
  }

  /**
   * 转义正则表达式特殊字符
   */
  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * 检查是否应该跳过截断（基于优化结果）
   * 基于官方逻辑 (上下文管理器.ts:260-270)
   */
  static shouldSkipTruncation(result: OptimizationResult, threshold: number = 0.3): boolean {
    return result.optimized && result.savingsPercentage >= threshold;
  }

  /**
   * 生成优化报告
   */
  static generateReport(result: OptimizationResult): string {
    if (!result.optimized) {
      return '⚠️  未发现可优化的内容';
    }

    const percentStr = (result.savingsPercentage * 100).toFixed(1);
    return `📊 上下文优化报告:
  - 原始字符数: ${result.totalCharacters.toLocaleString()}
  - 节省字符数: ${result.charactersSaved.toLocaleString()}
  - 节省比例: ${percentStr}%
  - 重复文件: ${result.duplicateFiles.length} 个
  - 文件列表: ${result.duplicateFiles.slice(0, 3).join(', ')}${result.duplicateFiles.length > 3 ? '...' : ''}`;
  }
}

/**
 * 导出便捷函数
 */
export const optimizeContext = ContextOptimizer.applyOptimizations;
export const shouldSkipTruncation = ContextOptimizer.shouldSkipTruncation;
export const generateOptimizationReport = ContextOptimizer.generateReport;
