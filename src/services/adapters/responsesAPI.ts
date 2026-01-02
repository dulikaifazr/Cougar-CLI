import { OpenAIAdapter, StreamingEvent, normalizeTokens } from './openaiAdapter'
import { UnifiedRequestParams, UnifiedResponse, ReasoningStreamingContext } from '@cougar-types/modelCapabilities'
import { Tool, getToolDescription } from '@tool'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { processResponsesStream } from './responsesStreaming'

export class ResponsesAPIAdapter extends OpenAIAdapter {
  createRequest(params: UnifiedRequestParams): any {
    const { messages, systemPrompt, tools, maxTokens, reasoningEffort } = params

    // Build base request
    const request: any = {
      model: this.modelProfile.modelName,
      input: this.convertMessagesToInput(messages),
      instructions: this.buildInstructions(systemPrompt)
    }

    // Add token limit using model capabilities
    const maxTokensField = this.getMaxTokensParam()
    request[maxTokensField] = maxTokens

    // Add streaming support using model capabilities
    request.stream = params.stream !== false && this.capabilities.streaming.supported

    // Add temperature using model capabilities
    const temperature = this.getTemperature()
    if (temperature !== undefined) {
      request.temperature = temperature
    }

    // Add reasoning control using model capabilities
    const include: string[] = []
    if (this.capabilities.parameters.supportsReasoningEffort && (this.shouldIncludeReasoningEffort() || reasoningEffort)) {
      include.push('reasoning.encrypted_content')
      request.reasoning = {
        effort: reasoningEffort || this.modelProfile.reasoningEffort || 'medium'
      }
    }

    // Add verbosity control using model capabilities
    if (this.capabilities.parameters.supportsVerbosity && this.shouldIncludeVerbosity()) {
      // Determine default verbosity based on model name if not provided
      let defaultVerbosity: 'low' | 'medium' | 'high' = 'medium'
      if (params.verbosity) {
        defaultVerbosity = params.verbosity
      } else {
        const modelNameLower = this.modelProfile.modelName.toLowerCase()
        if (modelNameLower.includes('high')) {
          defaultVerbosity = 'high'
        } else if (modelNameLower.includes('low')) {
          defaultVerbosity = 'low'
        }
        // Default to 'medium' for all other cases
      }

      request.text = {
        verbosity: defaultVerbosity
      }
    }

    // Add tools
    if (tools && tools.length > 0) {
      request.tools = this.buildTools(tools)
    }

    // Add tool choice using model capabilities
    request.tool_choice = 'auto'

    // Add parallel tool calls flag using model capabilities
    if (this.capabilities.toolCalling.supportsParallelCalls) {
      request.parallel_tool_calls = true
    }

    // Add store flag
    request.store = false

    // Add state management
    if (params.previousResponseId && this.capabilities.stateManagement.supportsPreviousResponseId) {
      request.previous_response_id = params.previousResponseId
    }

    // Add include array for reasoning and other content
    if (include.length > 0) {
      request.include = include
    }

    return request
  }
  
  buildTools(tools: Tool[]): any[] {
    // Follow codex-cli.js format: flat structure, no nested 'function' object
    return tools.map(tool => {
      // Prefer pre-built JSON schema if available
      let parameters = tool.inputJSONSchema

      // Otherwise, check if inputSchema is already a JSON schema (not Zod)
      if (!parameters && tool.inputSchema) {
        // Type guard to check if it's a plain JSON schema object
        const isPlainObject = (obj: any): boolean => {
          return obj !== null && typeof obj === 'object' && !Array.isArray(obj)
        }

        if (isPlainObject(tool.inputSchema) && ('type' in tool.inputSchema || 'properties' in tool.inputSchema)) {
          // Already a JSON schema, use directly
          parameters = tool.inputSchema
        } else {
          // Try to convert Zod schema
          try {
            parameters = zodToJsonSchema(tool.inputSchema)
          } catch (error) {
            console.warn(`Failed to convert Zod schema for tool ${tool.name}:`, error)
            // Use minimal schema as fallback
            parameters = { type: 'object', properties: {} }
          }
        }
      }

      return {
        type: 'function',
        name: tool.name,
        description: getToolDescription(tool),
        parameters: (parameters as any) || { type: 'object', properties: {} }
      }
    })
  }
  
