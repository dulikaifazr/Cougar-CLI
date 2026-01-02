import fs from 'fs/promises'
import { logError } from './log'
import { Tool } from '@tool'

/**
 * Load messages from a log file
 * @param logPath Path to the log file
 * @param tools Available tools for deserializing tool usage
 * @returns Array of deserialized messages
 */
export async function loadMessagesFromLog(
  logPath: string,
  tools: Tool[],
): Promise<any[]> {
  try {
    const content = await fs.readFile(logPath, 'utf-8')
    const messages = JSON.parse(content)
    return deserializeMessages(messages, tools)
  } catch (error) {
    logError(`Failed to load messages from ${logPath}: ${error}`)
    throw new Error(`Failed to load messages from log: ${error}`)
  }
}

/**
 * Deserialize messages from a saved format, reconnecting any tool references
 * @param messages The serialized message array
 * @param tools Available tools to reconnect
 * @returns Deserialized messages with reconnected tool references
 */
export function deserializeMessages(messages: any[], tools: Tool[]): any[] {
  // Map of tool names to actual tool instances for reconnection
  const toolMap = new Map(tools.map(tool => [tool.name, tool]))

  return messages.map(message => {
    // Deep clone the message to avoid mutation issues
    const clonedMessage = JSON.parse(JSON.stringify(message))

    // If the message has tool calls, reconnect them to actual tool instances
    if (clonedMessage.toolCalls) {
      clonedMessage.toolCalls = clonedMessage.toolCalls.map((toolCall: any) => {
        // Reconnect tool reference if it exists
        if (toolCall.tool && typeof toolCall.tool === 'string') {
          const actualTool = toolMap.get(toolCall.tool)
          if (actualTool) {
            toolCall.tool = actualTool
          }
        }
        return toolCall
      })
    }

    return clonedMessage
  })
}
