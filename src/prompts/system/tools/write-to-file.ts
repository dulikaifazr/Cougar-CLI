/**
 * 🔧 写入文件工具定义
 * 来源: 提示词/系统提示词/工具定义（19个工具）/写入文件工具定义.ts
 * 
 * 作用：定义创建或覆写文件的工具
 * 
 * 参数：
 * - path（必需）：文件路径
 * - content（必需）：完整的文件内容
 * - task_progress（可选）：任务进度
 * 
 * 特点：自动创建所需的目录结构
 * 
 * CLI 适配：100% 保留核心功能
 */

import { ModelFamily, ClineDefaultTool, TASK_PROGRESS_PARAMETER, type ClineToolSpec } from './types';

const id = ClineDefaultTool.WRITE_FILE;

const generic: ClineToolSpec = {
  variant: ModelFamily.GENERIC,
  id,
  name: 'write_to_file',
  description:
    'Request to write content to a file at the specified path. If the file exists, it will be overwritten with the provided content. If the file doesn\'t exist, it will be created. This tool will automatically create any directories needed to write the file.',
  parameters: [
    {
      name: 'path',
      required: true,
      instruction: `The path of the file to write to (relative to the current working directory {{CWD}}){{MULTI_ROOT_HINT}}`,
      usage: 'File path here',
    },
    {
      name: 'content',
      required: true,
      instruction:
        'The content to write to the file. ALWAYS provide the COMPLETE intended content of the file, without any truncation or omissions. You MUST include ALL parts of the file, even if they haven\'t been modified.',
      usage: 'Your file content here',
    },
    TASK_PROGRESS_PARAMETER,
  ],
};

export const write_to_file_variants = [generic];