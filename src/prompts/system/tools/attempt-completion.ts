/**
 * 🔧 尝试完成任务工具定义
 * 来源: 提示词/系统提示词/工具定义（19个工具）/尝试完成任务工具定义.ts
 * 
 * 作用：呈现任务完成结果
 * 
 * 参数：
 * - result：任务结果描述
 * - command（可选）：展示结果的 CLI 命令
 * 
 * 用途：标记任务完成并等待用户反馈
 * 
 * CLI 适配：100% 保留核心功能
 */

import { ModelFamily, ClineDefaultTool, type ClineToolSpec } from './types';

const id = ClineDefaultTool.ATTEMPT_COMPLETION;

const generic: ClineToolSpec = {
  variant: ModelFamily.GENERIC,
  id,
  name: 'attempt_completion',
  description: `在每次使用工具后，用户将回复该工具使用的结果，即成功或失败，以及任何失败原因。一旦您收到工具使用的结果并可以确认任务已完成，请使用此工具向用户展示您的工作结果。您可以选择提供 CLI 命令来展示您的工作结果。如果用户对结果不满意，可能会提供反馈，您可以使用这些反馈进行改进并重试。
重要提示：在您从用户那里确认任何先前的工具使用都成功之前，不能使用此工具。否则将导致代码损坏和系统故障。在使用此工具之前，您必须在 <thinking></thinking> 标签中问自己是否已从用户那里确认任何先前的工具使用都成功。如果没有，则不要使用此工具。`,
  parameters: [
    {
      name: 'result',
      required: true,
      instruction: '工具使用的结果。这应该是结果的清晰、具体的描述。',
      usage: '您的最终结果描述',
    },
    {
      name: 'command',
      required: false,
      instruction:
        '要执行的 CLI 命令，以向用户展示结果的实时演示。例如，使用 `open index.html` 显示创建的 HTML 网站，或使用 `open localhost:3000` 显示本地运行的开发服务器。但不要使用仅打印文本的命令，如 `echo` 或 `cat`。此命令应对当前操作系统有效。确保命令格式正确且不包含任何有害指令',
      usage: '您的命令（可选）',
    },
    // Different than the vanilla TASK_PROGRESS_PARAMETER
    {
      name: 'task_progress',
      required: false,
      instruction:
        '显示此工具使用完成后任务进度的检查清单。（有关更多详细信息，请参阅“更新任务进度”部分）',
      usage: '检查清单（如果您在之前的工具使用中使用了 task_progress，则为必需）',
    },
  ],
};

export const attempt_completion_variants = [generic];