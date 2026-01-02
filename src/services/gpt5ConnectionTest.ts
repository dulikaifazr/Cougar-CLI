/**
 * 🔥 GPT-5 Connection Test Service
 * 
 * Specialized connection testing for GPT-5 models that supports both
 * Responses API and Chat Completions API with proper fallback handling.
 */

import { getModelFeatures } from './openai'

export interface ConnectionTestResult {
  success: boolean
  message: string
  endpoint?: string
  details?: string
  apiUsed?: 'responses' | 'chat_completions'
  responseTime?: number
}

export interface GPT5TestConfig {
  model: string
  apiKey: string
  baseURL?: string
  maxTokens?: number
  provider?: string
}

/**
 * Test GPT-5 model connection with intelligent API selection
 */
export async function testGPT5Connection(config: GPT5TestConfig): Promise<ConnectionTestResult> {
  const startTime = Date.now()
  
  // Validate configuration
  if (!config.model || !config.apiKey) {
    return {
      success: false,
      message: 'Invalid configuration',
      details: 'Model name and API key are required',
    }
  }

  const isGPT5 = config.model.toLowerCase().includes('gpt-5')
  const modelFeatures = getModelFeatures(config.model)
  const baseURL = config.baseURL || 'https://api.openai.com/v1'
  const isOfficialOpenAI = !config.baseURL || config.baseURL.includes('api.openai.com')

  console.log(`🔧 Testing GPT-5 connection for model: ${config.model}`)
  console.log(`🔧 Base URL: ${baseURL}`)
  console.log(`🔧 Official OpenAI: ${isOfficialOpenAI}`)
  console.log(`🔧 Supports Responses API: ${modelFeatures.supportsResponsesAPI}`)

  // Try Responses API first for official GPT-5 models
  if (isGPT5 && modelFeatures.supportsResponsesAPI && isOfficialOpenAI) {
    console.log(`🚀 Attempting Responses API for ${config.model}`)
    const responsesResult = await testResponsesAPI(config, baseURL, startTime)
    
    if (responsesResult.success) {
      console.log(`✅ Responses API test successful for ${config.model}`)
      return responsesResult
    } else {
      console.log(`⚠️ Responses API failed, falling back to Chat Completions: ${responsesResult.details}`)
    }
  }

  // Fallback to Chat Completions API
  console.log(`🔄 Using Chat Completions API for ${config.model}`)
  return await testChatCompletionsAPI(config, baseURL, startTime)
}

/**
 * Test using GPT-5 Responses API
 */
