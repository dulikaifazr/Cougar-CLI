import { memoize } from 'lodash-es'
 
import { logError } from './log'
import {
  getGlobalConfig,
  ModelProfile,
  ModelPointerType,
  saveGlobalConfig,
} from './config'

export const USE_BEDROCK = !!process.env.CLAUDE_CODE_USE_BEDROCK
export const USE_VERTEX = !!process.env.CLAUDE_CODE_USE_VERTEX

export interface ModelConfig {
  bedrock: string
  vertex: string
  firstParty: string
}

const DEFAULT_MODEL_CONFIG: ModelConfig = {
  bedrock: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
  vertex: 'claude-3-7-sonnet@20250219',
  firstParty: 'claude-sonnet-4-20250514',
}

/**
 * Helper to get the model config from defaults.
 */
async function getModelConfig(): Promise<ModelConfig> {
  return DEFAULT_MODEL_CONFIG
}

export const getSlowAndCapableModel = memoize(async (): Promise<string> => {
  const config = await getGlobalConfig()

  // Use ModelManager for proper model resolution
  const modelManager = new ModelManager(config)
  const model = modelManager.getMainAgentModel()

  if (model) {
    return model
  }

  // Final fallback to default model
  const modelConfig = await getModelConfig()
  if (USE_BEDROCK) return modelConfig.bedrock
  if (USE_VERTEX) return modelConfig.vertex
  return modelConfig.firstParty
})

export async function isDefaultSlowAndCapableModel(): Promise<boolean> {
  return (
    !process.env.ANTHROPIC_MODEL ||
    process.env.ANTHROPIC_MODEL === (await getSlowAndCapableModel())
  )
}

/**
 * Get the region for a specific Vertex model
 * Checks for hardcoded model-specific environment variables first,
 * then falls back to CLOUD_ML_REGION env var or default region
 */
export function getVertexRegionForModel(
  model: string | undefined,
): string | undefined {
  if (model?.startsWith('claude-3-5-haiku')) {
    return process.env.VERTEX_REGION_CLAUDE_3_5_HAIKU
  } else if (model?.startsWith('claude-3-5-sonnet')) {
    return process.env.VERTEX_REGION_CLAUDE_3_5_SONNET
  } else if (model?.startsWith('claude-3-7-sonnet')) {
    return process.env.VERTEX_REGION_CLAUDE_3_7_SONNET
  }
}

/**
 * Comprehensive ModelManager class for centralized model selection and management.
 * Provides a clean interface for model selection across the application.
 */
export class ModelManager {
  private config: any // Using any to handle legacy properties
  private modelProfiles: ModelProfile[]

  constructor(config: any) {
    this.config = config
    this.modelProfiles = config.modelProfiles || []
  }

  /**
   * Get the current terminal model (for interactive CLI sessions)
   */
  getCurrentModel(): string | null {
    // Use main pointer from new ModelProfile system
    const mainModelName = this.config.modelPointers?.main
    if (mainModelName) {
      const profile = this.findModelProfile(mainModelName)
      if (profile && profile.isActive) {
        return profile.modelName
      }
    }

    // Fallback to main agent model
    return this.getMainAgentModel()
  }

  /**
   * Get the main agent default model (for non-terminal mode and MCP calls)
   */
  getMainAgentModel(): string | null {
    // Use main pointer from new ModelProfile system
    const mainModelName = this.config.modelPointers?.main
    if (mainModelName) {
      const profile = this.findModelProfile(mainModelName)
      if (profile && profile.isActive) {
        return profile.modelName
      }
    }

    // Fallback to first active profile
    const activeProfile = this.modelProfiles.find(p => p.isActive)
    if (activeProfile) {
      return activeProfile.modelName
    }

    return null
  }

  /**
   * Get the task tool default model (for Task tool sub-agents)
   */
  getTaskToolModel(): string | null {
    // Use task pointer from new ModelProfile system
    const taskModelName = this.config.modelPointers?.task
    if (taskModelName) {
      const profile = this.findModelProfile(taskModelName)
      if (profile && profile.isActive) {
        return profile.modelName
      }
    }

    // Fallback to main agent model
    return this.getMainAgentModel()
  }

