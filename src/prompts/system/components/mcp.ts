/**
 * 🔄 100% 复用自原系统
 * 来源: 提示词/系统提示词/提示词组件/MCP 服务器集成.ts
 * 
 * 核心作用：MCP 服务器集成说明
 * 
 * 已修复：与官方源码100%一致
 */

import type { SystemPromptContext } from '../types';

/**
 * 获取 MCP 章节
 */
export function getMcp(context: SystemPromptContext): string {
  const hasServers = context.mcpServers && context.mcpServers.length > 0;
  
  if (!hasServers || !context.mcpServers) {
    return '';
  }
  
  let serversInfo = '';
  for (const server of context.mcpServers) {
    serversInfo += `\n<server name="${server.name}">\n`;
    
    if (server.tools && server.tools.length > 0) {
      serversInfo += '  <tools>\n';
      for (const tool of server.tools) {
        serversInfo += `    <tool name="${tool.name}"${tool.description ? ` description="${tool.description}"` : ''} />\n`;
      }
      serversInfo += '  </tools>\n';
    }
    
    if (server.resources && server.resources.length > 0) {
      serversInfo += '  <resources>\n';
      for (const resource of server.resources) {
        serversInfo += `    <resource name="${resource.name}"${resource.description ? ` description="${resource.description}"` : ''} />\n`;
      }
      serversInfo += '  </resources>\n';
    }
    
    serversInfo += '</server>\n';
  }
  
  return `MCP SERVERS

You have access to the following MCP (Model Context Protocol) servers. Use the mcp_use_tool to call tools from these servers, and mcp_access_resource to access their resources.${serversInfo}

IMPORTANT: Always use the exact server and tool/resource names as shown above. MCP servers extend your capabilities - use them when appropriate for the task.`;
}