  // Override parseResponse to handle Response API directly without double conversion
  async parseResponse(response: any): Promise<UnifiedResponse> {
    // Check if this is a streaming response (has ReadableStream body)
    if (response?.body instanceof ReadableStream) {
      // Handle streaming directly - don't go through OpenAIAdapter conversion
      const { assistantMessage } = await processResponsesStream(
        this.parseStreamingResponse(response),
        Date.now(),
        response.id ?? `resp_${Date.now()}`
      )

      // LINUX WAY: ONE representation only - tool_use blocks in content
      // NO toolCalls array when we have tool_use blocks
      const hasToolUseBlocks = assistantMessage.message.content.some((block: any) => block.type === 'tool_use')

      return {
        id: assistantMessage.responseId,
        content: assistantMessage.message.content,
        toolCalls: hasToolUseBlocks ? [] : [],
        usage: this.normalizeUsageForAdapter(assistantMessage.message.usage),
        responseId: assistantMessage.responseId
      }
    }

    // Process non-streaming response - delegate to existing method
    return this.parseNonStreamingResponse(response)
  }

  // Implement abstract method from OpenAIAdapter
  protected parseNonStreamingResponse(response: any): UnifiedResponse {
    // Process basic text output
    let content = response.output_text || ''

    // Extract reasoning content from structured output
    let reasoningContent = ''
    if (response.output && Array.isArray(response.output)) {
      const messageItems = response.output.filter(item => item.type === 'message')
      if (messageItems.length > 0) {
        content = messageItems
          .map(item => {
            if (item.content && Array.isArray(item.content)) {
              return item.content
                .filter(c => c.type === 'text')
                .map(c => c.text)
                .join('\n')
            }
            return item.content || ''
          })
          .filter(Boolean)
          .join('\n\n')
      }

      // Extract reasoning content
      const reasoningItems = response.output.filter(item => item.type === 'reasoning')
      if (reasoningItems.length > 0) {
        reasoningContent = reasoningItems
          .map(item => item.content || '')
          .filter(Boolean)
          .join('\n\n')
      }
    }

    // Apply reasoning formatting
    if (reasoningContent) {
      const thinkBlock = `

${reasoningContent}

`
      content = thinkBlock + content
    }

    // Parse tool calls
    const toolCalls = this.parseToolCalls(response)

    // Build unified response
    // Convert content to array format for Anthropic compatibility
    const contentArray = content
      ? [{ type: 'text', text: content, citations: [] }]
      : [{ type: 'text', text: '', citations: [] }]

    const promptTokens = response.usage?.input_tokens || 0
    const completionTokens = response.usage?.output_tokens || 0
    const totalTokens = response.usage?.total_tokens ?? (promptTokens + completionTokens)

    return {
      id: response.id || `resp_${Date.now()}`,
      content: contentArray,  // Return as array (Anthropic format)
      toolCalls,
      usage: {
        promptTokens,
        completionTokens,
        reasoningTokens: response.usage?.output_tokens_details?.reasoning_tokens
      },
      responseId: response.id  // Save for state management
    }
  }

