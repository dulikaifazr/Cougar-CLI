/**
 * Focus Chain 任务规划系统
 * 适配自官方 task/任务进度追踪器/index.ts
 * 
 * 核心功能：
 * - 自动生成和追踪 TODO 列表
 * - 智能提醒更新进度
 * - 进度百分比计算
 * - 完成度检查
 * 
 * CLI 适配：
 * - 移除文件监听（CLI 不需要实时监听）
 * - 简化为基于 API 请求的提醒机制
 * - 保留核心规划逻辑
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { TaskState } from './state';
import { TaskStateExtensions } from './state-extensions';

/**
 * Focus Chain 配置
 */
export interface FocusChainConfig {
  enabled: boolean;
  remindInterval: number; // 每隔多少次 API 请求提醒一次
}

/**
 * Focus Chain 统计信息
 */
export interface FocusChainStats {
  totalItems: number;
  completedItems: number;
  percentComplete: number;
}

/**
 * Focus Chain 管理器
 * 基于官方 FocusChainManager 适配
 */
export class FocusChainManager {
  private taskId: string;
  private taskState: TaskState;
  private config: FocusChainConfig;
  private hasTrackedFirstProgress = false;

  constructor(
    taskId: string,
    taskState: TaskState,
    config: FocusChainConfig = { enabled: true, remindInterval: 5 }
  ) {
    this.taskId = taskId;
    this.taskState = taskState;
    this.config = config;
  }

  /**
   * 解析 TODO 列表，统计完成情况
   * 基于官方 parseFocusChainListCounts (任务进度追踪器/工具.ts)
   */
  parseFocusChainStats(todoList: string): FocusChainStats {
    const lines = todoList.split('\n');
    let totalItems = 0;
    let completedItems = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      // 匹配 markdown checkbox: - [ ] 或 - [x]
      if (this.isFocusChainItem(trimmed)) {
        totalItems++;
        if (this.isCompletedFocusChainItem(trimmed)) {
          completedItems++;
        }
      }
    }

