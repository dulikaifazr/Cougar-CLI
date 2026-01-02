import { Box, Text } from 'ink'
import React from 'react'
import { z } from 'zod'
import { Cost } from '@components/Cost'
import { FallbackToolUseRejectedMessage } from '@components/FallbackToolUseRejectedMessage'
import { Tool, ToolUseContext } from '@tool'
import { DESCRIPTION, TOOL_NAME_FOR_PROMPT } from './prompt'
import { SearchResult, searchProviders } from './searchProviders'

const inputSchema = z.strictObject({
  query: z.string().describe('The search query'),
})

type Input = z.infer<typeof inputSchema>
type Output = {
  durationMs: number
  results: SearchResult[]
}


export const WebSearchTool = {
  name: TOOL_NAME_FOR_PROMPT,
  async description() {
    return DESCRIPTION
  },
  userFacingName: () => 'Web Search',
  inputSchema,
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  async isEnabled() {
    return true
  },
  needsPermissions() {
    return false
  },
  async prompt() {
    return DESCRIPTION
  },
  renderToolUseMessage({ query }: Input) {
    return `Searching for: "${query}" using DuckDuckGo`
  },
  renderToolUseRejectedMessage() {
    return <FallbackToolUseRejectedMessage />
  },
  renderToolResultMessage(output: Output) {
    return (
      <Box justifyContent="space-between" width="100%">
        <Box flexDirection="row">
          <Text>&nbsp;&nbsp;⎿ &nbsp;Found </Text>
          <Text bold>{output.results.length} </Text>
          <Text>
            {output.results.length === 1 ? 'result' : 'results'} using DuckDuckGo
          </Text>
        </Box>
        <Cost costUSD={0} durationMs={output.durationMs} debug={false} />
      </Box>
    )
  },
  renderResultForAssistant(output: Output) {
    if (output.results.length === 0) {
      return `No results found using DuckDuckGo.`
    }
    
    let result = `Found ${output.results.length} search results using DuckDuckGo:\n\n`
    
    output.results.forEach((item, index) => {
      result += `${index + 1}. **${item.title}**\n`
      result += `   ${item.snippet}\n`
      result += `   Link: ${item.link}\n\n`
    })
    
    result += `You can reference these results to provide current, accurate information to the user.`
    return result
  },
  async *call({ query }: Input, {}: ToolUseContext) {
    const start = Date.now()

    try {
      const searchResults = await searchProviders.duckduckgo.search(query)
      
      const output: Output = {
        results: searchResults,
        durationMs: Date.now() - start,
      }

      yield {
        type: 'result' as const,
        resultForAssistant: this.renderResultForAssistant(output),
        data: output,
      }
    } catch (error: any) {
      const output: Output = {
        results: [],
        durationMs: Date.now() - start,
      }
      yield {
        type: 'result' as const,
        resultForAssistant: `An error occurred during web search with DuckDuckGo: ${error.message}`,
        data: output,
      }
    }
  },
} satisfies Tool<typeof inputSchema, Output>
