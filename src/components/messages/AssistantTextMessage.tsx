import { TextBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import React from 'react'
import { AssistantBashOutputMessage } from './AssistantBashOutputMessage'
import { AssistantLocalCommandOutputMessage } from './AssistantLocalCommandOutputMessage'
import { getTheme } from '@utils/theme'
import { Box, Text } from 'ink'
import { Cost } from '@components/Cost'
import {
  API_ERROR_MESSAGE_PREFIX,
  CREDIT_BALANCE_TOO_LOW_ERROR_MESSAGE,
  INVALID_API_KEY_ERROR_MESSAGE,
  PROMPT_TOO_LONG_ERROR_MESSAGE,
} from '@services/claude'
import {
  CANCEL_MESSAGE,
  INTERRUPT_MESSAGE,
  INTERRUPT_MESSAGE_FOR_TOOL_USE,
  isEmptyMessageText,
  NO_RESPONSE_REQUESTED,
} from '@utils/messages'
import { BLACK_CIRCLE } from '@constants/figures'
import { applyMarkdown } from '@utils/markdown'
import { useTerminalSize } from '@hooks/useTerminalSize'

type Props = {
  param: TextBlockParam
  costUSD: number
  durationMs: number
  debug: boolean
  addMargin: boolean
  shouldShowDot: boolean
  verbose?: boolean
  width?: number | string
}

export function AssistantTextMessage({
  param: { text },
  costUSD,
  durationMs,
  debug,
  addMargin,
  shouldShowDot,
  verbose,
}: Props): React.ReactNode {
  const { columns } = useTerminalSize()
  if (isEmptyMessageText(text)) {
    return null
  }

  // Show bash output
  if (text.startsWith('<bash-stdout') || text.startsWith('<bash-stderr')) {
    return <AssistantBashOutputMessage content={text} verbose={verbose} />
  }

  // Show command output
  if (
    text.startsWith('<local-command-stdout') ||
    text.startsWith('<local-command-stderr')
  ) {
    return <AssistantLocalCommandOutputMessage content={text} />
  }

  if (text.startsWith(API_ERROR_MESSAGE_PREFIX)) {
    return (
      <Text>
        &nbsp;&nbsp;⎿ &nbsp;
        <Text color={getTheme().error}>
          {text === API_ERROR_MESSAGE_PREFIX
            ? `${API_ERROR_MESSAGE_PREFIX}: Please wait a moment and try again.`
            : text}
        </Text>
      </Text>
    )
  }

  switch (text) {
    // Local JSX commands don't need a response, but we still want the assistant to see them
    // Tool results render their own interrupt messages
    case NO_RESPONSE_REQUESTED:
    case INTERRUPT_MESSAGE_FOR_TOOL_USE:
      return null

    case INTERRUPT_MESSAGE:
    case CANCEL_MESSAGE:
      return (
        <Text>
          &nbsp;&nbsp;⎿ &nbsp;
          <Text color={getTheme().error}>Interrupted by user</Text>
        </Text>
      )

    case PROMPT_TOO_LONG_ERROR_MESSAGE:
      return (
        <Text>
          &nbsp;&nbsp;⎿ &nbsp;
          <Text color={getTheme().error}>
            Context low &middot; Run /compact to compact & continue
          </Text>
        </Text>
      )

    case CREDIT_BALANCE_TOO_LOW_ERROR_MESSAGE:
      return (
        <Text>
          &nbsp;&nbsp;⎿ &nbsp;
          <Text color={getTheme().error}>
            Credit balance too low &middot; Add funds:
            https://console.anthropic.com/settings/billing
          </Text>
        </Text>
      )

    case INVALID_API_KEY_ERROR_MESSAGE:
      return (
        <Text>
          &nbsp;&nbsp;⎿ &nbsp;
          <Text color={getTheme().error}>{INVALID_API_KEY_ERROR_MESSAGE}</Text>
        </Text>
      )

    default:
      return (
        <Box
          alignItems="flex-start"
          flexDirection="row"
          justifyContent="space-between"
          marginTop={addMargin ? 1 : 0}
          width="100%"
        >
          <Box flexDirection="row">
            {shouldShowDot && (
              <Box minWidth={2}>
                <Text color={getTheme().text}>{BLACK_CIRCLE}</Text>
              </Box>
            )}
            <Box flexDirection="column" width={columns - 6}>
              <Text>{applyMarkdown(text)}</Text>
            </Box>
          </Box>
          <Cost costUSD={costUSD} durationMs={durationMs} debug={debug} />
        </Box>
      )
  }
}
