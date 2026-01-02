import React from 'react'
import { render } from 'ink'
import { REPL } from './REPL'
import { deserializeMessages } from '@utils/conversationRecovery'
import { LogSelector } from '@components/LogSelector'
import type { LogOption } from '@cougar-types/logs'
import { logError, getNextAvailableLogForkNumber } from '@utils/log'
import type { Tool } from '@tool'
import { Command } from '@commands'
import { isDefaultSlowAndCapableModel } from '@utils/model'

type Props = {
  commands: Command[]
  context: { unmount?: () => void }
  logs: LogOption[]
  tools: Tool[]
  verbose: boolean | undefined
}

export function ResumeConversation({
  context,
  commands,
  logs,
  tools,
  verbose,
}: Props): React.ReactNode {
  async function onSelect(index: number) {
    const log = logs[index]
    if (!log) {
      return
    }

    // Load and deserialize the messages
    try {
      context.unmount?.()
      // Start a new REPL with the loaded messages
      // Increment the fork number by 1 to generate a new transcript
      // Check if using default model before rendering
      const isDefaultModel = await isDefaultSlowAndCapableModel()

      render(
        <REPL
          messageLogName={log.date}
          initialPrompt=""
          shouldShowPromptInput={true}
          verbose={verbose}
          commands={commands}
          tools={tools}
          initialMessages={deserializeMessages(log.messages, tools)}
          initialForkNumber={getNextAvailableLogForkNumber(
            log.date,
            log.forkNumber ?? 1,
            0,
          )}
          isDefaultModel={isDefaultModel}
        />,
        {
          exitOnCtrlC: false,
        },
      )
    } catch (e) {
      logError(`Failed to load conversation: ${e}`)
      throw e
    }
  }

  return <LogSelector logs={logs} onSelect={onSelect} />
}
