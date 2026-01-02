import { Box, Text } from 'ink'
import React, { useMemo } from 'react'
import { UnaryEvent } from '@hooks/usePermissionRequestLogging'
import { savePermission } from '@permissions'
import { BashTool } from '@tools/BashTool/BashTool'
import { getTheme } from '@utils/theme'
import { usePermissionRequestLogging } from '@components/permissions/hooks'
import {
  type ToolUseConfirm,
  toolUseConfirmGetPrefix,
} from '@components/permissions/PermissionRequest'
import { PermissionRequestTitle } from '@components/permissions/PermissionRequestTitle'
import { logUnaryPermissionEvent } from '@components/permissions/utils'
import { Select } from '@components/CustomSelect/select'
import { toolUseOptions } from '@components/permissions/toolUseOptions'

type Props = {
  toolUseConfirm: ToolUseConfirm
  onDone(): void
}

export function BashPermissionRequest({
  toolUseConfirm,
  onDone,
}: Props): React.ReactNode {
  const theme = getTheme()

  // ok to use parse since we've already validated args earliers
  const { command } = BashTool.inputSchema.parse(toolUseConfirm.input)

  const unaryEvent = useMemo<UnaryEvent>(
    () => ({ completion_type: 'tool_use_single', language_name: 'none' }),
    [],
  )

  usePermissionRequestLogging(toolUseConfirm, unaryEvent)

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.permission}
      marginTop={1}
      paddingLeft={1}
      paddingRight={1}
      paddingBottom={1}
    >
      <PermissionRequestTitle
        title="Bash command"
        riskScore={toolUseConfirm.riskScore}
      />
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text>{BashTool.renderToolUseMessage({ command })}</Text>
        <Text color={theme.secondaryText}>{toolUseConfirm.description}</Text>
      </Box>

      <Box flexDirection="column">
        <Text>Do you want to proceed?</Text>
        <Select
          options={toolUseOptions({ toolUseConfirm, command })}
          onChange={newValue => {
            switch (newValue) {
              case 'yes':
                logUnaryPermissionEvent(
                  'tool_use_single',
                  toolUseConfirm,
                  'accept',
                )
                toolUseConfirm.onAllow('temporary')
                onDone()
                break
              case 'yes-dont-ask-again-prefix': {
                const prefix = toolUseConfirmGetPrefix(toolUseConfirm)
                if (prefix !== null) {
                  logUnaryPermissionEvent(
                    'tool_use_single',
                    toolUseConfirm,
                    'accept',
                  )
                  savePermission(
                    toolUseConfirm.tool,
                    toolUseConfirm.input,
                    prefix,
                  ).then(() => {
                    toolUseConfirm.onAllow('permanent')
                    onDone()
                  })
                }
                break
              }
              case 'yes-dont-ask-again-full':
                logUnaryPermissionEvent(
                  'tool_use_single',
                  toolUseConfirm,
                  'accept',
                )
                savePermission(
                  toolUseConfirm.tool,
                  toolUseConfirm.input,
                  null, // Save without prefix
                ).then(() => {
                  toolUseConfirm.onAllow('permanent')
                  onDone()
                })
                break
              case 'no':
                logUnaryPermissionEvent(
                  'tool_use_single',
                  toolUseConfirm,
                  'reject',
                )
                toolUseConfirm.onReject()
                onDone()
                break
            }
          }}
        />
      </Box>
    </Box>
  )
}
