/**
 * 🔄 100% 复用自原系统
 * 来源: 提示词/系统提示词/提示词组件/任务进度追踪（检查清单.ts
 * 
 * 核心作用：追踪任务进度
 * 
 * 已修复：与官方源码100%一致
 */

import type { SystemPromptContext } from '../types';

/**
 * 获取任务进度章节
 */
export function getTaskProgress(context: SystemPromptContext): string {
  return `TASK PROGRESS

As you work through tasks, you'll be informed on the work completed and what's remaining. This helps you understand context and progress:

- Completed work will be clearly marked
- Remaining tasks will be listed
- You can use this information to plan your next steps effectively
- Always consider previous work to avoid redundancy and build upon existing progress`;
}