    const percentComplete = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    return { totalItems, completedItems, percentComplete };
  }

  /**
   * 检查是否是 Focus Chain 项
   */
  private isFocusChainItem(line: string): boolean {
    return /^-\s*\[([ xX])\]/.test(line);
  }

  /**
   * 检查是否是已完成项
   */
  private isCompletedFocusChainItem(line: string): boolean {
    return /^-\s*\[xX\]/.test(line);
  }

  /**
   * 生成 Focus Chain 指令（根据不同阶段）
   * 基于官方 generateFocusChainInstructions (任务进度追踪器/index.ts:149-308)
   */
  generateFocusChainInstructions(mode: 'plan' | 'act' = 'act'): string {
    const currentList = this.taskState.currentFocusChainChecklist;

    // 初始化指令（第一次创建列表）
    const listInstructionsInitial = `\n\n# TODO LIST CREATION REQUIRED - ACT MODE ACTIVATED\n\n**You've just switched from PLAN MODE to ACT MODE!**\n\n**IMMEDIATE ACTION REQUIRED:**\n1. Create a comprehensive todo list in your NEXT tool call\n2. Use the task_progress parameter to provide the list\n3. Format each item using markdown checklist syntax:\n   - [ ] For tasks to be done\n   - [x] For any tasks already completed\n\n**Your todo list should include:**\n   - All major implementation steps\n   - Testing and validation tasks\n   - Documentation updates if needed\n   - Final verification steps\n\n**Example format:**\n- [ ] Set up project structure\n- [ ] Implement core functionality\n- [ ] Add error handling\n- [ ] Write tests\n- [ ] Test implementation\n- [ ] Document changes\n\n**Remember:** Keeping the todo list updated helps track progress and ensures nothing is missed.`;

    // 推荐创建指令
    const listInstructionsRecommended = `\n\n1. Include the task_progress parameter in your next tool call\n2. Create a comprehensive checklist of all steps needed\n3. Use markdown format: - [ ] for incomplete, - [x] for complete\n\n**Benefits of creating a todo list now:**\n   - Clear roadmap for implementation\n   - Progress tracking throughout the task\n   - Nothing gets forgotten or missed\n   - Users can see, monitor, and edit the plan\n\n**Example structure:**\n\`\`\`\n- [ ] Analyze requirements\n- [ ] Set up necessary files\n- [ ] Implement main functionality\n- [ ] Handle edge cases\n- [ ] Test the implementation\n- [ ] Verify results\n\`\`\`\n\nKeeping the todo list updated helps track progress and ensures nothing is missed.`;

    // 更新提醒指令
    const listInstructionsReminder = `\n\n1. To create or update a todo list, include the task_progress parameter in the next tool call\n2. Review each item and update its status:\n   - Mark completed items with: - [x]\n   - Keep incomplete items as: - [ ]\n   - Add new items if you discover additional steps\n3. Modify the list as needed:\n   - Add any new steps you've discovered\n   - Reorder if the sequence has changed\n4. Ensure the list accurately reflects the current state\n\n**Remember:** Keeping the todo list updated helps track progress and ensures nothing is missed.`;

    // 如果已有列表，生成更新提醒
    if (currentList) {
      const stats = this.parseFocusChainStats(currentList);
      const { totalItems, completedItems, percentComplete } = stats;

      const introUpdateRequired = '# TODO LIST UPDATE REQUIRED - You MUST include the task_progress parameter in your NEXT tool call.';
      const listCurrentProgress = `**Current Progress: ${completedItems}/${totalItems} items completed (${percentComplete}%)**`;
      const userHasUpdatedList = '**CRITICAL INFORMATION:** The user has modified this todo list - review ALL changes carefully';

      // 如果用户更新了列表
      if (this.taskState.todoListWasUpdatedByUser) {
        return `\n\n${introUpdateRequired}\n${listCurrentProgress}\n\n${currentList}\n${userHasUpdatedList}\n${listInstructionsReminder}`;
      }

      // 根据进度生成不同的提醒消息
      let progressMessage = '';
      if (completedItems === 0 && totalItems > 0) {
        progressMessage = '\n\n**Note:** No items are marked complete yet. Remember to mark items as complete when finished.';
      } else if (percentComplete >= 25 && percentComplete < 50) {
        progressMessage = `\n\n**Note:** ${percentComplete}% of items are complete.`;
      } else if (percentComplete >= 50 && percentComplete < 75) {
        progressMessage = `\n\n**Note:** ${percentComplete}% of items are complete. Proceed with the task.`;
      } else if (percentComplete >= 75 && percentComplete < 100) {
        progressMessage = `\n\n**Note:** ${percentComplete}% of items are complete! Focus on finishing the remaining items.`;
      } else if (completedItems === totalItems && totalItems > 0) {
        progressMessage = `\n\n**🎉 EXCELLENT! All ${totalItems} items have been completed!**\n\n**Completed Items:**\n${currentList}\n\n**Next Steps:**\n- If the task is fully complete and meets all requirements, use attempt_completion\n- If you've discovered additional work that wasn't in the original scope, create a new task_progress list\n- If there are related tasks or follow-up items, you can suggest them in a new checklist\n\n**Remember:** Only use attempt_completion if you're confident the task is truly finished.`;
      }

      return `\n\n${introUpdateRequired}\n${listCurrentProgress}\n${currentList}\n${listInstructionsReminder}${progressMessage}`;
    }

    // 如果刚从计划模式切换
    if (TaskStateExtensions.justSwitchedFromPlanMode(this.taskState)) {
      return listInstructionsInitial;
    }

    // 计划模式：可选
    if (mode === 'plan') {
      return `\n\n# Todo List (Optional - Plan Mode)\n\nWhile in PLAN MODE, if you've outlined concrete steps or requirements for the user, you may include a preliminary todo list using the task_progress parameter.\n\nReminder on how to use the task_progress parameter:\n${listInstructionsReminder}`;
    }

    // 行动模式：根据 API 请求次数决定
    const isEarlyInTask = this.taskState.apiRequestCount < 10;
    if (isEarlyInTask) {
      return `\n\n# TODO LIST RECOMMENDED\n\nWhen starting a new task, it is recommended to create a todo list.\n${listInstructionsRecommended}`;
    } else {
      return `\n\n# TODO LIST\n\nYou've made ${this.taskState.apiRequestCount} API requests without a todo list. Consider creating one to track remaining work.\n${listInstructionsReminder}`;
    }
  }

  /**
   * 判断是否应该包含 Focus Chain 指令
   * 基于官方 shouldIncludeFocusChainInstructions (任务进度追踪器/index.ts:429-454)
   */
  shouldIncludeFocusChainInstructions(mode: 'plan' | 'act' = 'act'): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const apiRequestsSinceLastUpdate = this.taskState.apiRequestsSinceLastTodoUpdate || 0;
    const hasNoList = !this.taskState.currentFocusChainChecklist;
    const isFirstRequest = this.taskState.apiRequestCount === 1;
    const reachedReminderInterval = apiRequestsSinceLastUpdate >= this.config.remindInterval;
    const justSwitchedFromPlanMode = TaskStateExtensions.justSwitchedFromPlanMode(this.taskState);
    const userUpdatedList = this.taskState.todoListWasUpdatedByUser;
    const hasNoTodoListAfterMultipleRequests = !this.taskState.currentFocusChainChecklist && this.taskState.apiRequestCount >= 2;

    // 计划模式：总是包含
    if (mode === 'plan') {
      return true;
    }

    // 行动模式：多种触发条件
    return (
      reachedReminderInterval ||
      justSwitchedFromPlanMode ||
      userUpdatedList ||
      isFirstRequest ||
      hasNoTodoListAfterMultipleRequests
    );
  }

  /**
   * 更新 Focus Chain 列表（从工具响应中）
   * 基于官方 updateFCListFromToolResponse (任务进度追踪器/index.ts:365-421)
   */
  async updateFocusChainFromToolResponse(taskProgress: string | undefined): Promise<void> {
    if (!taskProgress || !taskProgress.trim()) {
      return;
    }

    // 重置计数器
    TaskStateExtensions.resetTodoUpdateCounter(this.taskState);

    const previousList = this.taskState.currentFocusChainChecklist;
    TaskStateExtensions.updateTodoList(this.taskState, taskProgress.trim());

    console.log('\n📋 TODO 列表已更新');

    // 解析统计信息
    const stats = this.parseFocusChainStats(taskProgress.trim());
    console.log(`   进度: ${stats.completedItems}/${stats.totalItems} (${stats.percentComplete}%)`);

    // 追踪首次创建
    if (!this.hasTrackedFirstProgress && stats.totalItems > 0) {
      this.hasTrackedFirstProgress = true;
      console.log('   ✓ 首次创建 TODO 列表');
    }

    // 保存到文件
    try {
      await this.saveFocusChainToDisk(taskProgress.trim());
    } catch (error) {
      console.warn('⚠️  保存 TODO 列表失败:', error);
    }
  }

  /**
   * 保存 Focus Chain 到磁盘
   * 基于官方 writeFocusChainToDisk (任务进度追踪器/index.ts:345-355)
   */
  private async saveFocusChainToDisk(todoList: string): Promise<void> {
    const taskDir = path.join(os.homedir(), '.cline', 'sessions', this.taskId);
    await fs.mkdir(taskDir, { recursive: true });

    const filePath = path.join(taskDir, 'focus-chain.md');
    const content = `# Task Progress - ${this.taskId}\n\n${todoList}\n\n---\n*Last updated: ${new Date().toISOString()}*`;

    await fs.writeFile(filePath, content, 'utf8');
  }

  /**
   * 从磁盘加载 Focus Chain
   * 基于官方 readFocusChainFromDisk (任务进度追踪器/index.ts:317-335)
   */
  async loadFocusChainFromDisk(): Promise<string | null> {
    try {
      const taskDir = path.join(os.homedir(), '.cline', 'sessions', this.taskId);
      const filePath = path.join(taskDir, 'focus-chain.md');
      const content = await fs.readFile(filePath, 'utf8');

      // 提取 TODO 列表部分（去掉标题和时间戳）
      const lines = content.split('\n');
      const todoLines: string[] = [];
      let inTodoSection = false;

      for (const line of lines) {
        if (line.startsWith('# Task Progress')) {
          inTodoSection = true;
          continue;
        }
        if (line.startsWith('---')) {
          break;
        }
        if (inTodoSection && line.trim()) {
          todoLines.push(line);
        }
      }

      return todoLines.join('\n').trim() || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 检查完成时的未完成项
   * 基于官方 checkIncompleteProgressOnCompletion (任务进度追踪器/index.ts:462-472)
   */
  checkIncompleteProgressOnCompletion(): void {
    if (!this.config.enabled || !this.taskState.currentFocusChainChecklist) {
      return;
    }

    const stats = this.parseFocusChainStats(this.taskState.currentFocusChainChecklist);
    const { totalItems, completedItems } = stats;

    if (totalItems > 0 && completedItems < totalItems) {
      const incompleteItems = totalItems - completedItems;
      console.warn(`\n⚠️  警告: 任务完成但仍有 ${incompleteItems} 个未完成项`);
      console.log('   建议检查是否所有工作都已完成');
    }
  }

  /**
   * 获取当前统计信息
   */
  getCurrentStats(): FocusChainStats | null {
    if (!this.taskState.currentFocusChainChecklist) {
      return null;
    }
    return this.parseFocusChainStats(this.taskState.currentFocusChainChecklist);
  }

  /**
   * 清理资源
   * 基于官方 dispose (任务进度追踪器/index.ts:480-490)
   */
  dispose(): void {
    // CLI 版本无需文件监听，暂无需清理
    console.log(`[FocusChain] Disposed for task ${this.taskId}`);
  }
}
