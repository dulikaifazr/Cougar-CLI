import { ModelAPIAdapter } from './adapters/base'
import { ResponsesAPIAdapter } from './adapters/responsesAPI'
import { ChatCompletionsAdapter } from './adapters/chatCompletions'
import { getModelCapabilities } from '@constants/modelCapabilities'
import { ModelProfile, getGlobalConfig } from '@utils/config'
import { ModelCapabilities } from '@cougar-types/modelCapabilities'

export class ModelAdapterFactory {
  /**
   * Create appropriate adapter based on model configuration
   */
  static createAdapter(modelProfile: ModelProfile): ModelAPIAdapter {
    const capabilities = getModelCapabilities(modelProfile.modelName)
    
    // Determine which API to use
    const apiType = this.determineAPIType(modelProfile, capabilities)
    
    // Create corresponding adapter
    switch (apiType) {
      case 'responses_api':
        return new ResponsesAPIAdapter(capabilities, modelProfile)
      case 'chat_completions':
      default:
        return new ChatCompletionsAdapter(capabilities, modelProfile)
    }
  }
  
  /**
   * Determine which API should be used
   */
  private static determineAPIType(
    modelProfile: ModelProfile,
    capabilities: ModelCapabilities
  ): 'responses_api' | 'chat_completions' {
    // If model doesn't support Responses API, use Chat Completions directly
    if (capabilities.apiArchitecture.primary !== 'responses_api') {
      return 'chat_completions'
    }
    
    // Check if this is official OpenAI endpoint
    const isOfficialOpenAI = !modelProfile.baseURL || 
      modelProfile.baseURL.includes('api.openai.com')
    
    // Non-official endpoints can use Responses API if model supports it
    if (!isOfficialOpenAI) {
      // If there's a fallback option, use fallback
      if (capabilities.apiArchitecture.fallback === 'chat_completions') {
        return capabilities.apiArchitecture.primary  // ← FIXED: Use primary instead of fallback
      }
      // Otherwise use primary (might fail, but let it try)
      return capabilities.apiArchitecture.primary
    }
    
    // For now, always use Responses API for supported models when on official endpoint
    // Streaming fallback will be handled at runtime if needed
    
    // Use primary API type
    return capabilities.apiArchitecture.primary
  }
  
  /**
   * Check if model should use Responses API
   */
  static shouldUseResponsesAPI(modelProfile: ModelProfile): boolean {
    const capabilities = getModelCapabilities(modelProfile.modelName)
    const apiType = this.determineAPIType(modelProfile, capabilities)
    return apiType === 'responses_api'
  }
}
