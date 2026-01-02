// Type definitions for conversation and message functionality
// Used by debugLogger and other conversation-related utilities

import { UUID } from 'crypto'
import type { MessageParam } from '@anthropic-ai/sdk/resources/index.mjs'
import type { Message as APIAssistantMessage } from '@anthropic-ai/sdk/resources/index.mjs'

/**
 * Base message interface used throughout the conversation system
 * This is a union type that matches the Message type from query.ts
 */
export type Message = UserMessage | AssistantMessage | ProgressMessage

/**
 * User message structure
 */
export interface UserMessage {
  message: MessageParam
  type: 'user'
  uuid: UUID
  toolUseResult?: any // FullToolUseResult type
  options?: {
    isKodingRequest?: boolean
    kodingContext?: string
  }
}

/**
 * Assistant message structure
 */
export interface AssistantMessage {
  costUSD: number
  durationMs: number
  message: APIAssistantMessage
  type: 'assistant'
  uuid: UUID
  isApiErrorMessage?: boolean
}

/**
 * Progress message structure for tool execution
 */
export interface ProgressMessage {
  content: AssistantMessage
  normalizedMessages: any[] // NormalizedMessage type
  siblingToolUseIDs: Set<string>
  tools: any[] // Tool type
  toolUseID: string
  type: 'progress'
  uuid: UUID
}