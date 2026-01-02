import { Box, Text } from 'ink'
import React from 'react'
import { z } from 'zod'
import fetch from 'node-fetch'
import { Cost } from '@components/Cost'
import { FallbackToolUseRejectedMessage } from '@components/FallbackToolUseRejectedMessage'
import { Tool, ToolUseContext } from '@tool'
import { DESCRIPTION, TOOL_NAME_FOR_PROMPT } from './prompt'
import { convertHtmlToMarkdown } from './htmlToMarkdown'
import { urlCache } from './cache'
import { queryQuick } from '@services/claude'

const inputSchema = z.strictObject({
  url: z.string().url().describe('The URL to fetch content from'),
  prompt: z.string().describe('The prompt to run on the fetched content'),
})

type Input = z.infer<typeof inputSchema>
type Output = {
  url: string
  fromCache: boolean
  aiAnalysis: string
}

function normalizeUrl(url: string): string {
  // Auto-upgrade HTTP to HTTPS
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://')
  }
  return url
}

export const URLFetcherTool = {
  name: TOOL_NAME_FOR_PROMPT,
  async description() {
    return DESCRIPTION
  },
  userFacingName: () => 'URL Fetcher',
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
  renderToolUseMessage({ url, prompt }: Input) {
    return `Fetching content from ${url} and analyzing with prompt: "${prompt}"`
  },
  renderToolUseRejectedMessage() {
    return <FallbackToolUseRejectedMessage />
  },
  renderToolResultMessage(output: Output) {
    const statusText = output.fromCache ? 'from cache' : 'fetched'
    
    return (
      <Box justifyContent="space-between" width="100%">
        <Box flexDirection="row">
          <Text>&nbsp;&nbsp;⎿ &nbsp;Content </Text>
          <Text bold>{statusText} </Text>
          <Text>and analyzed</Text>
        </Box>
        <Cost costUSD={0} durationMs={0} debug={false} />
      </Box>
    )
  },
  renderResultForAssistant(output: Output) {
    if (!output.aiAnalysis.trim()) {
      return `No content could be analyzed from URL: ${output.url}`
    }
    
    return output.aiAnalysis
  },
  async *call({ url, prompt }: Input, {}: ToolUseContext) {
    const normalizedUrl = normalizeUrl(url)
    
    try {
      let content: string
      let fromCache = false

      // Check cache first
      const cachedContent = urlCache.get(normalizedUrl)
      if (cachedContent) {
        content = cachedContent
        fromCache = true
      } else {
        // Fetch from URL with AbortController for timeout
        const abortController = new AbortController()
        const timeout = setTimeout(() => abortController.abort(), 30000)
        
        const response = await fetch(normalizedUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; URLFetcher/1.0)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
          },
          signal: abortController.signal,
          redirect: 'follow',
        })
        
        clearTimeout(timeout)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const contentType = response.headers.get('content-type') || ''
        if (!contentType.includes('text/') && !contentType.includes('application/')) {
          throw new Error(`Unsupported content type: ${contentType}`)
        }

        const html = await response.text()
        content = convertHtmlToMarkdown(html)
        
        // Cache the result
        urlCache.set(normalizedUrl, content)
        fromCache = false
      }

      // Truncate content if too large (keep within reasonable token limits)
      const maxContentLength = 50000 // ~15k tokens approximately
      const truncatedContent = content.length > maxContentLength 
        ? content.substring(0, maxContentLength) + '\n\n[Content truncated due to length]'
        : content

      // AI Analysis - always performed fresh, even with cached content
      const systemPrompt = [
        'You are analyzing web content based on a user\'s specific request.',
        'The content has been extracted from a webpage and converted to markdown.',
        'Provide a focused response that directly addresses the user\'s prompt.',
      ]

      const userPrompt = `Here is the content from ${normalizedUrl}:

${truncatedContent}

User request: ${prompt}`

      const aiResponse = await queryQuick({
        systemPrompt,
        userPrompt,
        enablePromptCaching: false,
      })

      const output: Output = {
        url: normalizedUrl,
        fromCache,
        aiAnalysis: aiResponse.message.content[0]?.text || 'Unable to analyze content',
      }

      yield {
        type: 'result' as const,
        resultForAssistant: this.renderResultForAssistant(output),
        data: output,
      }
    } catch (error: any) {
      const output: Output = {
        url: normalizedUrl,
        fromCache: false,
        aiAnalysis: '',
      }
      
      yield {
        type: 'result' as const,
        resultForAssistant: `Error processing URL ${normalizedUrl}: ${error.message}`,
        data: output,
      }
    }
  },
} satisfies Tool<typeof inputSchema, Output>