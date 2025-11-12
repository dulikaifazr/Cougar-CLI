/**
 * 网页抓取工具处理器
 * 适配自 task/工具处理器/17种工具处理器/网页抓取工具处理器.ts
 * 
 * 功能：
 * - 从网页获取内容
 * - 查找技术文档和 API 参考
 * - 获取最新的库版本信息
 * - 研究问题解决方案
 * 
 * CLI 适配：
 * - 使用 HTTP 请求代替 Puppeteer
 * - 简化为基本 HTML 抓取
 * - 支持基本的内容提取
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';
import { ToolUse } from '../../assistant-message';
import { TaskConfig, ToolResponse, IToolHandler } from '../types';
import { ToolValidator } from '../validator';
import * as formatter from '../utils/response-formatter';

/**
 * 网页抓取工具处理器类
 */
export class WebScrapeHandler implements IToolHandler {
  readonly name = 'web_fetch';
  
  constructor(private validator: ToolValidator) {}

  /**
   * 执行网页抓取工具
   * 
   * 工作流程：
   * 1. 验证必需参数（URL）
   * 2. 验证 URL 格式
   * 3. 处理批准流程
   * 4. 发起 HTTP 请求
   * 5. 提取并清理内容
   * 6. 返回格式化的内容
   */
  async execute(params: any, config: TaskConfig): Promise<ToolResponse> {
    const url: string | undefined = params.url;

    // 1. 验证必需参数
    const block: ToolUse = {
      type: 'tool_use',
      name: this.name as any,
      params: { url },
      partial: false,
    };

    const urlValidation = this.validator.assertRequiredParams(block, 'url');
    if (!urlValidation.ok) {
      config.taskState.consecutiveMistakeCount++;
      return formatter.missingParameter(this.name, 'url');
    }

    // 2. 验证 URL 格式
    try {
      new URL(url!);
    } catch {
      return formatter.toolError('Invalid URL format');
    }

    // 参数验证通过，重置错误计数器
    config.taskState.consecutiveMistakeCount = 0;

    // 3. 处理批准流程
    const shouldAutoApprove = config.callbacks.shouldAutoApproveTool?.(this.name) ?? false;
    
    if (!shouldAutoApprove) {
      // 请求用户批准
      await config.callbacks.say(
        'tool' as any,
        `请求抓取网页: ${url}`,
      );

      const result = await config.callbacks.ask(
        'tool' as any,
        `允许抓取网页 ${url} 吗？`,
      );

      if (result.response !== 'yesButtonClicked' as any) {
        return formatter.toolDenied();
      }
    }

    // 4. 发起 HTTP 请求
    try {
      await config.callbacks.say(
        'text' as any,
        `🌐 正在抓取: ${url}`,
      );

      const content = await this.fetchUrl(url!);

      // 5. 提取并清理内容
      const cleanedContent = this.extractTextContent(content);

      // 限制内容长度，避免过长
      const maxLength = 10000;
      const truncatedContent = cleanedContent.length > maxLength
        ? cleanedContent.substring(0, maxLength) + '\n\n... (内容过长，已截断)'
        : cleanedContent;

      // 6. 返回格式化的内容
      return `Fetched content from ${url}:\n\n${truncatedContent}`;
    } catch (error: any) {
      return formatter.toolError(`Failed to fetch web content: ${error.message}`);
    }
  }

  /**
   * 使用 HTTP/HTTPS 请求获取 URL 内容
   */
  private fetchUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 30000, // 10秒超时
      };

      const req = protocol.get(url, options, (res) => {
        // 处理重定向
        if (res.statusCode === 301 || res.statusCode === 302) {
          if (res.headers.location) {
            this.fetchUrl(res.headers.location)
              .then(resolve)
              .catch(reject);
            return;
          }
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }

        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve(data);
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  /**
   * 从 HTML 中提取文本内容
   * 简单的 HTML 清理，移除标签和脚本
   */
  private extractTextContent(html: string): string {
    // 移除 script 和 style 标签
    let text = html.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '');
    text = text.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '');
    
    // 移除 HTML 注释
    text = text.replace(/<!--[\s\S]*?-->/g, '');
    
    // 移除 HTML 标签
    text = text.replace(/<[^>]+>/g, ' ');
    
    // 解码 HTML 实体
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    
    // 清理多余空白
    text = text.replace(/\s+/g, ' ');
    text = text.replace(/\n\s*\n/g, '\n\n');
    
    return text.trim();
  }
}
