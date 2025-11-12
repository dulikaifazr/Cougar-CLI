/**
 * API Handler - OpenAI 兼容的 API 通信处理器
 * 增强版：支持完整的 Anthropic 消息格式、工具调用、图片等
 */
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { ApiStream } from './stream';
import { withRetry } from './retry';

/**
 * API Handler 配置选项
 */
export interface ApiHandlerOptions {
  apiKey: string
  baseUrl: string
  modelId: string
  temperature?: number
  maxTokens?: number
}

/**
 * 模型信息接口
 */
export interface ModelInfo {
  maxTokens: number
  contextWindow: number
  supportsImages: boolean
  supportsPromptCache: boolean
  supportsComputerUse?: boolean
  inputPrice?: number
  outputPrice?: number
  cacheWritesPrice?: number
  cacheReadsPrice?: number
}

/**
 * API 提供商信息
 */
export interface ApiProviderInfo {
  model: {
    id: string
    info: ModelInfo
  }
  providerId: string
}

export class ApiHandler {
  private client: OpenAI
  private options: ApiHandlerOptions

  constructor(options: ApiHandlerOptions) {
    this.options = options
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseUrl,
    })
  }

  /**
   * 创建聊天消息（流式）
   * 支持完整的 Anthropic 消息格式
   */
  @withRetry()
  async *createMessage(
    systemPrompt: string,
    messages: Anthropic.MessageParam[]
  ): ApiStream {
    // 转换 Anthropic 消息格式为 OpenAI 格式
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt }
    ];
    
    for (const msg of messages) {
      if (msg.role === 'user') {
        // 处理用户消息
        if (typeof msg.content === 'string') {
          openaiMessages.push({ role: 'user', content: msg.content });
        } else if (Array.isArray(msg.content)) {
          // 处理复杂内容（文本 + 图片 + 工具结果）
          const textParts: string[] = [];
          for (const block of msg.content) {
            if (block.type === 'text') {
              textParts.push(block.text);
            } else if ('type' in block && (block as any).type === 'image') {
              // 图片块 - 保留更多信息
              const imageBlock = block as any;
              if (imageBlock.source?.type === 'base64') {
                textParts.push(`[Image: ${imageBlock.source.media_type || 'image'}, size: ${imageBlock.source.data?.length || 0} bytes]`);
              } else {
                textParts.push('[Image content]');
              }
            } else if ('type' in block && (block as any).type === 'tool_result') {
              // 工具结果
              const toolResult = block as any;
              textParts.push(`[Tool Result: ${toolResult.tool_use_id}]`);
              if (toolResult.content) {
                if (typeof toolResult.content === 'string') {
                  textParts.push(toolResult.content);
                } else if (Array.isArray(toolResult.content)) {
                  for (const c of toolResult.content) {
                    if (c.type === 'text') {
                      textParts.push(c.text);
                    }
                  }
                }
              }
            }
          }
          openaiMessages.push({ role: 'user', content: textParts.join('\n') });
        }
      } else if (msg.role === 'assistant') {
        // 处理助手消息
        if (typeof msg.content === 'string') {
          openaiMessages.push({ role: 'assistant', content: msg.content });
        } else if (Array.isArray(msg.content)) {
          // 提取所有内容，保留工具调用信息
          const textParts: string[] = [];
          for (const block of msg.content) {
            if (block.type === 'text') {
              textParts.push(block.text);
            } else if ('type' in block && (block as any).type === 'tool_use') {
              // 工具调用 - 保留详细信息
              const toolBlock = block as any;
              const params = toolBlock.input ? JSON.stringify(toolBlock.input, null, 2) : '{}';
              textParts.push(`[Tool Call: ${toolBlock.name}]`);
              textParts.push(`Tool ID: ${toolBlock.id}`);
              textParts.push(`Parameters: ${params}`);
            }
          }
          openaiMessages.push({ role: 'assistant', content: textParts.join('\n') });
        }
      }
    }

    // 构建请求参数
    const requestParams: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
      model: this.options.modelId,
      messages: openaiMessages,
      temperature: this.options.temperature ?? 0.7,
      max_tokens: this.options.maxTokens ?? 8192,
      stream: true,
      stream_options: { include_usage: true },
    }

    // 如果模型支持 thinking，添加 thinking 参数
    if (this.options.modelId.includes('thinking')) {
      (requestParams as any).thinking = {
        type: 'enabled',
        budget_tokens: 2048  // 推理预算
      }
    }

    const stream = await this.client.chat.completions.create(requestParams)

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta

      // 文本内容
      if (delta?.content) {
        yield {
          type: 'text',
          text: delta.content,
        }
      }

      // 推理内容（如果模型支持）
      if (delta && 'reasoning_content' in delta && delta.reasoning_content) {
        yield {
          type: 'reasoning',
          reasoning: (delta.reasoning_content as string) || '',
        }
      }

      // Token 使用统计
      if (chunk.usage) {
        yield {
          type: 'usage',
          inputTokens: chunk.usage.prompt_tokens || 0,
          outputTokens: chunk.usage.completion_tokens || 0,
          cacheReadTokens: chunk.usage.prompt_tokens_details?.cached_tokens || 0,
        }
      }
    }
  }

  /**
   * 获取完整的模型信息
   * 包括上下文窗口、图片支持、缓存支持等
   */
  getModel(): ApiProviderInfo {
    const modelId = this.options.modelId.toLowerCase();
    let modelInfo: ModelInfo;

    // 根据模型 ID 推断模型能力
    if (modelId.includes('gpt-4')) {
      modelInfo = {
        maxTokens: 16_384,
        contextWindow: 128_000,
        supportsImages: modelId.includes('vision') || modelId.includes('gpt-4o'),
        supportsPromptCache: false,
        inputPrice: 0.01,
        outputPrice: 0.03,
      };
    } else if (modelId.includes('gpt-3.5')) {
      modelInfo = {
        maxTokens: 4_096,
        contextWindow: 16_000,
        supportsImages: false,
        supportsPromptCache: false,
        inputPrice: 0.0005,
        outputPrice: 0.0015,
      };
    } else if (modelId.includes('claude')) {
      // Claude 模型
      const isOpus = modelId.includes('opus');
      const isSonnet = modelId.includes('sonnet');
      const isHaiku = modelId.includes('haiku');
      
      modelInfo = {
        maxTokens: isOpus ? 4_096 : 8_192,
        contextWindow: 200_000,
        supportsImages: true,
        supportsPromptCache: true,
        supportsComputerUse: modelId.includes('3-5'),
        inputPrice: isOpus ? 0.015 : isSonnet ? 0.003 : 0.00025,
        outputPrice: isOpus ? 0.075 : isSonnet ? 0.015 : 0.00125,
        cacheWritesPrice: isOpus ? 0.01875 : isSonnet ? 0.00375 : 0.0003,
        cacheReadsPrice: isOpus ? 0.0015 : isSonnet ? 0.0003 : 0.000025,
      };
    } else if (modelId.includes('deepseek')) {
      modelInfo = {
        maxTokens: 8_192,
        contextWindow: 64_000,
        supportsImages: false,
        supportsPromptCache: false,
        inputPrice: 0.00014,
        outputPrice: 0.00028,
      };
    } else if (modelId.includes('gemini')) {
      modelInfo = {
        maxTokens: 8_192,
        contextWindow: modelId.includes('1.5') ? 1_000_000 : 32_000,
        supportsImages: true,
        supportsPromptCache: false,
        inputPrice: 0.00035,
        outputPrice: 0.00105,
      };
    } else {
      // 默认配置
      modelInfo = {
        maxTokens: 8_192,
        contextWindow: 128_000,
        supportsImages: false,
        supportsPromptCache: false,
        inputPrice: 0.001,
        outputPrice: 0.002,
      };
    }

    return {
      model: {
        id: this.options.modelId,
        info: modelInfo,
      },
      providerId: this.inferProviderId(modelId),
    };
  }

  /**
   * 根据模型 ID 推断提供商
   */
  private inferProviderId(modelId: string): string {
    if (modelId.includes('gpt')) return 'openai';
    if (modelId.includes('claude')) return 'anthropic';
    if (modelId.includes('deepseek')) return 'deepseek';
    if (modelId.includes('gemini')) return 'google';
    return 'openai'; // 默认
  }

  /**
   * 获取 API 配置
   */
  getConfiguration(): ApiHandlerOptions {
    return { ...this.options };
  }
}

