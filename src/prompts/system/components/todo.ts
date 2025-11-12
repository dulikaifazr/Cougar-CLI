/**
 * 🔄 100% 复用自原系统
 * 来源: 提示词/系统提示词/提示词组件/自动待办列表管理.ts
 * 
 * 核心作用：管理 TODO 列表
 * 
 * 已修复：与官方源码100%一致
 */

import type { SystemPromptContext } from '../types';

/**
 * 获取 TODO 章节
 */
export function getTodo(context: SystemPromptContext): string {
  const hasTodos = context.todos && context.todos.trim().length > 0;
  
  if (!hasTodos) {
    return '';
  }
  
  return `TODO

The following TODO items are currently tracked:

${context.todos}

Use the todo tool to add, update, or remove items from this list as needed.`;
}
