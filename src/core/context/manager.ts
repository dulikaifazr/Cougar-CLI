/**
 * 🔄 80% 复用自原系统
 * 来源: 上下文/上下文管理核心/上下文管理器.ts
 * 
 * 核心作用： 管理对话历史的截断、优化和重构，确保不超过上下文限制
 * 
 * 主要改动：
 * - 移除 VSCode API 依赖
 * - 改用 Node.js fs.promises 进行文件存储
 * - 简化 API Handler 集成
 */
import { ApiHandler } from '../../api/handler';
import { getContextWindowInfo } from './window-utils';
import {
  EditType,
  MessageContent,
  MessageMetadata,
  ContextUpdate,
  SerializedContextHistory,
  MessageParam,
} from './types';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileExists } from '../../utils/fs';
import { formatResponse } from '../../prompts/runtime';

export class ContextManager {
  // 从 apiMessages 外部索引到内部消息索引的映射，到实际更改的列表，按时间戳排序
  private contextHistoryUpdates: Map<number, [number, Map<number, ContextUpdate[]>]>;

  constructor() {
    this.contextHistoryUpdates = new Map();
  }

  /**
   * 🔄 从原系统复用：从磁盘加载 contextHistoryUpdates
   */
  async loadContextHistory(sessionId: string): Promise<void> {
    const filePath = path.join(
      os.homedir(),
      '.cline',
      'sessions',
      sessionId,
      'context-updates.json'
    );

    if (await fileExists(filePath)) {
      try {
        const data = await fs.readFile(filePath, 'utf8');
        const serializedUpdates = JSON.parse(data) as SerializedContextHistory;

        this.contextHistoryUpdates = new Map(
          serializedUpdates.map(([messageIndex, [numberValue, innerMapArray]]) => [
            messageIndex,
            [numberValue, new Map(innerMapArray)],
          ])
        );
      } catch (error) {
        console.error('Failed to load context history:', error);
      }
    }
  }