  // Implement abstract method from OpenAIAdapter - Responses API specific streaming logic
  protected async *processStreamingChunk(
    parsed: any,
    responseId: string,
    hasStarted: boolean,
    accumulatedContent: string,
    reasoningContext?: ReasoningStreamingContext
  ): AsyncGenerator<StreamingEvent> {
    // Handle reasoning summary part events
    if (parsed.type === 'response.reasoning_summary_part.added') {
      const partIndex = parsed.summary_index || 0

      // Initialize reasoning state if not already done
      if (!reasoningContext?.thinkingContent) {
        reasoningContext!.thinkingContent = ''
        reasoningContext!.currentPartIndex = -1
      }

      reasoningContext!.currentPartIndex = partIndex

      // If this is not the first part and we have content, add newline separator
      if (partIndex > 0 && reasoningContext!.thinkingContent) {
        reasoningContext!.thinkingContent += '\n\n'

        // Emit newline separator as thinking delta
        yield {
          type: 'text_delta',
          delta: '\n\n',
          responseId
        }
      }

      return
    }

    // Handle reasoning summary text delta
    if (parsed.type === 'response.reasoning_summary_text.delta') {
      const delta = parsed.delta || ''

      if (delta && reasoningContext) {
        // Accumulate thinking content
        reasoningContext.thinkingContent += delta

        // Stream thinking delta
        yield {
          type: 'text_delta',
          delta,
          responseId
        }
      }

      return
    }

    // Handle reasoning text delta (following codex-cli.js pattern)
    if (parsed.type === 'response.reasoning_text.delta') {
      const delta = parsed.delta || ''

      if (delta && reasoningContext) {
        // Accumulate thinking content
        reasoningContext.thinkingContent += delta

        // Stream thinking delta
        yield {
          type: 'text_delta',
          delta,
          responseId
        }
      }

      return
    }

    // Handle text content deltas (Responses API format)
    if (parsed.type === 'response.output_text.delta') {
      const delta = parsed.delta || ''
      if (delta) {
        const textEvents = this.handleTextDelta(delta, responseId, hasStarted)
        for (const event of textEvents) {
          yield event
        }
      }
    }

    // Handle tool calls (Responses API format)
    if (parsed.type === 'response.output_item.done') {
      const item = parsed.item || {}
      if (item.type === 'function_call') {
        const callId = item.call_id || item.id
        const name = item.name
        const args = item.arguments

        if (typeof callId === 'string' && typeof name === 'string' && typeof args === 'string') {
          yield {
            type: 'tool_request',
            tool: {
              id: callId,
              name: name,
              input: args
            }
          }
        }
      }
    }

    // Handle usage information - normalize to canonical structure
    if (parsed.usage) {
      const normalizedUsage = normalizeTokens(parsed.usage)

      // Add reasoning tokens if available in Responses API format
      if (parsed.usage.output_tokens_details?.reasoning_tokens) {
        normalizedUsage.reasoning = parsed.usage.output_tokens_details.reasoning_tokens
      }

      yield {
        type: 'usage',
        usage: normalizedUsage
      }
    }
  }

  protected updateStreamingState(
    parsed: any,
    accumulatedContent: string
  ): { content?: string; hasStarted?: boolean } {
    const state: { content?: string; hasStarted?: boolean } = {}

    // Check if we have content delta
    if (parsed.type === 'response.output_text.delta' && parsed.delta) {
      state.content = accumulatedContent + parsed.delta
      state.hasStarted = true
    }

    return state
  }

  // parseStreamingResponse and parseSSEChunk are now handled by the base OpenAIAdapter class

  // Implement abstract method for parsing streaming OpenAI responses
  protected async parseStreamingOpenAIResponse(response: any): Promise<{ assistantMessage: any; rawResponse: any }> {
    // Delegate to the processResponsesStream helper for consistency
    const { processResponsesStream } = await import('./responsesStreaming')

    return await processResponsesStream(
      this.parseStreamingResponse(response),
      Date.now(),
      response.id ?? `resp_${Date.now()}`
    )
  }

  // Implement abstract method for usage normalization
  protected normalizeUsageForAdapter(usage?: any) {
    // Call the base implementation with Responses API specific defaults
    const baseUsage = super.normalizeUsageForAdapter(usage)

    // Add any Responses API specific usage fields
    return {
      ...baseUsage,
      reasoningTokens: usage?.output_tokens_details?.reasoning_tokens ?? 0
    }
  }
  
