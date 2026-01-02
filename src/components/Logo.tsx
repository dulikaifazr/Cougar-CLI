import { Box, Text, Newline } from 'ink'
import * as React from 'react'
import { getTheme } from '@utils/theme'
import { PRODUCT_NAME } from '@constants/product'
import { getGlobalConfig } from '@utils/config'
import { getCwd } from '@utils/state'
import { AsciiLogo } from './AsciiLogo'
import type { WrappedClient } from '@services/mcpClient'
import { getModelManager } from '@utils/model'

export const MIN_LOGO_WIDTH = 50

export function Logo({
  mcpClients,
  isDefaultModel = false,
}: {
  mcpClients: WrappedClient[]
  isDefaultModel?: boolean
}): React.ReactNode {
  const width = Math.max(MIN_LOGO_WIDTH, getCwd().length + 12)
  const theme = getTheme()
  const config = getGlobalConfig()

  const modelManager = getModelManager()
  const mainModelName = modelManager.getModelName('main')
  const currentModel = mainModelName || 'No model configured'
  const hasOverrides = Boolean(
    process.env.DISABLE_PROMPT_CACHING ||
      process.env.API_TIMEOUT_MS ||
      process.env.MAX_THINKING_TOKENS,
  )

  return (
    <Box flexDirection="column">
      <Box
        borderColor={theme.cougar}
        borderStyle="round"
        flexDirection="column"
        gap={1}
        paddingLeft={1}
        marginRight={2}
        width={width}
      >
        <Text>
          <Text color={theme.cougar}>✻</Text> Welcome to{' '}
          <Text bold>{PRODUCT_NAME}</Text> <Text>research preview!</Text>
        </Text>
        {/* <AsciiLogo /> */}

        <>
          <Box paddingLeft={2} flexDirection="column" gap={1}>
            <Text color={theme.secondaryText} italic>
              /help for help
            </Text>
            <Text color={theme.secondaryText}>cwd: {getCwd()}</Text>
          </Box>

          {hasOverrides && (
            <Box
              borderColor={theme.secondaryBorder}
              borderStyle="single"
              borderBottom={false}
              borderLeft={false}
              borderRight={false}
              borderTop={true}
              flexDirection="column"
              marginLeft={2}
              marginRight={1}
              paddingTop={1}
            >
              <Box marginBottom={1}>
                <Text color={theme.secondaryText}>Overrides (via env):</Text>
              </Box>
              {process.env.DISABLE_PROMPT_CACHING ? (
                <Text color={theme.secondaryText}>
                  • Prompt caching:{' '}
                  <Text color={theme.error} bold>
                    off
                  </Text>
                </Text>
              ) : null}
              {process.env.API_TIMEOUT_MS ? (
                <Text color={theme.secondaryText}>
                  • API timeout:{' '}
                  <Text bold>{process.env.API_TIMEOUT_MS}ms</Text>
                </Text>
              ) : null}
              {process.env.MAX_THINKING_TOKENS ? (
                <Text color={theme.secondaryText}>
                  • Max thinking tokens:{' '}
                  <Text bold>{process.env.MAX_THINKING_TOKENS}</Text>
                </Text>
              ) : null}
            </Box>
          )}
        </>
        {mcpClients.length ? (
          <Box
            borderColor={theme.secondaryBorder}
            borderStyle="single"
            borderBottom={false}
            borderLeft={false}
            borderRight={false}
            borderTop={true}
            flexDirection="column"
            marginLeft={2}
            marginRight={1}
            paddingTop={1}
          >
            <Box marginBottom={1}>
              <Text color={theme.secondaryText}>MCP Servers:</Text>
            </Box>
            {mcpClients.map((client, idx) => (
              <Box key={idx} width={width - 6}>
                <Text color={theme.secondaryText}>• {client.name}</Text>
                <Box flexGrow={1} />
                <Text
                  bold
                  color={
                    client.type === 'connected' ? theme.success : theme.error
                  }
                >
                  {client.type === 'connected' ? 'connected' : 'failed'}
                </Text>
              </Box>
            ))}
          </Box>
        ) : null}
      </Box>
    </Box>
  )
}