  /**
   * Switch to the next available model with simple context overflow handling
   * If target model can't handle current context, shows warning and reverts after delay
   *
   * @param currentContextTokens - Current conversation token count for validation
   * @returns Object with model name and context status information
   */
  switchToNextModelWithContextCheck(currentContextTokens: number = 0): {
    success: boolean
    modelName: string | null
    previousModelName: string | null
    contextOverflow: boolean
    usagePercentage: number
  } {
    // Use ALL configured models, not just active ones
    const allProfiles = this.getAllConfiguredModels()
    if (allProfiles.length === 0) {
      return {
        success: false,
        modelName: null,
        previousModelName: null,
        contextOverflow: false,
        usagePercentage: 0,
      }
    }

    // Sort by createdAt for consistent cycling order (don't use lastUsed)
    // Using lastUsed causes the order to change each time, preventing proper cycling
    allProfiles.sort((a, b) => {
      return a.createdAt - b.createdAt // Oldest first for consistent order
    })

    const currentMainModelName = this.config.modelPointers?.main
    const currentModel = currentMainModelName
      ? this.findModelProfile(currentMainModelName)
      : null
    const previousModelName = currentModel?.name || null

    if (!currentMainModelName) {
      // No current main model, select first available (activate if needed)
      const firstModel = allProfiles[0]
      if (!firstModel.isActive) {
        firstModel.isActive = true
      }
      this.setPointer('main', firstModel.modelName)
      this.updateLastUsed(firstModel.modelName)

      const analysis = this.analyzeContextCompatibility(
        firstModel,
        currentContextTokens,
      )
      return {
        success: true,
        modelName: firstModel.name,
        previousModelName: null,
        contextOverflow: !analysis.compatible,
        usagePercentage: analysis.usagePercentage,
      }
    }

    // Find current model index in ALL models
    const currentIndex = allProfiles.findIndex(
      p => p.modelName === currentMainModelName,
    )
    if (currentIndex === -1) {
      // Current model not found, select first available (activate if needed)
      const firstModel = allProfiles[0]
      if (!firstModel.isActive) {
        firstModel.isActive = true
      }
      this.setPointer('main', firstModel.modelName)
      this.updateLastUsed(firstModel.modelName)

      const analysis = this.analyzeContextCompatibility(
        firstModel,
        currentContextTokens,
      )
      return {
        success: true,
        modelName: firstModel.name,
        previousModelName,
        contextOverflow: !analysis.compatible,
        usagePercentage: analysis.usagePercentage,
      }
    }

    // Check if only one model is available
    if (allProfiles.length === 1) {
      return {
        success: false,
        modelName: null,
        previousModelName,
        contextOverflow: false,
        usagePercentage: 0,
      }
    }

    // Get next model in cycle (from ALL models)
    const nextIndex = (currentIndex + 1) % allProfiles.length
    const nextModel = allProfiles[nextIndex]
    
    // Activate the model if it's not already active
    const wasInactive = !nextModel.isActive
    if (!nextModel.isActive) {
      nextModel.isActive = true
    }

    // Analyze context compatibility for next model
    const analysis = this.analyzeContextCompatibility(
      nextModel,
      currentContextTokens,
    )

    // Always switch to next model, but return context status
    this.setPointer('main', nextModel.modelName)
    this.updateLastUsed(nextModel.modelName)
    
    // Save configuration if we activated a new model
    if (wasInactive) {
      this.saveConfig()
    }

    return {
      success: true,
      modelName: nextModel.name,
      previousModelName,
      contextOverflow: !analysis.compatible,
      usagePercentage: analysis.usagePercentage,
    }
  }

