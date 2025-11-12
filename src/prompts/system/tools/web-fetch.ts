/**
 * 🔧 网页抓取工具定义
 * 来源: 提示词/系统提示词/工具定义（19个工具）/网页抓取工具定义.ts
 * 
 * 作用：获取网页内容或 API 响应
 * 
 * 用途：
 * - 查询文档
 * - 获取最新信息
 * - 调用 REST API
 * 
 * CLI 适配：100% 保留核心功能
 */

import { ModelFamily, ClineDefaultTool, TASK_PROGRESS_PARAMETER, type ClineToolSpec } from './types';

const id = ClineDefaultTool.WEB_FETCH;

const generic: ClineToolSpec = {
  variant: ModelFamily.GENERIC,
  id,
  name: 'web_fetch',
  description: `从指定的 URL 获取内容并处理为 markdown 格式
- 接受 URL 作为输入
- 获取 URL 内容，将 HTML 转换为 markdown
- 当您需要检索和分析网页内容时使用此工具
- 重要提示：如果有 MCP 提供的 web fetch 工具可用，请优先使用该工具，因为它可能限制更少。
- URL 必须是完整有效的 URL
- HTTP URL 将自动升级为 HTTPS
- 此工具是只读的，不会修改任何文件`,
  parameters: [
    {
      name: 'url',
      required: true,
      instruction: '要从中获取内容的 URL',
      usage: 'https://example.com/docs',
    },
    TASK_PROGRESS_PARAMETER,
  ],
};

const nextGen: ClineToolSpec = {
  variant: ModelFamily.NEXT_GEN,
  id: ClineDefaultTool.WEB_FETCH,
  name: 'web_fetch',
  description: `从指定的 URL 获取内容并处理为 markdown 格式
- 接受 URL 作为输入
- 获取 URL 内容，将 HTML 转换为 markdown
- 当您需要检索和分析网页内容时使用此工具
- 重要提示：如果有 MCP 提供的 web fetch 工具可用，请优先使用该工具，因为它可能限制更少。
- URL 必须是完整有效的 URL
- HTTP URL 将自动升级为 HTTPS
- 此工具是只读的，不会修改任何文件`,
  parameters: [
    {
      name: 'url',
      required: true,
      instruction: '要从中获取内容的 URL',
      usage: 'https://example.com/docs',
    },
    TASK_PROGRESS_PARAMETER,
  ],
};

const gpt = { ...nextGen, variant: ModelFamily.GPT };

export const web_fetch_variants = [generic, nextGen, gpt];