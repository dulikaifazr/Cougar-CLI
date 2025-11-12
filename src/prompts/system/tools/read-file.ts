/**
 * 🔧 读取文件工具定义
 * 来源: 提示词/系统提示词/工具定义（19个工具）/读取文件工具定义.ts
 * 
 * 作用：定义读取文件内容的工具
 * 
 * 参数：
 * - path（必需）：文件路径（相对于 CWD）
 * - task_progress（可选）：任务进度检查清单
 * 
 * 用途：分析代码、查看文本文件、提取配置信息
 * 
 * CLI 适配：100% 保留核心功能
 */

import { ModelFamily, ClineDefaultTool, TASK_PROGRESS_PARAMETER, type ClineToolSpec } from './types';

const id = ClineDefaultTool.READ_FILE;

const generic: ClineToolSpec = {
  variant: ModelFamily.GENERIC,
  id,
  name: 'read_file',
  description:
    '请求读取指定路径的文件内容。当您需要检查您不知道其内容的现有文件的内容时使用此工具，例如分析代码、查看文本文件或从配置文件中提取信息。自动从 PDF 和 DOCX 文件中提取原始文本。可能不适合其他类型的二进制文件，因为它将原始内容作为字符串返回。不要使用此工具列出目录的内容。仅对文件使用此工具。',
  parameters: [
    {
      name: 'path',
      required: true,
      instruction: `要读取的文件路径（相对于当前工作目录 {{CWD}}）{{MULTI_ROOT_HINT}}`,
      usage: '文件路径',
    },
    TASK_PROGRESS_PARAMETER,
  ],
};

const nextGen = { ...generic, variant: ModelFamily.NEXT_GEN };
const gpt = { ...generic, variant: ModelFamily.GPT };
const gemini = { ...generic, variant: ModelFamily.GEMINI };

export const read_file_variants = [generic, nextGen, gpt, gemini];