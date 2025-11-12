/**
 * 🔧 搜索文件工具定义
 * 来源: 提示词/系统提示词/工具定义（19个工具）/搜索文件工具定义.ts
 * 
 * 作用：在文件中执行正则表达式搜索
 * 
 * 用途：
 * - 查找代码模式
 * - 定位特定实现
 * - 识别需要重构的区域
 * 
 * 特点：返回带上下文的搜索结果
 * 
 * CLI 适配：100% 保留核心功能
 */

import { ModelFamily, ClineDefaultTool, TASK_PROGRESS_PARAMETER, type ClineToolSpec } from './types';

const id = ClineDefaultTool.SEARCH_FILES;

const generic: ClineToolSpec = {
  variant: ModelFamily.GENERIC,
  id,
  name: 'search_files',
  description:
    '请求在指定目录中的文件中执行正则表达式搜索，提供上下文丰富的结果。此工具在多个文件中搜索模式或特定内容，显示每个匹配项及其包含的上下文。',
  parameters: [
    {
      name: 'path',
      required: true,
      instruction: `要搜索的目录路径（相对于当前工作目录 {{CWD}}）{{MULTI_ROOT_HINT}}。此目录将被递归搜索。`,
      usage: '目录路径',
    },
    {
      name: 'regex',
      required: true,
      instruction: '要搜索的正则表达式模式。使用 Rust 正则表达式语法。',
      usage: '正则表达式模式',
    },
    {
      name: 'file_pattern',
      required: false,
      instruction:
        "用于过滤文件的 Glob 模式（例如，'*.ts' 表示 TypeScript 文件）。如果未提供，将搜索所有文件 (*)。",
      usage: '文件模式（可选）',
    },
    TASK_PROGRESS_PARAMETER,
  ],
};

export const search_files_variants = [generic];