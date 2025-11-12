/**
 * 🔧 使用 MCP 工具定义
 * 来源: 提示词/系统提示词/工具定义（19个工具）/使用 MCP 工具定义.ts
 * 
 * 作用：调用 MCP 服务器提供的工具
 * 
 * 参数：
 * - server_name：MCP 服务器名称
 * - tool_name：工具名称
 * - arguments：JSON 格式的参数
 * 
 * 示例：调用天气服务、GitHub API 等
 * 
 * CLI 适配：100% 保留核心功能
 */

import { ModelFamily, ClineDefaultTool, TASK_PROGRESS_PARAMETER, type ClineToolSpec } from './types';

const generic: ClineToolSpec = {
  variant: ModelFamily.GENERIC,
  id: ClineDefaultTool.USE_MCP_TOOL,
  name: 'use_mcp_tool',
  description:
    '请求使用已连接的 MCP 服务器提供的工具。每个 MCP 服务器可以提供具有不同功能的多个工具。工具具有定义的输入模式，指定必需和可选参数。',
  parameters: [
    {
      name: 'server_name',
      required: true,
      instruction: '提供该工具的 MCP 服务器名称',
      usage: '服务器名称',
    },
    {
      name: 'tool_name',
      required: true,
      instruction: '要执行的工具名称',
      usage: '工具名称',
    },
    {
      name: 'arguments',
      required: true,
      instruction: '包含工具输入参数的 JSON 对象，遵循工具的输入模式',
      usage: `
{
  "param1": "value1",
  "param2": "value2"
}
`,
    },
    TASK_PROGRESS_PARAMETER,
  ],
};

const nextGen = { ...generic, variant: ModelFamily.NEXT_GEN };
const gpt = { ...generic, variant: ModelFamily.GPT };
const gemini = { ...generic, variant: ModelFamily.GEMINI };

export const use_mcp_tool_variants = [generic, nextGen, gpt, gemini];