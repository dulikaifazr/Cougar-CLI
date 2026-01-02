/**
 * GPT-5 Responses API state management
 * Manages previous_response_id for conversation continuity and reasoning context reuse
 */

interface ConversationState {
  previousResponseId?: string
  lastUpdate: number
}

class ResponseStateManager {
  private conversationStates = new Map<string, ConversationState>()
  
  // Cache cleanup after 1 hour of inactivity
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000
  
  constructor() {
    // Periodic cleanup of stale conversations
    setInterval(() => {
      this.cleanup()
    }, this.CLEANUP_INTERVAL)
  }
  
  /**
   * Set the previous response ID for a conversation
   */
  setPreviousResponseId(conversationId: string, responseId: string): void {
    this.conversationStates.set(conversationId, {
      previousResponseId: responseId,
      lastUpdate: Date.now()
    })
  }
  
  /**
   * Get the previous response ID for a conversation
   */
  getPreviousResponseId(conversationId: string): string | undefined {
    const state = this.conversationStates.get(conversationId)
    if (state) {
      // Update last access time
      state.lastUpdate = Date.now()
      return state.previousResponseId
    }
    return undefined
  }
  
  /**
   * Clear state for a conversation
   */
  clearConversation(conversationId: string): void {
    this.conversationStates.delete(conversationId)
  }
  
  /**
   * Clear all conversation states
   */
  clearAll(): void {
    this.conversationStates.clear()
  }
  
  /**
   * Clean up stale conversations
   */
  private cleanup(): void {
    const now = Date.now()
    for (const [conversationId, state] of this.conversationStates.entries()) {
      if (now - state.lastUpdate > this.CLEANUP_INTERVAL) {
        this.conversationStates.delete(conversationId)
      }
    }
  }
  
  /**
   * Get current state size (for debugging/monitoring)
   */
  getStateSize(): number {
    return this.conversationStates.size
  }
}

// Singleton instance
export const responseStateManager = new ResponseStateManager()

/**
 * Helper to generate conversation ID from context
 */
export function getConversationId(agentId?: string, messageId?: string): string {
  // Use agentId as primary identifier, fallback to messageId or timestamp
  return agentId || messageId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}