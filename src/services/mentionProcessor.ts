/**
 * Mention Processor Service
 * Handles @agent and @file mentions through the system reminder infrastructure
 * Designed to integrate naturally with the existing event-driven architecture
 */

import { emitReminderEvent } from './systemReminder'
import { getAvailableAgentTypes } from '@utils/agentLoader'
import { existsSync } from 'fs'
import { resolve } from 'path'
import { getCwd } from '@utils/state'
import { debug as debugLogger } from '@utils/debugLogger'

export interface MentionContext {
  type: 'agent' | 'file'
  mention: string
  resolved: string
  exists: boolean
  metadata?: any
}

export interface ProcessedMentions {
  agents: MentionContext[]
  files: MentionContext[]
  hasAgentMentions: boolean
  hasFileMentions: boolean
}

class MentionProcessorService {
  // Centralized mention patterns - single source of truth
  private static readonly MENTION_PATTERNS = {
    runAgent: /@(run-agent-[\w\-]+)/g,
    agent: /@(agent-[\w\-]+)/g,  // Legacy support
    askModel: /@(ask-[\w\-]+)/g,
    file: /@([a-zA-Z0-9/._-]+(?:\.[a-zA-Z0-9]+)?)/g
  } as const

  private agentCache: Map<string, boolean> = new Map()
  private lastAgentCheck: number = 0
  private CACHE_TTL = 60000 // 1 minute cache

  /**
   * Process mentions in user input and emit appropriate events
   * This follows the event-driven philosophy of system reminders
   */
  public async processMentions(input: string): Promise<ProcessedMentions> {
    const result: ProcessedMentions = {
      agents: [],
      files: [],
      hasAgentMentions: false,
      hasFileMentions: false,
    }

    try {

    // Process agent mentions with unified logic to eliminate code duplication
    const agentMentions = this.extractAgentMentions(input)
    if (agentMentions.length > 0) {
      await this.refreshAgentCache()
      
      for (const { mention, agentType, isAskModel } of agentMentions) {
        if (isAskModel || this.agentCache.has(agentType)) {
          result.agents.push({
            type: 'agent',
            mention,
            resolved: agentType,
            exists: true,
            metadata: isAskModel ? { type: 'ask-model' } : undefined
          })
          result.hasAgentMentions = true
          
          // Emit appropriate event based on mention type
          this.emitAgentMentionEvent(mention, agentType, isAskModel)
        }
      }
    }
    
    // No longer process @xxx format - treat as regular text (emails, etc.)

    // Process file mentions (exclude agent and ask-model mentions)
    const fileMatches = [...input.matchAll(MentionProcessorService.MENTION_PATTERNS.file)]
    const processedAgentMentions = new Set(agentMentions.map(am => am.mention))
    
    for (const match of fileMatches) {
      const mention = match[1]
      
      // Skip if this is an agent or ask-model mention (already processed)
      if (mention.startsWith('run-agent-') || mention.startsWith('agent-') || mention.startsWith('ask-') || processedAgentMentions.has(mention)) {
        continue
      }
      
      // Check if it's a file
      const filePath = this.resolveFilePath(mention)
      if (existsSync(filePath)) {
        result.files.push({
          type: 'file',
          mention,
          resolved: filePath,
          exists: true,
        })
        result.hasFileMentions = true
        
        // Emit file mention event for system reminder to handle
        emitReminderEvent('file:mentioned', {
          filePath: filePath,
          originalMention: mention,
          timestamp: Date.now(),
        })
      }
    }

      return result
    } catch (error) {
      console.warn('[MentionProcessor] Failed to process mentions:', {
        input: input.substring(0, 100) + (input.length > 100 ? '...' : ''),
        error: error instanceof Error ? error.message : error
      })
      
      // Return empty result on error to maintain system stability
      return {
        agents: [],
        files: [],
        hasAgentMentions: false,
        hasFileMentions: false,
      }
    }
  }

  // Removed identifyMention method as it's no longer needed with separate processing

  /**
   * Resolve file path relative to current working directory
   */
  private resolveFilePath(mention: string): string {
    // Simple consistent logic: mention is always relative to current directory
    return resolve(getCwd(), mention)
  }