  /**
   * Simple model switching for UI components (compatible interface)
   * @param currentContextTokens - Current conversation token count for validation
   * @returns Compatible interface for PromptInput component
   */
  switchToNextModel(currentContextTokens: number = 0): {
    success: boolean
    modelName: string | null
    blocked?: boolean
    message?: string
  } {
    // Use the enhanced context check method for consistency
    const result = this.switchToNextModelWithContextCheck(currentContextTokens)
    
    if (!result.success) {
      const allModels = this.getAllConfiguredModels()
      if (allModels.length === 0) {
        return {
          success: false,
          modelName: null,
          blocked: false,
          message: '❌ No models configured. Use /model to add models.',
        }
      } else if (allModels.length === 1) {
        return {
          success: false,
          modelName: null,
          blocked: false,
          message: `⚠️ Only one model configured (${allModels[0].modelName}). Use /model to add more models for switching.`,
        }
      }
    }
    
    // Convert the detailed result to the simple interface
    const currentModel = this.findModelProfile(this.config.modelPointers?.main)
    const allModels = this.getAllConfiguredModels()
    const currentIndex = allModels.findIndex(m => m.modelName === currentModel?.modelName)
    const totalModels = allModels.length
    
    return {
      success: result.success,
      modelName: result.modelName,
      blocked: result.contextOverflow,
      message: result.success
        ? result.contextOverflow
          ? `⚠️ Context usage: ${result.usagePercentage.toFixed(1)}% - ${result.modelName}`
          : `✅ Switched to ${result.modelName} (${currentIndex + 1}/${totalModels})${currentModel?.provider ? ` [${currentModel.provider}]` : ''}`
        : `❌ Failed to switch models`,
    }
  }

  /**
   * Revert to previous model (used when context overflow requires rollback)
   */
  revertToPreviousModel(previousModelName: string): boolean {
    const previousModel = this.modelProfiles.find(
      p => p.name === previousModelName && p.isActive,
    )
    if (!previousModel) {
      return false
    }

    this.setPointer('main', previousModel.modelName)
    this.updateLastUsed(previousModel.modelName)
    return true
  }

  /**
   * Enhanced context validation with different severity levels
   */
  analyzeContextCompatibility(
    model: ModelProfile,
    contextTokens: number,
  ): {
    compatible: boolean
    severity: 'safe' | 'warning' | 'critical'
    usagePercentage: number
    recommendation: string
  } {
    const usableContext = Math.floor(model.contextLength * 0.8) // Reserve 20% for output
    const usagePercentage = (contextTokens / usableContext) * 100

    if (usagePercentage <= 70) {
      return {
        compatible: true,
        severity: 'safe',
        usagePercentage,
        recommendation: 'Full context preserved',
      }
    } else if (usagePercentage <= 90) {
      return {
        compatible: true,
        severity: 'warning',
        usagePercentage,
        recommendation: 'Context usage high, consider compression',
      }
    } else {
      return {
        compatible: false,
        severity: 'critical',
        usagePercentage,
        recommendation: 'Auto-compression or message truncation required',
      }
    }
  }

  /**
   * Switch to next model with enhanced context analysis
   */
  switchToNextModelWithAnalysis(currentContextTokens: number = 0): {
    modelName: string | null
    contextAnalysis: ReturnType<typeof this.analyzeContextCompatibility> | null
    requiresCompression: boolean
    estimatedTokensAfterSwitch: number
  } {
    const result = this.switchToNextModel(currentContextTokens)

    if (!result.success || !result.modelName) {
      return {
        modelName: null,
        contextAnalysis: null,
        requiresCompression: false,
        estimatedTokensAfterSwitch: 0,
      }
    }

    const newModel = this.getModel('main')
    if (!newModel) {
      return {
        modelName: result.modelName,
        contextAnalysis: null,
        requiresCompression: false,
        estimatedTokensAfterSwitch: currentContextTokens,
      }
    }

    const analysis = this.analyzeContextCompatibility(
      newModel,
      currentContextTokens,
    )

    return {
      modelName: result.modelName,
      contextAnalysis: analysis,
      requiresCompression: analysis.severity === 'critical',
      estimatedTokensAfterSwitch: currentContextTokens,
    }
  }

  /**
   * Check if a model can handle the given context size (legacy method)
   */
  canModelHandleContext(model: ModelProfile, contextTokens: number): boolean {
    const analysis = this.analyzeContextCompatibility(model, contextTokens)
    return analysis.compatible
  }

  /**
   * Find the first model that can handle the given context size
   */
  findModelWithSufficientContext(
    models: ModelProfile[],
    contextTokens: number,
  ): ModelProfile | null {
    return (
      models.find(model => this.canModelHandleContext(model, contextTokens)) ||
      null
    )
  }

