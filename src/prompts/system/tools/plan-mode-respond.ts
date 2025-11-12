/**
 * 🔧 计划模式响应工具定义
 * 来源: 提示词/系统提示词/工具定义（19个工具）/计划模式响应工具定义.ts
 * 
 * 作用：在 PLAN MODE 下与用户交流
 * 
 * 用途：
 * - 讨论任务规划
 * - 呈现详细计划
 * - 获取用户对计划的反馈
 * 
 * 特点：仅在 PLAN MODE 可用
 * 
 * CLI 适配：100% 保留核心功能
 */

import { ModelFamily, ClineDefaultTool, type ClineToolSpec } from './types';

const id = ClineDefaultTool.PLAN_MODE_RESPOND;

const generic: ClineToolSpec = {
  variant: ModelFamily.GENERIC,
  id,
  name: 'plan_mode_respond',
  description: `响应用户的询问，以便为用户的任务规划解决方案。此工具应仅在您已经探索了相关文件并准备好提出具体计划时使用。不要使用此工具来宣布您将要读取哪些文件 - 只需先读取它们。此工具仅在计划模式下可用。environment_details 将指定当前模式；如果不是 PLAN_MODE，则不应使用此工具。
但是，如果在撰写响应时您意识到在提供完整计划之前实际上需要进行更多探索，则可以添加可选的 needs_more_exploration 参数来指示这一点。这允许您承认应该先进行更多探索，并表示您的下一条消息将使用探索工具。`,
  parameters: [
    {
      name: 'response',
      required: true,
      instruction: `要提供给用户的响应。不要在此参数中尝试使用工具，这只是一个聊天响应。（您必须使用 response 参数，不要只是将响应文本直接放在 <plan_mode_respond> 标签中。）`,
      usage: '您的响应',
    },
    {
      name: 'needs_more_exploration',
      required: false,
      instruction:
        '如果在制定响应时发现需要使用工具进行更多探索（例如读取文件），请设置为 true。（请记住，您可以在计划模式下使用 read_file 等工具探索项目，而无需用户切换到行动模式。）如果未指定，则默认为 false。',
      usage: 'true 或 false（可选，但如果在 <response> 中需要读取文件或使用其他探索工具，则必须设置为 true）',
    },
    {
      name: 'task_progress',
      required: false,
      instruction:
        ' 显示此工具使用完成后任务进度的检查清单。（有关更多详细信息，请参阅"更新任务进度"部分）',
      usage: '检查清单（如果您向用户提出了具体的步骤或要求，可以选择包含概述这些步骤的待办事项列表。）',
    },
  ],
};

export const plan_mode_respond_variants = [generic];