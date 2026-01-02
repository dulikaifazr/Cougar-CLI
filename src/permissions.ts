import type { CanUseToolFn } from './hooks/useCanUseTool'
import { Tool, ToolUseContext } from './Tool'
import { BashTool, inputSchema } from './tools/BashTool/BashTool'
import { FileEditTool } from './tools/FileEditTool/FileEditTool'
import { FileWriteTool } from './tools/FileWriteTool/FileWriteTool'
import { NotebookEditTool } from './tools/NotebookEditTool/NotebookEditTool'
import { getCommandSubcommandPrefix, splitCommand } from './utils/commands'
import {
  getCurrentProjectConfig,
  saveCurrentProjectConfig,
} from '@utils/config'
import { AbortError } from './utils/errors'
import { logError } from './utils/log'
import { grantWritePermissionForOriginalDir } from './utils/permissions/filesystem'
import { getCwd } from './utils/state'
import { PRODUCT_NAME } from './constants/product'

// Commands that are known to be safe for execution
const SAFE_COMMANDS = new Set([
  'git status',
  'git diff',
  'git log',
  'git branch',
  'pwd',
  'tree',
  'date',
  'which',
])

export const bashToolCommandHasExactMatchPermission = (
  tool: Tool,
  command: string,
  allowedTools: string[],
): boolean => {
  if (SAFE_COMMANDS.has(command)) {
    return true
  }
  // Check exact match first
  if (allowedTools.includes(getPermissionKey(tool, { command }, null))) {
    return true
  }
  // Check if command is an exact match with an approved prefix
  if (allowedTools.includes(getPermissionKey(tool, { command }, command))) {
    return true
  }
  return false
}

export const bashToolCommandHasPermission = (
  tool: Tool,
  command: string,
  prefix: string | null,
  allowedTools: string[],
): boolean => {
  // Check exact match first
  if (bashToolCommandHasExactMatchPermission(tool, command, allowedTools)) {
    return true
  }
  return allowedTools.includes(getPermissionKey(tool, { command }, prefix))
}

export const bashToolHasPermission = async (
  tool: Tool,
  command: string,
  context: ToolUseContext,
  allowedTools: string[],
  getCommandSubcommandPrefixFn = getCommandSubcommandPrefix,
): Promise<PermissionResult> => {
  if (bashToolCommandHasExactMatchPermission(tool, command, allowedTools)) {
    // This is an exact match for a command that is allowed, so we can skip the prefix check
    return { result: true }
  }

  const subCommands = splitCommand(command).filter(_ => {
    // Denim likes to add this, we strip it out so we don't need to prompt the user each time
    if (_ === `cd ${getCwd()}`) {
      return false
    }
    return true
  })
  const commandSubcommandPrefix = await getCommandSubcommandPrefixFn(
    command,
    context.abortController.signal,
  )
  if (context.abortController.signal.aborted) {
    throw new AbortError()
  }

  if (commandSubcommandPrefix === null) {
    // Fail closed and ask for user approval if the command prefix query failed (e.g. due to network error)
    // This is NOT the same as `fullCommandPrefix.commandPrefix === null`, which means no prefix was detected
    return {
      result: false,
      message: `${PRODUCT_NAME} requested permissions to use ${tool.name}, but you haven't granted it yet.`,
    }
  }

  if (commandSubcommandPrefix.commandInjectionDetected) {
    // Only allow exact matches for potential command injections
    if (bashToolCommandHasExactMatchPermission(tool, command, allowedTools)) {
      return { result: true }
    } else {
      return {
        result: false,
        message: `${PRODUCT_NAME} requested permissions to use ${tool.name}, but you haven't granted it yet.`,
      }
    }
  }

  // If there is only one command, no need to process subCommands
  if (subCommands.length < 2) {
    if (
      bashToolCommandHasPermission(
        tool,
        command,
        commandSubcommandPrefix.commandPrefix,
        allowedTools,
      )
    ) {
      return { result: true }
    } else {
      return {
        result: false,
        message: `${PRODUCT_NAME} requested permissions to use ${tool.name}, but you haven't granted it yet.`,
      }
    }
  }
  if (
    subCommands.every(subCommand => {
      const prefixResult =
        commandSubcommandPrefix.subcommandPrefixes.get(subCommand)
      if (prefixResult === undefined || prefixResult.commandInjectionDetected) {
        // If prefix result is missing or command injection is detected, always ask for permission
        return false
      }
      const hasPermission = bashToolCommandHasPermission(
        tool,
        subCommand,
        prefixResult ? prefixResult.commandPrefix : null,
        allowedTools,
      )
      return hasPermission
    })
  ) {
    return { result: true }
  }
  return {
    result: false,
    message: `${PRODUCT_NAME} requested permissions to use ${tool.name}, but you haven't granted it yet.`,
  }
}

