/**
 * 🔧 列出代码定义名称工具定义
 * 来源: 提示词/系统提示词/工具定义（19个工具）/列出代码定义名称工具定义.ts
 * 
 * 作用：获取源代码文件中的定义概览（类、函数、方法等）
 * 
 * 用途：快速了解代码结构，无需读取完整文件
 * 
 * CLI 适配：100% 保留核心功能
 */

import { ModelFamily, ClineDefaultTool, TASK_PROGRESS_PARAMETER, type ClineToolSpec } from './types';

const id = ClineDefaultTool.LIST_CODE_DEFINITION_NAMES;

const generic: ClineToolSpec = {
  variant: ModelFamily.GENERIC,
  id,
  name: 'list_code_definition_names',
  description:
    '请求列出指定目录顶层源代码文件中使用的定义名称（类、函数、方法等）。此工具提供对代码库结构和重要构造的洞察，封装了对理解整体架构至关重要的高级概念和关系。',
  parameters: [
    {
      name: 'path',
      required: true,
      instruction: `要列出顶级源代码定义的目录路径（相对于当前工作目录 {{CWD}}）{{MULTI_ROOT_HINT}}。`,
      usage: '目录路径',
    },
    TASK_PROGRESS_PARAMETER,
  ],
};

export const list_code_definition_names_variants = [generic];