  /**
   * Unified model getter for different contexts
   */
  getModelForContext(
    contextType: 'terminal' | 'main-agent' | 'task-tool',
  ): string | null {
    switch (contextType) {
      case 'terminal':
        return this.getCurrentModel()
      case 'main-agent':
        return this.getMainAgentModel()
      case 'task-tool':
        return this.getTaskToolModel()
      default:
        return this.getMainAgentModel()
    }
  }

  /**
   * Get all active model profiles
   */
  getActiveModelProfiles(): ModelProfile[] {
    return this.modelProfiles.filter(p => p.isActive)
  }

  /**
   * Check if any models are configured
   */
  hasConfiguredModels(): boolean {
    return this.getActiveModelProfiles().length > 0
  }

  // New model pointer system methods

  /**
   * Get model by pointer type (main, task, reasoning, quick)
   */
  getModel(pointer: ModelPointerType): ModelProfile | null {
    const pointerId = this.config.modelPointers?.[pointer]
    if (!pointerId) {
      return this.getDefaultModel()
    }

    const profile = this.findModelProfile(pointerId)
    return profile && profile.isActive ? profile : this.getDefaultModel()
  }

  /**
   * Get model name by pointer type
   */
  getModelName(pointer: ModelPointerType): string | null {
    const profile = this.getModel(pointer)
    return profile ? profile.modelName : null
  }

  /**
   * Get reasoning model (with fallback)
   */
  getReasoningModel(): string | null {
    return this.getModelName('reasoning') || this.getModelName('main')
  }

  /**
   * Get quick model (with fallback)
   */
  getQuickModel(): string | null {
    return (
      this.getModelName('quick') ||
      this.getModelName('task') ||
      this.getModelName('main')
    )
  }

  /**
   * Add a new model profile with duplicate validation
   */
  async addModel(
    config: Omit<ModelProfile, 'createdAt' | 'isActive'>,
  ): Promise<string> {
    // Check for duplicate modelName (actual model identifier)
    const existingByModelName = this.modelProfiles.find(
      p => p.modelName === config.modelName,
    )
    if (existingByModelName) {
      throw new Error(
        `Model with modelName '${config.modelName}' already exists: ${existingByModelName.name}`,
      )
    }

    // Check for duplicate friendly name
    const existingByName = this.modelProfiles.find(p => p.name === config.name)
    if (existingByName) {
      throw new Error(`Model with name '${config.name}' already exists`)
    }

    const newModel: ModelProfile = {
      ...config,
      createdAt: Date.now(),
      isActive: true,
    }

    this.modelProfiles.push(newModel)

    // If this is the first model, set all pointers to it
    if (this.modelProfiles.length === 1) {
      this.config.modelPointers = {
        main: config.modelName,
        task: config.modelName,
        reasoning: config.modelName,
        quick: config.modelName,
      }
      this.config.defaultModelName = config.modelName
    } else {
      // For any new model after the first, set it as the main pointer
      if (!this.config.modelPointers) {
        this.config.modelPointers = {
          main: config.modelName,
          task: '',
          reasoning: '',
          quick: '',
        }
      } else {
        this.config.modelPointers.main = config.modelName
      }
    }

    this.saveConfig()
    return config.modelName
  }

  /**
   * Set model pointer assignment
   */
  setPointer(pointer: ModelPointerType, modelName: string): void {
    if (!this.findModelProfile(modelName)) {
      throw new Error(`Model '${modelName}' not found`)
    }

    if (!this.config.modelPointers) {
      this.config.modelPointers = {
        main: '',
        task: '',
        reasoning: '',
        quick: '',
      }
    }

    this.config.modelPointers[pointer] = modelName
    this.saveConfig()
  }

  /**
   * Get all active models for pointer assignment
   */
  getAvailableModels(): ModelProfile[] {
    return this.modelProfiles.filter(p => p.isActive)
  }

  /**
   * Get all configured models (both active and inactive) for switching
   */
  getAllConfiguredModels(): ModelProfile[] {
    return this.modelProfiles
  }

  /**
   * Get all available model names (modelName field) - active only
   */
  getAllAvailableModelNames(): string[] {
    return this.getAvailableModels().map(p => p.modelName)
  }

