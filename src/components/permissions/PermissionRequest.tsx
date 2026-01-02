import { useInput } from 'ink'
import * as React from 'react'
import { Tool } from '@tool'
import { AssistantMessage } from '@query'
import { FileEditTool } from '@tools/FileEditTool/FileEditTool'
import { FileWriteTool } from '@tools/FileWriteTool/FileWriteTool'
import { BashTool } from '@tools/BashTool/BashTool'
import { FileEditPermissionRequest } from './FileEditPermissionRequest/FileEditPermissionRequest'
import { BashPermissionRequest } from './BashPermissionRequest/BashPermissionRequest'
import { FallbackPermissionRequest } from './FallbackPermissionRequest'
import { useNotifyAfterTimeout } from '@hooks/useNotifyAfterTimeout'
import { FileWritePermissionRequest } from './FileWritePermissionRequest/FileWritePermissionRequest'
import { type CommandSubcommandPrefixResult } from '@utils/commands'
import { FilesystemPermissionRequest } from './FilesystemPermissionRequest/FilesystemPermissionRequest'
import { NotebookEditTool } from '@tools/NotebookEditTool/NotebookEditTool'
import { GlobTool } from '@tools/GlobTool/GlobTool'
import { GrepTool } from '@tools/GrepTool/GrepTool'
import { LSTool } from '@tools/lsTool/lsTool'
import { FileReadTool } from '@tools/FileReadTool/FileReadTool'
import { NotebookReadTool } from '@tools/NotebookReadTool/NotebookReadTool'
import { PRODUCT_NAME } from '@constants/product'

function permissionComponentForTool(tool: Tool) {
  switch (tool) {
    case FileEditTool:
      return FileEditPermissionRequest
    case FileWriteTool:
      return FileWritePermissionRequest
    case BashTool:
      return BashPermissionRequest
    case GlobTool:
    case GrepTool:
    case LSTool:
    case FileReadTool:
    case NotebookReadTool:
    case NotebookEditTool:
      return FilesystemPermissionRequest
    default:
      return FallbackPermissionRequest
  }
}

export type PermissionRequestProps = {
  toolUseConfirm: ToolUseConfirm
  onDone(): void
  verbose: boolean
}

export function toolUseConfirmGetPrefix(
  toolUseConfirm: ToolUseConfirm,
): string | null {
  return (
    (toolUseConfirm.commandPrefix &&
      !(toolUseConfirm.commandPrefix as any).commandInjectionDetected &&
      (toolUseConfirm.commandPrefix as any).commandPrefix) ||
    null
  )
}

export type ToolUseConfirm = {
  assistantMessage: AssistantMessage
  tool: Tool
  description: string
  input: { [key: string]: unknown }
  commandPrefix: CommandSubcommandPrefixResult | null
  // TODO: remove riskScore from ToolUseConfirm
  riskScore: number | null
  onAbort(): void
  onAllow(type: 'permanent' | 'temporary'): void
  onReject(): void
}

// TODO: Move this to Tool.renderPermissionRequest
export function PermissionRequest({
  toolUseConfirm,
  onDone,
  verbose,
}: PermissionRequestProps): React.ReactNode {
  // Handle Ctrl+C
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      onDone()
      toolUseConfirm.onReject()
    }
  })

  const toolName = toolUseConfirm.tool.userFacingName?.() || 'Tool'
  useNotifyAfterTimeout(
    `${PRODUCT_NAME} needs your permission to use ${toolName}`,
  )

  const PermissionComponent = permissionComponentForTool(toolUseConfirm.tool)

  return (
    <PermissionComponent
      toolUseConfirm={toolUseConfirm}
      onDone={onDone}
      verbose={verbose}
    />
  )
}
