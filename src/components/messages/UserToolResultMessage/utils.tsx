import { ToolUseBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import { Message } from '@query'
import { useMemo } from 'react'
import { Tool } from '@tool'
import { GlobTool } from '@tools/GlobTool/GlobTool'
import { GrepTool } from '@tools/GrepTool/GrepTool'

function getToolUseFromMessages(
  toolUseID: string,
  messages: Message[],
): ToolUseBlockParam | null {
  let toolUse: ToolUseBlockParam | null = null
  for (const message of messages) {
    if (
      message.type !== 'assistant' ||
      !Array.isArray(message.message.content)
    ) {
      continue
    }
    for (const content of message.message.content) {
      if (content.type === 'tool_use' && content.id === toolUseID) {
        toolUse = content
      }
    }
  }
  return toolUse
}

export function useGetToolFromMessages(
  toolUseID: string,
  tools: Tool[],
  messages: Message[],
) {
  return useMemo(() => {
    const toolUse = getToolUseFromMessages(toolUseID, messages)
    if (!toolUse) {
      throw new ReferenceError(
        `Tool use not found for tool_use_id ${toolUseID}`,
      )
    }
    // Hack: we don't expose GlobTool and GrepTool in getTools anymore,
    // but we still want to be able to load old transcripts.
    // TODO: Remove this when logging hits zero
    const tool = [...tools, GlobTool, GrepTool].find(
      _ => _.name === toolUse.name,
    )
    if (tool === GlobTool || tool === GrepTool) {
      
    }
    if (!tool) {
      throw new ReferenceError(`Tool not found for ${toolUse.name}`)
    }
    return { tool, toolUse }
  }, [toolUseID, messages, tools])
}