  /**
   * Refresh the agent cache periodically
   * This avoids hitting the agent loader on every mention
   */
  private async refreshAgentCache(): Promise<void> {
    const now = Date.now()
    if (now - this.lastAgentCheck < this.CACHE_TTL) {
      return // Cache is still fresh
    }

    try {
      const agents = await getAvailableAgentTypes()
      const previousCacheSize = this.agentCache.size
      this.agentCache.clear()
      
      for (const agent of agents) {
        // Store only the agent type without prefix for consistent lookup
        this.agentCache.set(agent.agentType, true)
      }
      
      this.lastAgentCheck = now
      
      // Log cache refresh for debugging mention resolution issues
      if (agents.length !== previousCacheSize) {
        debugLogger.info('MENTION_PROCESSOR_CACHE_REFRESHED', {
          agentCount: agents.length,
          previousCacheSize,
          cacheAge: now - this.lastAgentCheck,
        })
      }
    } catch (error) {
      console.warn('[MentionProcessor] Failed to refresh agent cache, keeping existing cache:', {
        error: error instanceof Error ? error.message : error,
        cacheSize: this.agentCache.size,
        lastRefresh: new Date(this.lastAgentCheck).toISOString()
      })
      // Keep existing cache on error to maintain functionality
    }
  }

  /**
   * Extract agent mentions with unified pattern matching
   * Consolidates run-agent, agent, and ask-model detection logic
   */
  private extractAgentMentions(input: string): Array<{ mention: string; agentType: string; isAskModel: boolean }> {
    const mentions: Array<{ mention: string; agentType: string; isAskModel: boolean }> = []
    
    // Process @run-agent-xxx format (preferred)
    const runAgentMatches = [...input.matchAll(MentionProcessorService.MENTION_PATTERNS.runAgent)]
    for (const match of runAgentMatches) {
      const mention = match[1]
      const agentType = mention.replace(/^run-agent-/, '')
      mentions.push({ mention, agentType, isAskModel: false })
    }
    
    // Process @agent-xxx format (legacy)
    const agentMatches = [...input.matchAll(MentionProcessorService.MENTION_PATTERNS.agent)]
    for (const match of agentMatches) {
      const mention = match[1]
      const agentType = mention.replace(/^agent-/, '')
      mentions.push({ mention, agentType, isAskModel: false })
    }
    
    // Process @ask-model mentions
    const askModelMatches = [...input.matchAll(MentionProcessorService.MENTION_PATTERNS.askModel)]
    for (const match of askModelMatches) {
      const mention = match[1]
      mentions.push({ mention, agentType: mention, isAskModel: true })
    }
    
    return mentions
  }
  
  /**
   * Emit agent mention event with proper typing
   * Centralized event emission to ensure consistency
   */
  private emitAgentMentionEvent(mention: string, agentType: string, isAskModel: boolean): void {
    try {
      const eventData = {
        originalMention: mention,
        timestamp: Date.now(),
      }

      if (isAskModel) {
        emitReminderEvent('ask-model:mentioned', {
          ...eventData,
          modelName: mention,
        })
      } else {
        emitReminderEvent('agent:mentioned', {
          ...eventData,
          agentType,
        })
      }
      
      // Debug log for mention event emission tracking
      debugLogger.info('MENTION_PROCESSOR_EVENT_EMITTED', {
        type: isAskModel ? 'ask-model' : 'agent',
        mention,
        agentType: isAskModel ? undefined : agentType,
      })
    } catch (error) {
      debugLogger.error('MENTION_PROCESSOR_EVENT_FAILED', {
        mention,
        agentType,
        isAskModel,
        error: error instanceof Error ? error.message : error,
      })
    }
  }

  /**
   * Clear caches - useful for testing or reset
   */
  public clearCache(): void {
    this.agentCache.clear()
    this.lastAgentCheck = 0
  }
}

// Export singleton instance
export const mentionProcessor = new MentionProcessorService()

/**
 * Process mentions in user input
 * This is the main API for the mention processor
 */
export const processMentions = (input: string) => 
  mentionProcessor.processMentions(input)

/**
 * Clear mention processor caches
 */
export const clearMentionCache = () =>
  mentionProcessor.clearCache()