  /**
   * 🔄 从原系统复用：将上下文历史更新保存到磁盘
   */
  async saveContextHistory(sessionId: string): Promise<void> {
    try {
      const filePath = path.join(
        os.homedir(),
        '.cline',
        'sessions',
        sessionId,
        'context-updates.json'
      );

      const serializedUpdates: SerializedContextHistory = Array.from(
        this.contextHistoryUpdates.entries()
      ).map(([messageIndex, [numberValue, innerMap]]) => [
        messageIndex,
        [numberValue, Array.from(innerMap.entries())],
      ]);

      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(serializedUpdates, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save context history:', error);
    }
  }

  /**
   * 🔄 100% 复用：确定是否应该压缩上下文窗口
   */
  shouldCompactContextWindow(
    totalTokens: number,
    api: ApiHandler,
    thresholdPercentage?: number
  ): boolean {
    const { contextWindow, maxAllowedSize } = getContextWindowInfo(api);
    const roundedThreshold = thresholdPercentage
      ? Math.floor(contextWindow * thresholdPercentage)
      : maxAllowedSize;
    const thresholdTokens = Math.min(roundedThreshold, maxAllowedSize);
    return totalTokens >= thresholdTokens;
  }

  /**
   * 🔄 100% 复用：获取截断范围
   */
  getNextTruncationRange(
    apiMessages: MessageParam[],
    currentDeletedRange: [number, number] | undefined,
    keep: 'none' | 'lastTwo' | 'half' | 'quarter'
  ): [number, number] {
    // 我们总是保留第一个用户-助手配对，并从那里截断偶数个消息
    const rangeStartIndex = 2; // 索引 0 和 1 被保留
    const startOfRest = currentDeletedRange ? currentDeletedRange[1] + 1 : 2;

    let messagesToRemove: number;
    if (keep === 'none') {
      messagesToRemove = Math.max(apiMessages.length - startOfRest, 0);
    } else if (keep === 'lastTwo') {
      messagesToRemove = Math.max(apiMessages.length - startOfRest - 2, 0);
    } else if (keep === 'half') {
      messagesToRemove = Math.floor((apiMessages.length - startOfRest) / 4) * 2;
    } else {
      messagesToRemove = Math.floor(((apiMessages.length - startOfRest) * 3) / 4 / 2) * 2;
    }

    let rangeEndIndex = startOfRest + messagesToRemove - 1;

    // 确保被删除的最后一个消息是助手消息
    if (apiMessages[rangeEndIndex] && apiMessages[rangeEndIndex].role !== 'assistant') {
      rangeEndIndex -= 1;
    }

    return [rangeStartIndex, rangeEndIndex];
  }

  /**
   * 🔄 100% 复用：对上下文中的消息应用所有必要的截断方法
   */
  getTruncatedMessages(
    messages: MessageParam[],
    deletedRange: [number, number] | undefined
  ): MessageParam[] {
    if (messages.length <= 1) {
      return messages;
    }

    const updatedMessages = this.applyContextHistoryUpdates(
      messages,
      deletedRange ? deletedRange[1] + 1 : 2
    );

    return updatedMessages;
  }

  /**
   * 🔄 100% 复用：应用 deletedRange 截断和其他更改
   */
  private applyContextHistoryUpdates(
    messages: MessageParam[],
    startFromIndex: number
  ): MessageParam[] {
    const firstChunk = messages.slice(0, 2);
    const secondChunk = messages.slice(startFromIndex);
    const messagesToUpdate = [...firstChunk, ...secondChunk];

    const originalIndices = [
      ...Array(2).keys(),
      ...Array(secondChunk.length)
        .fill(0)
        .map((_, i) => i + startFromIndex),
    ];

    for (let arrayIndex = 0; arrayIndex < messagesToUpdate.length; arrayIndex++) {
      const messageIndex = originalIndices[arrayIndex];
      const innerTuple = this.contextHistoryUpdates.get(messageIndex);

      if (!innerTuple) {
        continue;
      }

      messagesToUpdate[arrayIndex] = structuredClone(messagesToUpdate[arrayIndex]);
      const innerMap = innerTuple[1];

      for (const [blockIndex, changes] of innerMap) {
        const latestChange = changes[changes.length - 1];

        if (latestChange[1] === 'text') {
          const message = messagesToUpdate[arrayIndex];

          if (Array.isArray(message.content)) {
            const block = message.content[blockIndex];
            if (block && block.type === 'text') {
              block.text = latestChange[2][0];
            }
          }
        }
      }
    }

    return messagesToUpdate;
  }

  /**
   * 100% 复用：添加截断通知到第一条助手消息
   */
  addTruncationNotice(timestamp: number): void {
    if (!this.contextHistoryUpdates.has(1)) {
      const innerMap = new Map<number, ContextUpdate[]>();
      innerMap.set(0, [
        [
          timestamp,
          'text',
          [
            formatResponse.contextTruncationNotice(),
          ],
          [],
        ],
      ]);
      this.contextHistoryUpdates.set(1, [0, innerMap]);
    }
  }

  /**
   * 主入口点：获取最新的上下文消息和元数据
   * 这是官方实现的核心方法，整合了所有上下文优化逻辑
   */
  async getNewContextMessagesAndMetadata(
    apiConversationHistory: MessageParam[],
    api: ApiHandler,
    conversationHistoryDeletedRange: [number, number] | undefined,
    totalTokens: number,
    sessionId: string
  ): Promise<{
    conversationHistoryDeletedRange: [number, number] | undefined;
    updatedConversationHistoryDeletedRange: boolean;
    truncatedConversationHistory: MessageParam[];
  }> {
    let updatedConversationHistoryDeletedRange = false;
    const timestamp = Date.now();

    // 如果前一个 API 请求的总令牌使用接近上下文窗口，则截断对话历史以释放空间给新请求
    if (totalTokens > 0) {
      const { maxAllowedSize } = getContextWindowInfo(api);

      // 检查是否接近上下文窗口限制
      if (totalTokens >= maxAllowedSize) {
        // 由于用户可能在这两个模型之间切换，截断一半可能不够
        const keep = totalTokens / 2 > maxAllowedSize ? 'quarter' : 'half';

        // 先尝试智能优化：检查是否有重复的文件读取可以替换
        let [anyContextUpdates, uniqueFileReadIndices] = this.applyContextOptimizations(
          apiConversationHistory,
          conversationHistoryDeletedRange ? conversationHistoryDeletedRange[1] + 1 : 2,
          timestamp
        );

        let needToTruncate = true;
        if (anyContextUpdates) {
          // 计算优化节省的字符百分比
          const charactersSavedPercentage = this.calculateContextOptimizationMetrics(
            apiConversationHistory,
            conversationHistoryDeletedRange,
            uniqueFileReadIndices
          );
          // 如果节省了 30%+ 的字符，就不需要截断历史
          if (charactersSavedPercentage >= 0.3) {
            needToTruncate = false;
          }
        }

        // 如果智能优化不够，继续进行传统截断
        if (needToTruncate) {
          // 添加截断通知
          anyContextUpdates = this.applyStandardContextTruncationNoticeChange(timestamp) || anyContextUpdates;

          // 计算截断范围
          conversationHistoryDeletedRange = this.getNextTruncationRange(
            apiConversationHistory,
            conversationHistoryDeletedRange,
            keep
          );

          updatedConversationHistoryDeletedRange = true;
        }

        // 如果进行了任何上下文更改，保存到磁盘
        if (anyContextUpdates) {
          await this.saveContextHistory(sessionId);
        }
      }
    }

    // 获取最终的截断消息
    const truncatedConversationHistory = this.getTruncatedMessages(
      apiConversationHistory,
      conversationHistoryDeletedRange
    );

    return {
      conversationHistoryDeletedRange,
      updatedConversationHistoryDeletedRange,
      truncatedConversationHistory,
    };
  }

  /**
   * 应用上下文优化步骤
   * 返回是否进行了任何更改，以及更新的消息索引集合
   */
  private applyContextOptimizations(
    apiMessages: MessageParam[],
    startFromIndex: number,
    timestamp: number
  ): [boolean, Set<number>] {
    const [fileReadUpdatesBool, uniqueFileReadIndices] =
      this.findAndPotentiallySaveFileReadContextHistoryUpdates(apiMessages, startFromIndex, timestamp);

    const contextHistoryUpdated = fileReadUpdatesBool;
    return [contextHistoryUpdated, uniqueFileReadIndices];
  }

  /**
   * 添加标准截断通知（如果尚未存在）
   */
  private applyStandardContextTruncationNoticeChange(timestamp: number): boolean {
    if (!this.contextHistoryUpdates.has(1)) {
      // 第一个助手消息总是索引 1
      const innerMap = new Map<number, ContextUpdate[]>();
      innerMap.set(0, [
        [
          timestamp,
          'text',
          [formatResponse.contextTruncationNotice()],
          [],
        ],
      ]);
      this.contextHistoryUpdates.set(1, [0, innerMap]);
      return true;
    }
    return false;
  }

  /**
   * 查找并保存文件读取的上下文历史更新
   * 返回是否进行了任何更新和更新所在的索引
   */
  private findAndPotentiallySaveFileReadContextHistoryUpdates(
    apiMessages: MessageParam[],
    startFromIndex: number,
    timestamp: number
  ): [boolean, Set<number>] {
    const [fileReadIndices, messageFilePaths] = this.getPossibleDuplicateFileReads(
      apiMessages,
      startFromIndex
    );
    return this.applyFileReadContextHistoryUpdates(fileReadIndices, messageFilePaths, apiMessages, timestamp);
  }

  /**
   * 获取可能重复的文件读取
   * 返回文件路径到其位置的映射，以及消息索引到文件路径列表的映射
   */
  private getPossibleDuplicateFileReads(
    apiMessages: MessageParam[],
    startFromIndex: number
  ): [Map<string, [number, number, string, string][]>, Map<number, string[]>] {
    // fileReadIndices: { fileName => [outerIndex, EditType, searchText, replaceText] }
    // messageFilePaths: { outerIndex => [fileRead1, fileRead2, ..] }
    const fileReadIndices = new Map<string, [number, number, string, string][]>();
    const messageFilePaths = new Map<number, string[]>();

    for (let i = startFromIndex; i < apiMessages.length; i++) {
      let thisExistingFileReads: string[] = [];

      // 检查是否已经更新过这个消息
      if (this.contextHistoryUpdates.has(i)) {
        const innerTuple = this.contextHistoryUpdates.get(i);
        if (innerTuple) {
          const editType = innerTuple[0];
          if (editType === EditType.FILE_MENTION) {
            const innerMap = innerTuple[1];
            const blockIndex = 1;
            const blockUpdates = innerMap.get(blockIndex);

            if (blockUpdates && blockUpdates.length > 0) {
              // 检查是否所有文件都已被替换
              if (
                blockUpdates[blockUpdates.length - 1][3][0].length ===
                blockUpdates[blockUpdates.length - 1][3][1].length
              ) {
                continue; // 所有文件已替换，跳过
              }
              thisExistingFileReads = blockUpdates[blockUpdates.length - 1][3][0];
            }
          } else {
            continue; // 其他类型的更新，跳过
          }
        }
      }

      const message = apiMessages[i];
      if (message.role === 'user' && Array.isArray(message.content) && message.content.length > 0) {
        const firstBlock = message.content[0];
        if (firstBlock.type === 'text' && firstBlock.text) {
          const matchTup = this.parsePotentialToolCall(firstBlock.text);
          let foundNormalFileRead = false;

          if (matchTup) {
            if (matchTup[0] === 'read_file') {
              this.handleReadFileToolCall(i, matchTup[1], fileReadIndices);
              foundNormalFileRead = true;
            } else if (matchTup[0] === 'replace_in_file' || matchTup[0] === 'write_to_file') {
              if (message.content.length > 1) {
                const secondBlock = message.content[1];
                if (secondBlock.type === 'text' && secondBlock.text) {
                  this.handlePotentialFileChangeToolCalls(i, matchTup[1], secondBlock.text, fileReadIndices);
                  foundNormalFileRead = true;
                }
              }
            }
          }

          // 检查文件提及
          if (!foundNormalFileRead && message.content.length > 1) {
            const secondBlock = message.content[1];
            if (secondBlock.type === 'text' && secondBlock.text) {
              const [hasFileRead, filePaths] = this.handlePotentialFileMentionCalls(
                i,
                secondBlock.text,
                fileReadIndices,
                thisExistingFileReads
              );
              if (hasFileRead) {
                messageFilePaths.set(i, filePaths);
              }
            }
          }
        }
      }
    }

    return [fileReadIndices, messageFilePaths];
  }

  /**
   * 解析工具调用格式
   */
  private parsePotentialToolCall(text: string): [string, string] | null {
    const match = text.match(/^\[([^\s]+) for '([^']+)'\] Result:$/);
    if (!match) {
      return null;
    }
    return [match[1], match[2]];
  }

  /**
   * 处理 read_file 工具调用
   */
  private handleReadFileToolCall(
    i: number,
    filePath: string,
    fileReadIndices: Map<string, [number, number, string, string][]>
  ) {
    const indices = fileReadIndices.get(filePath) || [];
    indices.push([i, EditType.READ_FILE_TOOL, '', formatResponse.duplicateFileReadNotice()]);
    fileReadIndices.set(filePath, indices);
  }

  /**
   * 处理文件修改工具调用
   */
  private handlePotentialFileChangeToolCalls(
    i: number,
    filePath: string,
    secondBlockText: string,
    fileReadIndices: Map<string, [number, number, string, string][]>
  ) {
    const pattern = /(<final_file_content path="[^"]*">)[\s\S]*?(<\/final_file_content>)/;
    if (pattern.test(secondBlockText)) {
      const replacementText = secondBlockText.replace(
        pattern,
        `$1 ${formatResponse.duplicateFileReadNotice()} $2`
      );
      const indices = fileReadIndices.get(filePath) || [];
      indices.push([i, EditType.ALTER_FILE_TOOL, '', replacementText]);
      fileReadIndices.set(filePath, indices);
    }
  }

  /**
   * 处理文件内容提及
   */
  private handlePotentialFileMentionCalls(
    i: number,
    secondBlockText: string,
    fileReadIndices: Map<string, [number, number, string, string][]>,
    thisExistingFileReads: string[]
  ): [boolean, string[]] {
    const pattern = /<file_content path="([^"]*)"([\s\S]*?)<\/file_content>/g;
    let foundMatch = false;
    const filePaths: string[] = [];

