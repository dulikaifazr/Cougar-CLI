/**
 * 🔧 替换文件内容工具定义
 * 来源: 提示词/系统提示词/工具定义（19个工具）/替换文件内容工具定义.ts
 * 
 * 作用：定义使用 SEARCH/REPLACE 块精确修改文件的工具
 * 
 * 参数：
 * - path（必需）：文件路径
 * - diff（必需）：SEARCH/REPLACE 块
 * - task_progress（可选）
 * 
 * CLI 适配：100% 保留核心功能
 */

import { ModelFamily, ClineDefaultTool, TASK_PROGRESS_PARAMETER, type ClineToolSpec } from './types';

const id = ClineDefaultTool.REPLACE_IN_FILE;

const generic: ClineToolSpec = {
  variant: ModelFamily.GENERIC,
  id,
  name: 'replace_in_file',
  description:
    '请求使用 SEARCH/REPLACE 块替换现有文件中的内容部分，这些块定义对文件特定部分的精确更改。当您需要对文件的特定部分进行有针对性的更改时，应使用此工具。',
  parameters: [
    {
      name: 'path',
      required: true,
      instruction: `要修改的文件路径（相对于当前工作目录 {{CWD}}）`,
      usage: '文件路径',
    },
    {
      name: 'diff',
      required: true,
      instruction: `一个或多个遵循此确切格式的 SEARCH/REPLACE 块:
  \`\`\`
  <<<<<<< SEARCH
  [要查找的确切内容]
  =======
  [要替换的新内容]
  >>>>>>> REPLACE
  \`\`\`
  关键规则:
  1. SEARCH 内容必须与要查找的关联文件部分完全匹配:
     * 逐字符匹配，包括空格、缩进、行尾
     * 包括所有注释、文档字符串等
  2. SEARCH/REPLACE 块将仅替换第一个匹配项。
     * 如果需要进行多次更改，请包含多个唯一的 SEARCH/REPLACE 块。
     * 在每个 SEARCH 部分中仅包含足够的行以唯一匹配需要更改的每组行。
     * 使用多个 SEARCH/REPLACE 块时，按它们在文件中出现的顺序列出它们。
  3. 保持 SEARCH/REPLACE 块简洁:
     * 将大型 SEARCH/REPLACE 块拆分为一系列较小的块，每个块更改文件的一小部分。
     * 只包括更改的行，以及在需要唯一性时包含几行周围的行。
     * 不要在 SEARCH/REPLACE 块中包含大量未更改的行。
     * 每一行必须完整。永远不要中途截断行，因为这可能导致匹配失败。
  4. 特殊操作:
     * 要移动代码: 使用两个 SEARCH/REPLACE 块（一个从原始位置删除 + 一个在新位置插入）
     * 要删除代码: 使用空的 REPLACE 部分`,
      usage: '搜索和替换块',
    },
    TASK_PROGRESS_PARAMETER,
  ],
};

const nextGen = { ...generic, variant: ModelFamily.NEXT_GEN };
const gpt = { ...generic, variant: ModelFamily.GPT };
const gemini = { ...generic, variant: ModelFamily.GEMINI };

export const replace_in_file_variants = [generic, nextGen, gpt, gemini];