  /**
   * Get all configured model names (both active and inactive)
   */
  getAllConfiguredModelNames(): string[] {
    return this.getAllConfiguredModels().map(p => p.modelName)
  }

  /**
   * Debug method to get detailed model switching information
   */
  getModelSwitchingDebugInfo(): {
    totalModels: number
    activeModels: number
    inactiveModels: number
    currentMainModel: string | null
    availableModels: Array<{
      name: string
      modelName: string 
      provider: string
      isActive: boolean
      lastUsed?: number
    }>
    modelPointers: Record<string, string | undefined>
  } {
    const availableModels = this.getAvailableModels()
    const currentMainModelName = this.config.modelPointers?.main
    
    return {
      totalModels: this.modelProfiles.length,
      activeModels: availableModels.length,
      inactiveModels: this.modelProfiles.length - availableModels.length,
      currentMainModel: currentMainModelName || null,
      availableModels: this.modelProfiles.map(p => ({
        name: p.name,
        modelName: p.modelName,
        provider: p.provider,
        isActive: p.isActive,
        lastUsed: p.lastUsed,
      })),
      modelPointers: this.config.modelPointers || {},
    }
  }

  /**
   * Remove a model profile
   */
  removeModel(modelName: string): void {
    this.modelProfiles = this.modelProfiles.filter(
      p => p.modelName !== modelName,
    )

    // Clean up pointers that reference deleted model
    if (this.config.modelPointers) {
      Object.keys(this.config.modelPointers).forEach(pointer => {
        if (
          this.config.modelPointers[pointer as ModelPointerType] === modelName
        ) {
          this.config.modelPointers[pointer as ModelPointerType] =
            this.config.defaultModelName || ''
        }
      })
    }

    this.saveConfig()
  }

  /**
   * Get default model profile
   */
  private getDefaultModel(): ModelProfile | null {
    if (this.config.defaultModelId) {
      const profile = this.findModelProfile(this.config.defaultModelId)
      if (profile && profile.isActive) {
        return profile
      }
    }
    return this.modelProfiles.find(p => p.isActive) || null
  }

  /**
   * Save configuration changes
   */
  private saveConfig(): void {
    const updatedConfig = {
      ...this.config,
      modelProfiles: this.modelProfiles,
    }
    saveGlobalConfig(updatedConfig)
  }

  /**
   * Get a fallback model when no specific model is configured
   */
  async getFallbackModel(): Promise<string> {
    const modelConfig = await getModelConfig()
    if (USE_BEDROCK) return modelConfig.bedrock
    if (USE_VERTEX) return modelConfig.vertex
    return modelConfig.firstParty
  }

  /**
   * 统一的模型解析方法：支持指针、model ID 和真实模型名称
   * @param modelParam - 可以是模型指针 ('main', 'task', etc.)、内部model ID 或真实模型名称 ('gpt-4o', 'claude-3-5-sonnet')
   * @returns ModelProfile 或 null
   */
  resolveModel(modelParam: string | ModelPointerType): ModelProfile | null {
    // 首先检查是否是模型指针
    if (['main', 'task', 'reasoning', 'quick'].includes(modelParam)) {
      const pointerId =
        this.config.modelPointers?.[modelParam as ModelPointerType]
      if (pointerId) {
        // pointerId 可能是内部ID或真实模型名称，尝试两种查找方式
        let profile = this.findModelProfile(pointerId) // 按内部ID查找
        if (!profile) {
          profile = this.findModelProfileByModelName(pointerId) // 按真实模型名查找
        }
        if (profile && profile.isActive) {
          return profile
        }
      }
      // 指针无效时，尝试 fallback 到默认模型
      return this.getDefaultModel()
    }

    // 不是指针，尝试多种查找方式
    // 1. 尝试按内部 model ID 查找
    let profile = this.findModelProfile(modelParam)
    if (profile && profile.isActive) {
      return profile
    }

    // 2. 尝试按真实模型名称查找
    profile = this.findModelProfileByModelName(modelParam)
    if (profile && profile.isActive) {
      return profile
    }

    // 3. 尝试按友好名称查找
    profile = this.findModelProfileByName(modelParam)
    if (profile && profile.isActive) {
      return profile
    }

    // 所有查找方式都失败，尝试 fallback 到默认模型
    return this.getDefaultModel()
  }