  private convertMessagesToInput(messages: any[]): any[] {
    // Convert Chat Completions messages to Response API input format
    // Following reference implementation pattern
    const inputItems = []

    for (const message of messages) {
      const role = message.role

      if (role === 'tool') {
        // Handle tool call results - enhanced following codex-cli.js pattern
        const callId = message.tool_call_id || message.id
        if (typeof callId === 'string' && callId) {
          let content = message.content || ''
          if (Array.isArray(content)) {
            const texts = []
            for (const part of content) {
              if (typeof part === 'object' && part !== null) {
                const t = part.text || part.content
                if (typeof t === 'string' && t) {
                  texts.push(t)
                }
              }
            }
            content = texts.join('\n')
          }
          if (typeof content === 'string') {
            inputItems.push({
              type: 'function_call_output',
              call_id: callId,
              output: content
            })
          }
        }
        continue
      }

      if (role === 'assistant' && Array.isArray(message.tool_calls)) {
        // Handle assistant tool calls - enhanced following codex-cli.js pattern
        for (const tc of message.tool_calls) {
          if (typeof tc !== 'object' || tc === null) {
            continue
          }
          const tcType = tc.type || 'function'
          if (tcType !== 'function') {
            continue
          }
          const callId = tc.id || tc.call_id
          const fn = tc.function
          const name = typeof fn === 'object' && fn !== null ? fn.name : null
          const args = typeof fn === 'object' && fn !== null ? fn.arguments : null

          if (typeof callId === 'string' && typeof name === 'string' && typeof args === 'string') {
            inputItems.push({
              type: 'function_call',
              name: name,
              arguments: args,
              call_id: callId
            })
          }
        }
        continue
      }

      // Handle regular text content
      const content = message.content || ''
      const contentItems = []

      if (Array.isArray(content)) {
        for (const part of content) {
          if (typeof part !== 'object' || part === null) continue
          const ptype = part.type
          if (ptype === 'text') {
            const text = part.text || part.content || ''
            if (typeof text === 'string' && text) {
              const kind = role === 'assistant' ? 'output_text' : 'input_text'
              contentItems.push({ type: kind, text: text })
            }
          } else if (ptype === 'image_url') {
            const image = part.image_url
            const url = typeof image === 'object' && image !== null ? image.url : image
            if (typeof url === 'string' && url) {
              contentItems.push({ type: 'input_image', image_url: url })
            }
          }
        }
      } else if (typeof content === 'string' && content) {
        const kind = role === 'assistant' ? 'output_text' : 'input_text'
        contentItems.push({ type: kind, text: content })
      }

      if (contentItems.length) {
        const roleOut = role === 'assistant' ? 'assistant' : 'user'
        inputItems.push({ type: 'message', role: roleOut, content: contentItems })
      }
    }

    return inputItems
  }
  
  private buildInstructions(systemPrompt: string[]): string {
    // Join system prompts into instructions (following reference implementation)
    const systemContent = systemPrompt
      .filter(content => content.trim())
      .join('\n\n')

    return systemContent
  }
  
  private parseToolCalls(response: any): any[] {
    // Enhanced tool call parsing following codex-cli.js pattern
    if (!response.output || !Array.isArray(response.output)) {
      return []
    }

    const toolCalls = []

    for (const item of response.output) {
      if (item.type === 'function_call') {
        // Parse tool call with better structure
        const callId = item.call_id || item.id
        const name = item.name || ''
        const args = item.arguments || '{}'

        // Validate required fields
        if (typeof callId === 'string' && typeof name === 'string' && typeof args === 'string') {
          toolCalls.push({
            id: callId,
            type: 'function',
            function: {
              name: name,
              arguments: args
            }
          })
        }
      } else if (item.type === 'tool_call') {
        // Handle alternative tool_call type
        const callId = item.id || `tool_${Math.random().toString(36).substring(2, 15)}`
        toolCalls.push({
          id: callId,
          type: 'tool_call',
          name: item.name,
          arguments: item.arguments
        })
      }
    }

    return toolCalls
  }

  
  // Apply reasoning content to message for non-streaming
  private applyReasoningToMessage(message: any, reasoningSummaryText: string, reasoningFullText: string): any {
    const rtxtParts = []
    if (typeof reasoningSummaryText === 'string' && reasoningSummaryText.trim()) {
      rtxtParts.push(reasoningSummaryText)
    }
    if (typeof reasoningFullText === 'string' && reasoningFullText.trim()) {
      rtxtParts.push(reasoningFullText)
    }
    const rtxt = rtxtParts.filter((p) => p).join('\n\n')
    if (rtxt) {
      const thinkBlock = `<think>\n${rtxt}\n</think>\n`
      const contentText = message.content || ''
      message.content = thinkBlock + (typeof contentText === 'string' ? contentText : '')
    }
    return message
  }
}
