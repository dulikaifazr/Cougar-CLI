/**
 * 🔧 加载 MCP 文档工具定义
 * 来源: 提示词/系统提示词/工具定义（19个工具）/加载 MCP 文档工具定义.ts
 * 
 * 作用：加载 MCP 服务器的文档到上下文
 * 
 * 用途：了解 MCP 服务器的能力和使用方法
 * 
 * CLI 适配：100% 保留核心功能
 */

import { ModelFamily, ClineDefaultTool, type ClineToolSpec } from './types';

const id = ClineDefaultTool.LOAD_MCP_DOCUMENTATION;

const generic: ClineToolSpec = {
  id,
  variant: ModelFamily.GENERIC,
  name: 'load_mcp_documentation',
  description: `加载有关创建 MCP 服务器的文档。当用户请求创建或安装 MCP 服务器时应使用此工具（用户可能会要求您“添加工具”来执行某些功能，换句话说，创建一个提供工具和资源的 MCP 服务器，这些工具和资源可能连接到外部 API 等。您能够创建 MCP 服务器并将其添加到配置文件中，然后公开工具和资源供您使用 \`use_mcp_tool\` 和 \`access_mcp_resource\`）。该文档提供有关 MCP 服务器创建过程的详细信息，包括设置指导、最佳实践和示例。`,
  parameters: [],
};

export const load_mcp_documentation_variants = [generic];