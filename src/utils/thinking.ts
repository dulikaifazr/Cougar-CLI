import { last } from 'lodash-es'
import type { Message } from '@query'
import { getLastAssistantMessageId } from './messages'
import { ThinkTool } from '@tools/ThinkTool/ThinkTool'
import { USE_BEDROCK, USE_VERTEX, getModelManager } from './model'

export async function getMaxThinkingTokens(
  messages: Message[],
): Promise<number> {
  if (process.env.MAX_THINKING_TOKENS) {
    const tokens = parseInt(process.env.MAX_THINKING_TOKENS, 10)
    return tokens
  }

  if (await ThinkTool.isEnabled()) {
    return 0
  }

  const lastMessage = last(messages)
  if (
    lastMessage?.type !== 'user' ||
    typeof lastMessage.message.content !== 'string'
  ) {
    return 0
  }

  const content = lastMessage.message.content.toLowerCase()
  if (
    content.includes('think harder') ||
    content.includes('think intensely') ||
    content.includes('think longer') ||
    content.includes('think really hard') ||
    content.includes('think super hard') ||
    content.includes('think very hard') ||
    content.includes('ultrathink')
  ) {
    return 32_000 - 1
  }

  if (
    content.includes('think about it') ||
    content.includes('think a lot') ||
    content.includes('think hard') ||
    content.includes('think more') ||
    content.includes('megathink')
  ) {
    return 10_000
  }

  if (content.includes('think')) {
    return 4_000
  }

  return 0
}

export async function getReasoningEffort(
  modelProfile: any,
  messages: Message[],
): Promise<'low' | 'medium' | 'high' | null> {
  const thinkingTokens = await getMaxThinkingTokens(messages)

  // Get reasoning effort from ModelProfile first, then fallback to config
  let reasoningEffort: 'low' | 'medium' | 'high' | undefined
  if (modelProfile?.reasoningEffort) {
    reasoningEffort = modelProfile.reasoningEffort
  } else {
    // 🔧 Fix: Use ModelManager fallback instead of legacy config
    const modelManager = getModelManager()
    const fallbackProfile = modelManager.getModel('main')
    reasoningEffort = (fallbackProfile?.reasoningEffort === 'minimal' ? 'low' : fallbackProfile?.reasoningEffort) || 'medium'
  }

  const maxEffort =
    reasoningEffort === 'high'
      ? 2
      : reasoningEffort === 'medium'
        ? 1
        : reasoningEffort === 'low'
          ? 0
          : null
  if (!maxEffort) {
    return null
  }

  let effort = 0
  if (thinkingTokens < 10_000) {
    effort = 0
  } else if (thinkingTokens >= 10_000 && thinkingTokens < 30_000) {
    effort = 1
  } else {
    effort = 2
  }

  if (effort > maxEffort) {
    return maxEffort === 2 ? 'high' : maxEffort === 1 ? 'medium' : 'low'
  }

  return effort === 2 ? 'high' : effort === 1 ? 'medium' : 'low'
}
