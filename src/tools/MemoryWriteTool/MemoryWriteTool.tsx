import { mkdirSync, writeFileSync } from 'fs'
import { Box, Text } from 'ink'
import { dirname, join } from 'path'
import * as React from 'react'
import { z } from 'zod'
import { FallbackToolUseRejectedMessage } from '@components/FallbackToolUseRejectedMessage'
import { Tool } from '@tool'
import { MEMORY_DIR } from '@utils/env'
import { resolveAgentId } from '@utils/agentStorage'
import { recordFileEdit } from '@services/fileFreshness'
import { DESCRIPTION, PROMPT } from './prompt'

const inputSchema = z.strictObject({
  file_path: z.string().describe('Path to the memory file to write'),
  content: z.string().describe('Content to write to the file'),
})

export const MemoryWriteTool = {
  name: 'MemoryWrite',
  async description() {
    return DESCRIPTION
  },
  async prompt() {
    return PROMPT
  },
  inputSchema,
  userFacingName() {
    return 'Write Memory'
  },
  async isEnabled() {
    // TODO: Gate with a setting or feature flag
    return false
  },
  isReadOnly() {
    return false
  },
  isConcurrencySafe() {
    return false // MemoryWrite modifies state, not safe for concurrent execution
  },
  needsPermissions() {
    return false
  },
  renderResultForAssistant(content) {
    return content
  },
  renderToolUseMessage(input) {
    return Object.entries(input)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join(', ')
  },
  renderToolUseRejectedMessage() {
    return <FallbackToolUseRejectedMessage />
  },
  renderToolResultMessage() {
    return (
      <Box justifyContent="space-between" overflowX="hidden" width="100%">
        <Box flexDirection="row">
          <Text>{'  '}⎿ Updated memory</Text>
        </Box>
      </Box>
    )
  },
  async validateInput({ file_path }, context) {
    const agentId = resolveAgentId(context?.agentId)
    const agentMemoryDir = join(MEMORY_DIR, 'agents', agentId)
    const fullPath = join(agentMemoryDir, file_path)
    if (!fullPath.startsWith(agentMemoryDir)) {
      return { result: false, message: 'Invalid memory file path' }
    }
    return { result: true }
  },
  async *call({ file_path, content }, context) {
    const agentId = resolveAgentId(context?.agentId)
    const agentMemoryDir = join(MEMORY_DIR, 'agents', agentId)
    const fullPath = join(agentMemoryDir, file_path)
    mkdirSync(dirname(fullPath), { recursive: true })
    writeFileSync(fullPath, content, 'utf-8')

    // Record Agent edit operation for file freshness tracking
    recordFileEdit(fullPath, content)

    yield {
      type: 'result',
      data: 'Saved',
      resultForAssistant: 'Saved',
    }
  },
} satisfies Tool<typeof inputSchema, string>
