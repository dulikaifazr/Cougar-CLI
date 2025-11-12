/**
 * TaskState 扩展工具
 * 提供便捷的状态管理和查询方法
 * 
 * 基于官方源代码适配
 */

import { TaskState } from './state';

/**
 * Focus Chain 相关的状态辅助函数
 */
export class TaskStateExtensions {
  /**
   * 检查是否应该提醒更新 TODO 列表
   */
  static shouldRemindTodoUpdate(state: TaskState, reminderInterval: number = 5): boolean {
    return state.apiRequestsSinceLastTodoUpdate >= reminderInterval;
  }

  /**
   * 检查是否是首次 API 请求
   */
  static isFirstApiRequest(state: TaskState): boolean {
    return state.apiRequestCount === 1;
  }

  /**
   * 检查是否有 TODO 列表
   */
  static hasTodoList(state: TaskState): boolean {
    return state.currentFocusChainChecklist !== null && state.currentFocusChainChecklist.trim().length > 0;
  }

  /**
   * 增加 API 请求计数
   */
  static incrementApiRequestCount(state: TaskState): void {
    state.apiRequestCount++;
    state.apiRequestsSinceLastTodoUpdate++;
  }

  /**
   * 重置 TODO 更新计数器
   */
  static resetTodoUpdateCounter(state: TaskState): void {
    state.apiRequestsSinceLastTodoUpdate = 0;
  }

  /**
   * 标记用户更新了 TODO 列表
   */
  static markTodoUpdatedByUser(state: TaskState): void {
    state.todoListWasUpdatedByUser = true;
  }

  /**
   * 清除用户更新标志
   */
  static clearTodoUserUpdateFlag(state: TaskState): void {
    state.todoListWasUpdatedByUser = false;
  }

  /**
   * 更新 TODO 列表
   */
  static updateTodoList(state: TaskState, todoList: string): void {
    state.currentFocusChainChecklist = todoList;
    state.apiRequestsSinceLastTodoUpdate = 0;
  }

  /**
   * 检查是否应该创建初始检查点
   */
  static shouldCreateInitialCheckpoint(state: TaskState): boolean {
    return state.apiRequestCount === 0 && !state.isInitialized;
  }

  /**
   * 检查是否刚从计划模式切换
   */
  static justSwitchedFromPlanMode(state: TaskState): boolean {
    return state.didRespondToPlanAskBySwitchingMode;
  }

  /**
   * 重置计划模式切换标志
   */
  static clearPlanModeSwitchFlag(state: TaskState): void {
    state.didRespondToPlanAskBySwitchingMode = false;
  }

  /**
   * 检查是否有连续错误
   */
  static hasConsecutiveErrors(state: TaskState, threshold: number = 3): boolean {
    return state.consecutiveMistakeCount >= threshold;
  }

  /**
   * 重置错误计数
   */
  static resetErrorCount(state: TaskState): void {
    state.consecutiveMistakeCount = 0;
  }

  /**
   * 获取状态摘要（用于调试）
   */
  static getSummary(state: TaskState): string {
    return `TaskState Summary:
  - API Requests: ${state.apiRequestCount}
  - Has TODO List: ${this.hasTodoList(state)}
  - Requests Since TODO Update: ${state.apiRequestsSinceLastTodoUpdate}
  - Consecutive Errors: ${state.consecutiveMistakeCount}
  - Did Edit File: ${state.didEditFile}
  - Is Initialized: ${state.isInitialized}`;
  }
}

/**
 * 导出便捷函数
 */
export const stateHelpers = {
  shouldRemindTodoUpdate: TaskStateExtensions.shouldRemindTodoUpdate,
  isFirstApiRequest: TaskStateExtensions.isFirstApiRequest,
  hasTodoList: TaskStateExtensions.hasTodoList,
  incrementApiRequestCount: TaskStateExtensions.incrementApiRequestCount,
  resetTodoUpdateCounter: TaskStateExtensions.resetTodoUpdateCounter,
  updateTodoList: TaskStateExtensions.updateTodoList,
  getSummary: TaskStateExtensions.getSummary,
};
