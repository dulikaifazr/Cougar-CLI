/**
 * 🔧 访问 MCP 资源工具定义
 * 来源: 提示词/系统提示词/工具定义（19个工具）/访问 MCP 资源工具定义.ts
 * 
 * 作用：访问 MCP 服务器提供的资源
 * 
 * 用途：
 * - 读取数据库内容
 * - 访问文件系统资源
 * - 获取 API 数据
 * 
 * 参数：
 * - server_name
 * - uri：资源 URI
 * 
 * CLI 适配：100% 保留核心功能
 */

import { ModelFamily, ClineDefaultTool, TASK_PROGRESS_PARAMETER, type ClineToolSpec } from './types';

const generic: ClineToolSpec = {
  variant: ModelFamily.GENERIC,
  id: ClineDefaultTool.ACCESS_MCP_RESOURCE,
  name: 'access_mcp_resource',
  description:
    '请求访问已连接的 MCP 服务器提供的资源。资源表示可用作上下文的数据源，例如文件、API 响应或系统信息。',
  parameters: [
    {
      name: 'server_name',
      required: true,
      instruction: '提供资源的 MCP 服务器名称',
      usage: '服务器名称',
    },
    {
      name: 'uri',
      required: true,
      instruction: '标识要访问的特定资源的 URI',
      usage: '资源 URI',
    },
    TASK_PROGRESS_PARAMETER,
  ],
};

const nextGen = { ...generic, variant: ModelFamily.NEXT_GEN };
const gpt = { ...generic, variant: ModelFamily.GPT };

export const access_mcp_resource_variants = [generic, nextGen, gpt];