  /**
   * 解析模型参数并返回完整信息
   */
  resolveModelWithInfo(modelParam: string | ModelPointerType): {
    success: boolean
    profile: ModelProfile | null
    error?: string
  } {
    const isPointer = ['main', 'task', 'reasoning', 'quick'].includes(
      modelParam,
    )

    if (isPointer) {
      const pointerId =
        this.config.modelPointers?.[modelParam as ModelPointerType]
      if (!pointerId) {
        return {
          success: false,
          profile: null,
          error: `Model pointer '${modelParam}' is not configured. Use /model to set up models.`,
        }
      }

      // pointerId 可能是内部ID或真实模型名称
      let profile = this.findModelProfile(pointerId)
      if (!profile) {
        profile = this.findModelProfileByModelName(pointerId)
      }

      if (!profile) {
        return {
          success: false,
          profile: null,
          error: `Model pointer '${modelParam}' points to invalid model '${pointerId}'. Use /model to reconfigure.`,
        }
      }

      if (!profile.isActive) {
        return {
          success: false,
          profile: null,
          error: `Model '${profile.name}' (pointed by '${modelParam}') is inactive. Use /model to activate it.`,
        }
      }

      return {
        success: true,
        profile,
      }
    } else {
      // 直接的 model ID 或模型名称，尝试多种查找方式
      let profile = this.findModelProfile(modelParam)
      if (!profile) {
        profile = this.findModelProfileByModelName(modelParam)
      }
      if (!profile) {
        profile = this.findModelProfileByName(modelParam)
      }

      if (!profile) {
        return {
          success: false,
          profile: null,
          error: `Model '${modelParam}' not found. Use /model to add models.`,
        }
      }

      if (!profile.isActive) {
        return {
          success: false,
          profile: null,
          error: `Model '${profile.name}' is inactive. Use /model to activate it.`,
        }
      }

      return {
        success: true,
        profile,
      }
    }
  }

  // Private helper methods
  private findModelProfile(modelName: string): ModelProfile | null {
    return this.modelProfiles.find(p => p.modelName === modelName) || null
  }

  private findModelProfileByModelName(modelName: string): ModelProfile | null {
    return this.modelProfiles.find(p => p.modelName === modelName) || null
  }

  private findModelProfileByName(name: string): ModelProfile | null {
    return this.modelProfiles.find(p => p.name === name) || null
  }

  private updateLastUsed(modelName: string): void {
    const profile = this.findModelProfile(modelName)
    if (profile) {
      profile.lastUsed = Date.now()
    }
  }
}

// Global ModelManager instance to avoid config read/write race conditions
let globalModelManager: ModelManager | null = null

/**
 * Get the global ModelManager instance (singleton pattern to fix race conditions)
 */
export const getModelManager = (): ModelManager => {
  try {
    if (!globalModelManager) {
      const config = getGlobalConfig()
      if (!config) {
        console.warn(
          'No global config available, creating ModelManager with empty config',
        )
        globalModelManager = new ModelManager({
          modelProfiles: [],
          modelPointers: { main: '', task: '', reasoning: '', quick: '' },
        })
      } else {
        globalModelManager = new ModelManager(config)
      }
    }
    return globalModelManager
  } catch (error) {
    console.error('Error creating ModelManager:', error)
    // Return a fallback ModelManager with empty configuration
    return new ModelManager({
      modelProfiles: [],
      modelPointers: { main: '', task: '', reasoning: '', quick: '' },
    })
  }
}

/**
 * Force reload of the global ModelManager instance
 * Used when configuration changes to ensure fresh data
 */
export const reloadModelManager = (): void => {
  globalModelManager = null
  // Force creation of new instance with fresh config
  getModelManager()
}

/**
 * Get the quick model for fast operations
 */
export const getQuickModel = (): string => {
  const manager = getModelManager()
  const quickModel = manager.getModel('quick')
  return quickModel?.modelName || 'quick' // Return pointer if model not resolved
}
