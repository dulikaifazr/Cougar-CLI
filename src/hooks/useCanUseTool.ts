import React, { useCallback } from 'react'
import { hasPermissionsToUseTool } from '@permissions'
import { BashTool, inputSchema } from '@tools/BashTool/BashTool'
import { getCommandSubcommandPrefix } from '@utils/commands'
import { REJECT_MESSAGE } from '@utils/messages'
import type { Tool as ToolType, ToolUseContext } from '@tool'
import { AssistantMessage } from '@query'
import { ToolUseConfirm } from '@components/permissions/PermissionRequest'
import { AbortError } from '@utils/errors'
import { logError } from '@utils/log'

type SetState<T> = React.Dispatch<React.SetStateAction<T>>

export type CanUseToolFn = (
  tool: ToolType,
  input: { [key: string]: unknown },
  toolUseContext: ToolUseContext,
  assistantMessage: AssistantMessage,
) => Promise<{ result: true } | { result: false; message: string }>

function useCanUseTool(
  setToolUseConfirm: SetState<ToolUseConfirm | null>,
): CanUseToolFn {
  return useCallback<CanUseToolFn>(
    async (tool, input, toolUseContext, assistantMessage) => {
      return new Promise(resolve => {
        function logCancelledEvent() {}

        function resolveWithCancelledAndAbortAllToolCalls() {
          resolve({
            result: false,
            message: REJECT_MESSAGE,
          })
          // Trigger a synthetic assistant message in query(), to cancel
          // any other pending tool uses and stop further requests to the
          // API and wait for user input.
          toolUseContext.abortController.abort()
        }

        if (toolUseContext.abortController.signal.aborted) {
          logCancelledEvent()
          resolveWithCancelledAndAbortAllToolCalls()
          return
        }

        return hasPermissionsToUseTool(
          tool,
          input,
          toolUseContext,
          assistantMessage,
        )
          .then(async result => {
            // Has permissions to use tool, granted in config
            if (result.result) {
              
              resolve({ result: true })
              return
            }

            const [description, commandPrefix] = await Promise.all([
              tool.description(input as never),
              tool === BashTool
                ? getCommandSubcommandPrefix(
                    inputSchema.parse(input).command, // already validated upstream, so ok to parse (as opposed to safeParse)
                    toolUseContext.abortController.signal,
                  )
                : Promise.resolve(null),
            ])

            if (toolUseContext.abortController.signal.aborted) {
              logCancelledEvent()
              resolveWithCancelledAndAbortAllToolCalls()
              return
            }

            // Does not have permissions to use tool, ask the user
            setToolUseConfirm({
              assistantMessage,
              tool,
              description,
              input,
              commandPrefix,
              riskScore: null,
              onAbort() {
                logCancelledEvent()
                resolveWithCancelledAndAbortAllToolCalls()
              },
              onAllow(type) {
                if (type === 'permanent') {
                } else {
                }
                resolve({ result: true })
              },
              onReject() {
                resolveWithCancelledAndAbortAllToolCalls()
              },
            })
          })
          .catch(error => {
            if (error instanceof AbortError) {
              logCancelledEvent()
              resolveWithCancelledAndAbortAllToolCalls()
            } else {
              logError(error)
            }
          })
      })
    },
    [setToolUseConfirm],
  )
}

export default useCanUseTool
