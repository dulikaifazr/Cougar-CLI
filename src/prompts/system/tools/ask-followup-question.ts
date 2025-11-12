/**
 * 🔧 询问后续问题工具定义
 * 来源: 提示词/系统提示词/工具定义（19个工具）/询问后续问题工具定义.ts
 * 
 * 作用：向用户提出澄清性问题
 * 
 * 用途：
 * - 获取缺失的参数
 * - 确认设计决策
 * - 请求额外信息
 * 
 * CLI 适配：100% 保留核心功能
 */

import { ModelFamily, ClineDefaultTool, TASK_PROGRESS_PARAMETER, type ClineToolSpec } from './types';

const generic: ClineToolSpec = {
  variant: ModelFamily.GENERIC,
  id: ClineDefaultTool.ASK_FOLLOWUP_QUESTION,
  name: 'ask_followup_question',
  description:
    '向用户提问以收集完成任务所需的其他信息。当您遇到歧义、需要澄清或需要更多详细信息以有效进行时，应使用此工具。它通过启用与用户的直接通信来实现交互式问题解决。明智地使用此工具，以在收集必要信息和避免过度来回之间保持平衡。',
  parameters: [
    {
      name: 'question',
      required: true,
      instruction:
        '要向用户提出的问题。这应该是一个清晰、具体的问题，解决您需要的信息。',
      usage: '您的问题',
    },
    {
      name: 'options',
      required: false,
      instruction:
        '供用户选择的 2-5 个选项的数组。每个选项都应是描述可能答案的字符串。您可能并不总是需要提供选项，但在许多情况下它可能会有所帮助，因为它可以节省用户手动输入响应的时间。重要提示：永远不要包含切换到行动模式的选项，因为如果需要，这是您需要指导用户自己手动执行的操作。',
      usage: '选项数组（可选），例如 ["选项 1", "选项 2", "选项 3"]',
    },
    TASK_PROGRESS_PARAMETER,
  ],
};

const nextGen = { ...generic, variant: ModelFamily.NEXT_GEN };
const gpt = { ...generic, variant: ModelFamily.GPT };
const gemini = { ...generic, variant: ModelFamily.GEMINI };

export const ask_followup_question_variants = [generic, nextGen, gpt, gemini];