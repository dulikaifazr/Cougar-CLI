/**
 * 🔧 列出文件工具定义
 * 来源: 提示词/系统提示词/工具定义（19个工具）/列出文件工具定义.ts
 * 
 * 作用：列出目录中的文件和子目录
 * 
 * 用途：
 * - 探索项目结构
 * - 递归列出文件
 * - 支持多工作区
 * 
 * CLI 适配：100% 保留核心功能
 */

import { ModelFamily, ClineDefaultTool, TASK_PROGRESS_PARAMETER, type ClineToolSpec } from './types';

const id = ClineDefaultTool.LIST_FILES;

const generic: ClineToolSpec = {
  variant: ModelFamily.GENERIC,
  id,
  name: 'list_files',
  description:
    '请求列出指定目录中的文件和目录。如果 recursive 为 true，它将递归列出所有文件和目录。如果 recursive 为 false 或未提供，它将仅列出顶级内容。不要使用此工具来确认您可能创建的文件是否存在，因为用户会告诉您文件是否成功创建。',
  parameters: [
    {
      name: 'path',
      required: true,
      instruction:
        '要列出内容的目录路径（相对于当前工作目录 {{CWD}}）{{MULTI_ROOT_HINT}}',
      usage: '目录路径',
    },
    {
      name: 'recursive',
      required: false,
      instruction: '是否递归列出文件。使用 true 进行递归列表，false 或省略仅列出顶级内容。',
      usage: 'true 或 false（可选）',
    },
    TASK_PROGRESS_PARAMETER,
  ],
};

export const list_files_variants = [generic];