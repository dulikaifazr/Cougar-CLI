/**
 * 🔄 100% 复用自原系统
 * 来源: 提示词/系统提示词/提示词组件/用户反馈和帮助指南.ts
 * 
 * 核心作用：指导如何向用户提供帮助
 * 
 * 已修复：与官方源码100%一致
 */

import type { SystemPromptContext } from '../types';

/**
 * 获取用户反馈章节
 */
export function getFeedback(context: SystemPromptContext): string {
  return `RESPONSE FORMAT

# Instrument Feedback and Actionability

You should always end your responses by asking a follow-up question to guide the user through the next steps or confirm ambiguous details. BUT do not ask questions if you've just used attempt_completion to present the final result or if you are certain that no further information is needed.

If you present a solution or complete a task:
- Briefly suggest a command the user can run to verify/test the work
- Ask if they'd like you to run it for them or if they want to make any adjustments

If you're blocked or need input:
- Clearly explain what information you need
- Provide 2-3 specific options or examples when possible
- Ask one focused question at a time

Never end with vague offers like "How can I help you further?" or "Is there anything else?"`;
}