    for (const match of secondBlockText.matchAll(pattern)) {
      foundMatch = true;
      const filePath = match[1];
      filePaths.push(filePath);

      if (!thisExistingFileReads.includes(filePath)) {
        const entireMatch = match[0];
        const replacementText = `<file_content path="${filePath}">${formatResponse.duplicateFileReadNotice()}</file_content>`;
        const indices = fileReadIndices.get(filePath) || [];
        indices.push([i, EditType.FILE_MENTION, entireMatch, replacementText]);
        fileReadIndices.set(filePath, indices);
      }
    }

    return [foundMatch, filePaths];
  }

  /**
   * 应用文件读取的上下文历史更新
   */
  private applyFileReadContextHistoryUpdates(
    fileReadIndices: Map<string, [number, number, string, string][]>,
    messageFilePaths: Map<number, string[]>,
    apiMessages: MessageParam[],
    timestamp: number
  ): [boolean, Set<number>] {
    let didUpdate = false;
    const updatedMessageIndices = new Set<number>();
    const fileMentionUpdates = new Map<number, [string, string[]]>();

    for (const [filePath, indices] of fileReadIndices.entries()) {
      // 只处理有多个相同文件读取的情况
      if (indices.length > 1) {
        // 处理除最后一个索引之外的所有索引
        for (let i = 0; i < indices.length - 1; i++) {
          const messageIndex = indices[i][0];
          const messageType = indices[i][1];
          const searchText = indices[i][2];
          const messageString = indices[i][3];

          didUpdate = true;
          updatedMessageIndices.add(messageIndex);

          if (messageType === EditType.FILE_MENTION) {
            // 文件提及需要特殊处理
            if (!fileMentionUpdates.has(messageIndex)) {
              let baseText = '';
              let prevFilesReplaced: string[] = [];

              const innerTuple = this.contextHistoryUpdates.get(messageIndex);
              if (innerTuple) {
                const blockUpdates = innerTuple[1].get(1);
                if (blockUpdates && blockUpdates.length > 0) {
                  baseText = blockUpdates[blockUpdates.length - 1][2][0];
                  prevFilesReplaced = blockUpdates[blockUpdates.length - 1][3][0];
                }
              }

              if (!baseText) {
                const messageContent = apiMessages[messageIndex]?.content;
                if (Array.isArray(messageContent) && messageContent.length > 1) {
                  const contentBlock = messageContent[1];
                  if (contentBlock.type === 'text' && contentBlock.text) {
                    baseText = contentBlock.text;
                  }
                }
              }

              fileMentionUpdates.set(messageIndex, [baseText, prevFilesReplaced]);
            }

            if (searchText) {
              const currentTuple = fileMentionUpdates.get(messageIndex) || ['', []];
              if (currentTuple[0]) {
                const updatedText = currentTuple[0].replace(searchText, messageString);
                const updatedFileReads = currentTuple[1];
                updatedFileReads.push(filePath);
                fileMentionUpdates.set(messageIndex, [updatedText, updatedFileReads]);
              }
            }
          } else {
            // 其他类型的文件读取
            const innerTuple = this.contextHistoryUpdates.get(messageIndex);
            let innerMap: Map<number, ContextUpdate[]>;

            if (!innerTuple) {
              innerMap = new Map<number, ContextUpdate[]>();
              this.contextHistoryUpdates.set(messageIndex, [messageType, innerMap]);
            } else {
              innerMap = innerTuple[1];
            }

            const blockIndex = 1;
            const updates = innerMap.get(blockIndex) || [];
            updates.push([timestamp, 'text', [messageString], []]);
            innerMap.set(blockIndex, updates);
          }
        }
      }
    }

    // 应用文件提及更新
    for (const [messageIndex, [updatedText, filePathsUpdated]] of fileMentionUpdates.entries()) {
      const innerTuple = this.contextHistoryUpdates.get(messageIndex);
      let innerMap: Map<number, ContextUpdate[]>;

      if (!innerTuple) {
        innerMap = new Map<number, ContextUpdate[]>();
        this.contextHistoryUpdates.set(messageIndex, [EditType.FILE_MENTION, innerMap]);
      } else {
        innerMap = innerTuple[1];
      }

      const blockIndex = 1;
      const updates = innerMap.get(blockIndex) || [];

      if (messageFilePaths.has(messageIndex)) {
        const allFileReads = messageFilePaths.get(messageIndex);
        if (allFileReads) {
          updates.push([timestamp, 'text', [updatedText], [filePathsUpdated, allFileReads]]);
          innerMap.set(blockIndex, updates);
        }
      }
    }

    return [didUpdate, updatedMessageIndices];
  }

  /**
   * 计算上下文优化的效果（节省的字符百分比）
   */
  private calculateContextOptimizationMetrics(
    apiMessages: MessageParam[],
    conversationHistoryDeletedRange: [number, number] | undefined,
    uniqueFileReadIndices: Set<number>
  ): number {
    // 计算第一个用户-助手消息对
    const firstChunkResult = this.countCharactersAndSavingsInRange(
      apiMessages,
      0,
      2,
      uniqueFileReadIndices
    );

    // 计算剩余消息
    const secondChunkResult = this.countCharactersAndSavingsInRange(
      apiMessages,
      conversationHistoryDeletedRange ? conversationHistoryDeletedRange[1] + 1 : 2,
      apiMessages.length,
      uniqueFileReadIndices
    );

    const totalCharacters = firstChunkResult.totalCharacters + secondChunkResult.totalCharacters;
    const totalCharactersSaved = firstChunkResult.charactersSaved + secondChunkResult.charactersSaved;

    const percentCharactersSaved = totalCharacters === 0 ? 0 : totalCharactersSaved / totalCharacters;
    return percentCharactersSaved;
  }

  /**
   * 计算指定范围内的字符数和节省的字符数
   */
  private countCharactersAndSavingsInRange(
    apiMessages: MessageParam[],
    startIndex: number,
    endIndex: number,
    uniqueFileReadIndices: Set<number>
  ): { totalCharacters: number; charactersSaved: number } {
    let totalCharCount = 0;
    let totalCharactersSaved = 0;

    for (let i = startIndex; i < endIndex; i++) {
      const message = apiMessages[i];
      if (!message.content) {
        continue;
      }

      const hasExistingAlterations = this.contextHistoryUpdates.has(i);
      const hasNewAlterations = uniqueFileReadIndices.has(i);

      if (Array.isArray(message.content)) {
        for (let blockIndex = 0; blockIndex < message.content.length; blockIndex++) {
          const block = message.content[blockIndex];

          if (block.type === 'text' && block.text) {
            if (hasExistingAlterations) {
              const innerTuple = this.contextHistoryUpdates.get(i);
              const updates = innerTuple?.[1].get(blockIndex);

              if (updates && updates.length > 0) {
                const latestUpdate = updates[updates.length - 1];

                if (hasNewAlterations) {
                  let originalTextLength: number;
                  if (updates.length > 1) {
                    originalTextLength = updates[updates.length - 2][2][0].length;
                  } else {
                    originalTextLength = block.text.length;
                  }

                  const newTextLength = latestUpdate[2][0].length;
                  totalCharactersSaved += originalTextLength - newTextLength;
                  totalCharCount += originalTextLength;
                } else {
                  totalCharCount += latestUpdate[2][0].length;
                }
              } else {
                totalCharCount += block.text.length;
              }
            } else {
              totalCharCount += block.text.length;
            }
          }
        }
      } else if (typeof message.content === 'string') {
        totalCharCount += message.content.length;
      }
    }

    return { totalCharacters: totalCharCount, charactersSaved: totalCharactersSaved };
  }
}