async function testResponsesAPI(
  config: GPT5TestConfig, 
  baseURL: string, 
  startTime: number
): Promise<ConnectionTestResult> {
  const testURL = `${baseURL.replace(/\/+$/, '')}/responses`
  
  const testPayload = {
    model: config.model,
    input: [
      {
        role: 'user',
        content: 'Please respond with exactly "YES" (in capital letters) to confirm this connection is working.',
      },
    ],
    max_completion_tokens: Math.max(config.maxTokens || 8192, 8192),
    temperature: 1, // GPT-5 requirement
    reasoning: {
      effort: 'low', // Fast response for connection test
    },
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`,
  }

  console.log(`🔧 Responses API URL: ${testURL}`)
  console.log(`🔧 Responses API payload:`, JSON.stringify(testPayload, null, 2))

  try {
    const response = await fetch(testURL, {
      method: 'POST',
      headers,
      body: JSON.stringify(testPayload),
    })

    const responseTime = Date.now() - startTime

    if (response.ok) {
      const data = await response.json()
      console.log(`✅ Responses API successful response:`, data)

      // Extract content from Responses API format
      let responseContent = ''
      if (data.output_text) {
        responseContent = data.output_text
      } else if (data.output && Array.isArray(data.output)) {
        // Extract from structured output format
        const messageOutput = data.output.find(item => item.type === 'message')
        if (messageOutput && messageOutput.content) {
          const textContent = messageOutput.content.find(c => c.type === 'output_text')
          responseContent = textContent?.text || ''
        }
      }

      const containsYes = responseContent.toLowerCase().includes('yes')

      if (containsYes) {
        return {
          success: true,
          message: '✅ GPT-5 Responses API connection successful',
          endpoint: '/responses',
          details: `Model responded correctly: "${responseContent.trim()}"`,
          apiUsed: 'responses',
          responseTime,
        }
      } else {
        return {
          success: false,
          message: '⚠️ Responses API connected but unexpected response',
          endpoint: '/responses',
          details: `Expected "YES" but got: "${responseContent.trim() || '(empty response)'}"`,
          apiUsed: 'responses',
          responseTime,
        }
      }
    } else {
      const errorData = await response.json().catch(() => null)
      const errorMessage = errorData?.error?.message || errorData?.message || response.statusText

      console.log(`❌ Responses API error (${response.status}):`, errorData)

      return {
        success: false,
        message: `❌ Responses API failed (${response.status})`,
        endpoint: '/responses',
        details: `Error: ${errorMessage}`,
        apiUsed: 'responses',
        responseTime: Date.now() - startTime,
      }
    }
  } catch (error) {
    console.log(`❌ Responses API connection error:`, error)
    
    return {
      success: false,
      message: '❌ Responses API connection failed',
      endpoint: '/responses',
      details: error instanceof Error ? error.message : String(error),
      apiUsed: 'responses',
      responseTime: Date.now() - startTime,
    }
  }
}

/**
 * Test using Chat Completions API with GPT-5 compatibility
 */
async function testChatCompletionsAPI(
  config: GPT5TestConfig, 
  baseURL: string, 
  startTime: number
): Promise<ConnectionTestResult> {
  const testURL = `${baseURL.replace(/\/+$/, '')}/chat/completions`
  
  const isGPT5 = config.model.toLowerCase().includes('gpt-5')
  
  // Create test payload with GPT-5 compatibility
  const testPayload: any = {
    model: config.model,
    messages: [
      {
        role: 'user',
        content: 'Please respond with exactly "YES" (in capital letters) to confirm this connection is working.',
      },
    ],
    temperature: isGPT5 ? 1 : 0, // GPT-5 requires temperature=1
    stream: false,
  }

  // 🔧 Apply GPT-5 parameter transformations
  if (isGPT5) {
    testPayload.max_completion_tokens = Math.max(config.maxTokens || 8192, 8192)
    delete testPayload.max_tokens  // 🔥 CRITICAL: Remove max_tokens for GPT-5
    console.log(`🔧 GPT-5 mode: Using max_completion_tokens = ${testPayload.max_completion_tokens}`)
  } else {
    testPayload.max_tokens = Math.max(config.maxTokens || 8192, 8192)
  }

  const headers = {
    'Content-Type': 'application/json',
  }

  // Add provider-specific headers
  if (config.provider === 'azure') {
    headers['api-key'] = config.apiKey
  } else {
    headers['Authorization'] = `Bearer ${config.apiKey}`
  }

  console.log(`🔧 Chat Completions URL: ${testURL}`)
  console.log(`🔧 Chat Completions payload:`, JSON.stringify(testPayload, null, 2))

  try {
    const response = await fetch(testURL, {
      method: 'POST',
      headers,
      body: JSON.stringify(testPayload),
    })

    const responseTime = Date.now() - startTime

    if (response.ok) {
      const data = await response.json()
      console.log(`✅ Chat Completions successful response:`, data)

      const responseContent = data.choices?.[0]?.message?.content || ''
      const containsYes = responseContent.toLowerCase().includes('yes')

      if (containsYes) {
        return {
          success: true,
          message: `✅ ${isGPT5 ? 'GPT-5' : 'Model'} Chat Completions connection successful`,
          endpoint: '/chat/completions',
          details: `Model responded correctly: "${responseContent.trim()}"`,
          apiUsed: 'chat_completions',
          responseTime,
        }
      } else {
        return {
          success: false,
          message: '⚠️ Chat Completions connected but unexpected response',
          endpoint: '/chat/completions',
          details: `Expected "YES" but got: "${responseContent.trim() || '(empty response)'}"`,
          apiUsed: 'chat_completions',
          responseTime,
        }
      }
    } else {
      const errorData = await response.json().catch(() => null)
      const errorMessage = errorData?.error?.message || errorData?.message || response.statusText

      console.log(`❌ Chat Completions error (${response.status}):`, errorData)

      // 🔧 Provide specific guidance for GPT-5 errors
      let details = `Error: ${errorMessage}`
      if (response.status === 400 && errorMessage.includes('max_tokens') && isGPT5) {
        details += '\n\n🔧 GPT-5 Fix Applied: This error suggests a parameter compatibility issue. Please check if the provider supports GPT-5 with max_completion_tokens.'
      }

      return {
        success: false,
        message: `❌ Chat Completions failed (${response.status})`,
        endpoint: '/chat/completions',
        details: details,
        apiUsed: 'chat_completions',
        responseTime: Date.now() - startTime,
      }
    }
  } catch (error) {
    console.log(`❌ Chat Completions connection error:`, error)
    
    return {
      success: false,
      message: '❌ Chat Completions connection failed',
      endpoint: '/chat/completions',
      details: error instanceof Error ? error.message : String(error),
      apiUsed: 'chat_completions',
      responseTime: Date.now() - startTime,
    }
  }
}

/**
 * Quick validation for GPT-5 configuration
 */
export function validateGPT5Config(config: GPT5TestConfig): { valid: boolean; errors: string[] } {
  console.log(`🔧 validateGPT5Config called with:`, {
    model: config.model,
    hasApiKey: !!config.apiKey,
    baseURL: config.baseURL,
    provider: config.provider,
  })
  
  const errors: string[] = []

  if (!config.model) {
    errors.push('Model name is required')
  }

  if (!config.apiKey) {
    errors.push('API key is required')
  }

  const isGPT5 = config.model?.toLowerCase().includes('gpt-5')
  if (isGPT5) {
    console.log(`🔧 GPT-5 validation: model=${config.model}, maxTokens=${config.maxTokens}`)
    
    if (config.maxTokens && config.maxTokens < 1000) {
      errors.push('GPT-5 models typically require at least 1000 max tokens')
    }
    
    // 完全移除第三方provider限制，允许所有代理中转站使用GPT-5
    console.log(`🔧 No third-party restrictions applied for GPT-5`)
  }

  console.log(`🔧 Validation result:`, { valid: errors.length === 0, errors })

  return {
    valid: errors.length === 0,
    errors,
  }
}