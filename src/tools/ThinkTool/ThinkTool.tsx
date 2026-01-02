import { z } from 'zod'
import React from 'react'
import { Text } from 'ink'
import { Tool } from '@tool'
import { DESCRIPTION, PROMPT } from './prompt'
import { getTheme } from '@utils/theme'
import { MessageResponse } from '@components/MessageResponse'
import { USE_BEDROCK, USE_VERTEX } from '@utils/model'

const thinkToolSchema = z.object({
  thought: z.string().describe('Your thoughts.'),
})

export const ThinkTool = {
  name: 'Think',
  userFacingName: () => 'Think',
  description: async () => DESCRIPTION,
  inputSchema: thinkToolSchema,
  isEnabled: async () => Boolean(process.env.THINK_TOOL),
  isReadOnly: () => true,
  isConcurrencySafe: () => true, // ThinkTool is read-only, safe for concurrent execution
  needsPermissions: () => false,
  prompt: async () => PROMPT,

  async *call(input, { messageId }) {
    

    yield {
      type: 'result',
      resultForAssistant: 'Your thought has been logged.',
      data: { thought: input.thought },
    }
  },

  // This is never called -- it's special-cased in AssistantToolUseMessage
  renderToolUseMessage(input) {
    return input.thought
  },

  renderToolUseRejectedMessage() {
    return (
      <MessageResponse children={<Text color={getTheme().error}>Thought cancelled</Text>} />
    )
  },

  renderResultForAssistant: () => 'Your thought has been logged.',
} satisfies Tool<typeof thinkToolSchema>
