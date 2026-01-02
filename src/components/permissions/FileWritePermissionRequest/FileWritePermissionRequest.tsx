import { Box, Text } from 'ink'
import React, { useMemo } from 'react'
import { Select } from '@components/CustomSelect/select'
import { basename, extname } from 'path'
import { getTheme } from '@utils/theme'
import {
  PermissionRequestTitle,
  textColorForRiskScore,
} from '@components/permissions/PermissionRequestTitle'
import { logUnaryEvent } from '@utils/unaryLogging'
import { env } from '@utils/env'
import { savePermission } from '@permissions'
import {
  type ToolUseConfirm,
  toolUseConfirmGetPrefix,
} from '@components/permissions/PermissionRequest'
import { existsSync } from 'fs'
import chalk from 'chalk'
import {
  UnaryEvent,
  usePermissionRequestLogging,
} from '@hooks/usePermissionRequestLogging'
import { FileWriteToolDiff } from './FileWriteToolDiff'
import { useTerminalSize } from '@hooks/useTerminalSize'

type Props = {
  toolUseConfirm: ToolUseConfirm
  onDone(): void
  verbose: boolean
}

export function FileWritePermissionRequest({
  toolUseConfirm,
  onDone,
  verbose,
}: Props): React.ReactNode {
  const { file_path, content } = toolUseConfirm.input as {
    file_path: string
    content: string
  }
  const fileExists = useMemo(() => existsSync(file_path), [file_path])
  const unaryEvent = useMemo<UnaryEvent>(
    () => ({
      completion_type: 'write_file_single',
      language_name: extractLanguageName(file_path),
    }),
    [file_path],
  )
  const { columns } = useTerminalSize()
  usePermissionRequestLogging(toolUseConfirm, unaryEvent)

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={textColorForRiskScore(toolUseConfirm.riskScore)}
      marginTop={1}
      paddingLeft={1}
      paddingRight={1}
      paddingBottom={1}
    >
      <PermissionRequestTitle
        title={`${fileExists ? 'Edit' : 'Create'} file`}
        riskScore={toolUseConfirm.riskScore}
      />
      <Box flexDirection="column">
        <FileWriteToolDiff
          file_path={file_path}
          content={content}
          verbose={verbose}
          width={columns - 12}
        />
      </Box>
      <Box flexDirection="column">
        <Text>
          Do you want to {fileExists ? 'make this edit to' : 'create'}{' '}
          <Text bold>{basename(file_path)}</Text>?
        </Text>
        <Select
          options={[
            {
              label: 'Yes',
              value: 'yes',
            },
            {
              label: "Yes, and don't ask again this session",
              value: 'yes-dont-ask-again',
            },
            {
              label: `No, and provide instructions (${chalk.bold.hex(getTheme().warning)('esc')})`,
              value: 'no',
            },
          ]}
          onChange={newValue => {
            switch (newValue) {
              case 'yes':
                extractLanguageName(file_path).then(language => {
                  logUnaryEvent({
                    completion_type: 'write_file_single',
                    event: 'accept',
                    metadata: {
                      language_name: language,
                      message_id: toolUseConfirm.assistantMessage.message.id,
                      platform: env.platform,
                    },
                  })
                })
                toolUseConfirm.onAllow('temporary')
                onDone()
                break
              case 'yes-dont-ask-again':
                extractLanguageName(file_path).then(language => {
                  logUnaryEvent({
                    completion_type: 'write_file_single',
                    event: 'accept',
                    metadata: {
                      language_name: language,
                      message_id: toolUseConfirm.assistantMessage.message.id,
                      platform: env.platform,
                    },
                  })
                })
                savePermission(
                  toolUseConfirm.tool,
                  toolUseConfirm.input,
                  toolUseConfirmGetPrefix(toolUseConfirm),
                ).then(() => {
                  toolUseConfirm.onAllow('permanent')
                  onDone()
                })
                break
              case 'no':
                extractLanguageName(file_path).then(language => {
                  logUnaryEvent({
                    completion_type: 'write_file_single',
                    event: 'reject',
                    metadata: {
                      language_name: language,
                      message_id: toolUseConfirm.assistantMessage.message.id,
                      platform: env.platform,
                    },
                  })
                })
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

async function extractLanguageName(file_path: string): Promise<string> {
  const ext = extname(file_path)
  if (!ext) {
    return 'unknown'
  }
  const Highlight = (await import('highlight.js')) as unknown as {
    default: { getLanguage(ext: string): { name: string | undefined } }
  }
  return Highlight.default.getLanguage(ext.slice(1))?.name ?? 'unknown'
}