type PermissionResult = { result: true } | { result: false; message: string }

export const hasPermissionsToUseTool: CanUseToolFn = async (
  tool,
  input,
  context,
  _assistantMessage,
): Promise<PermissionResult> => {
  // If safe mode is not enabled, allow all tools (permissive by default)
  if (!context.options.safeMode) {
    return { result: true }
  }

  if (context.abortController.signal.aborted) {
    throw new AbortError()
  }

  // Check if the tool needs permissions
  try {
    if (!tool.needsPermissions(input as never)) {
      return { result: true }
    }
  } catch (e) {
    logError(`Error checking permissions: ${e}`)
    return { result: false, message: 'Error checking permissions' }
  }

  const projectConfig = getCurrentProjectConfig()
  const allowedTools = projectConfig.allowedTools ?? []
  // Special case for BashTool to allow blanket commands without exposing them in the UI
  if (tool === BashTool && allowedTools.includes(BashTool.name)) {
    return { result: true }
  }

  // TODO: Move this into tool definitions (done for read tools!)
  switch (tool) {
    // For bash tool, check each sub-command's permissions separately
    case BashTool: {
      // The types have already been validated by the tool,
      // so we can safely parse the input (as opposed to safeParse).
      const { command } = inputSchema.parse(input)
      return await bashToolHasPermission(tool, command, context, allowedTools)
    }
    // For file editing tools, check session-only permissions
    case FileEditTool:
    case FileWriteTool:
    case NotebookEditTool: {
      // The types have already been validated by the tool,
      // so we can safely pass this in
      if (!tool.needsPermissions(input)) {
        return { result: true }
      }
      return {
        result: false,
        message: `${PRODUCT_NAME} requested permissions to use ${tool.name}, but you haven't granted it yet.`,
      }
    }
    // For other tools, check persistent permissions
    default: {
      const permissionKey = getPermissionKey(tool, input, null)
      if (allowedTools.includes(permissionKey)) {
        return { result: true }
      }

      return {
        result: false,
        message: `${PRODUCT_NAME} requested permissions to use ${tool.name}, but you haven't granted it yet.`,
      }
    }
  }
}

export async function savePermission(
  tool: Tool,
  input: { [k: string]: unknown },
  prefix: string | null,
): Promise<void> {
  const key = getPermissionKey(tool, input, prefix)

  // For file editing tools, store write permissions only in memory
  if (
    tool === FileEditTool ||
    tool === FileWriteTool ||
    tool === NotebookEditTool
  ) {
    grantWritePermissionForOriginalDir()
    return
  }

  // For other tools, store permissions on disk
  const projectConfig = getCurrentProjectConfig()
  if (projectConfig.allowedTools.includes(key)) {
    return
  }

  projectConfig.allowedTools.push(key)
  projectConfig.allowedTools.sort()

  saveCurrentProjectConfig(projectConfig)
}

function getPermissionKey(
  tool: Tool,
  input: { [k: string]: unknown },
  prefix: string | null,
): string {
  switch (tool) {
    case BashTool:
      if (prefix) {
        return `${BashTool.name}(${prefix}:*)`
      }
      return `${BashTool.name}(${BashTool.renderToolUseMessage(input as never)})`
    default:
      return tool.name
  }
}
