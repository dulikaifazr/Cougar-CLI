import { statSync } from 'fs'
import { EOL } from 'os'
import { isAbsolute, relative, resolve } from 'path'
import * as React from 'react'
import { z } from 'zod'
import { FallbackToolUseRejectedMessage } from '@components/FallbackToolUseRejectedMessage'
import { PRODUCT_NAME } from '@constants/product'
import { queryQuick } from '@services/claude'
import { Tool, ValidationResult } from '@tool'
import { splitCommand } from '@utils/commands'
import { isInDirectory } from '@utils/file'
import { logError } from '@utils/log'
import { PersistentShell } from '@utils/PersistentShell'
import { getCwd, getOriginalCwd } from '@utils/state'
import { getGlobalConfig } from '@utils/config'
import { getModelManager } from '@utils/model'
import BashToolResultMessage from './BashToolResultMessage'
import { BANNED_COMMANDS, PROMPT } from './prompt'
import { formatOutput, getCommandFilePaths } from './utils'

export const inputSchema = z.strictObject({
  command: z.string().describe('The command to execute'),
  timeout: z
    .number()
    .optional()
    .describe('Optional timeout in milliseconds (max 600000)'),
})

type In = typeof inputSchema
export type Out = {
  stdout: string
  stdoutLines: number // Total number of lines in original stdout, even if `stdout` is now truncated
  stderr: string
  stderrLines: number // Total number of lines in original stderr, even if `stderr` is now truncated
  interrupted: boolean
}

export const BashTool = {
  name: 'Bash',
  async description() {
    return 'Executes shell commands on your computer'
  },
  async prompt() {
    const config = getGlobalConfig()
    // 🔧 Fix: Use ModelManager to get actual current model
    const modelManager = getModelManager()
    const modelName =
      modelManager.getModelName('main') || '<No Model Configured>'
    // Substitute the placeholder in the static PROMPT string
    return PROMPT.replace(/{MODEL_NAME}/g, modelName)
  },
  isReadOnly() {
    return false
  },
  isConcurrencySafe() {
    return false // BashTool modifies state/files, not safe for concurrent execution
  },
  inputSchema,
  userFacingName() {
    return 'Bash'
  },
  async isEnabled() {
    return true
  },
  needsPermissions(): boolean {
    // Always check per-project permissions for BashTool
    return true
  },
  async validateInput({ command }): Promise<ValidationResult> {
    const commands = splitCommand(command)
    for (const cmd of commands) {
      const parts = cmd.split(' ')
      const baseCmd = parts[0]

      // Check if command is banned
      if (baseCmd && BANNED_COMMANDS.includes(baseCmd.toLowerCase())) {
        return {
          result: false,
          message: `Command '${baseCmd}' is not allowed for security reasons`,
        }
      }

      // Special handling for cd command
      if (baseCmd === 'cd' && parts[1]) {
        const targetDir = parts[1]!.replace(/^['"]|['"]$/g, '') // Remove quotes if present
        const fullTargetDir = isAbsolute(targetDir)
          ? targetDir
          : resolve(getCwd(), targetDir)
        if (
          !isInDirectory(
            relative(getOriginalCwd(), fullTargetDir),
            relative(getCwd(), getOriginalCwd()),
          )
        ) {
          return {
            result: false,
            message: `ERROR: cd to '${fullTargetDir}' was blocked. For security, ${PRODUCT_NAME} may only change directories to child directories of the original working directory (${getOriginalCwd()}) for this session.`,
          }
        }
      }
    }

    return { result: true }
  },
  renderToolUseMessage({ command }) {
    // Clean up any command that uses the quoted HEREDOC pattern
    if (command.includes("\"$(cat <<'EOF'")) {
      const match = command.match(
        /^(.*?)"?\$\(cat <<'EOF'\n([\s\S]*?)\n\s*EOF\n\s*\)"(.*)$/,
      )
      if (match && match[1] && match[2]) {
        const prefix = match[1]
        const content = match[2]
        const suffix = match[3] || ''
        return `${prefix.trim()} "${content.trim()}"${suffix.trim()}`
      }
    }
    return command
  },
  renderToolUseRejectedMessage() {
    return <FallbackToolUseRejectedMessage />
  },

  renderToolResultMessage(content) {
    return <BashToolResultMessage content={content} verbose={false} />
  },
  renderResultForAssistant({ interrupted, stdout, stderr }) {
    let errorMessage = stderr.trim()
    if (interrupted) {
      if (stderr) errorMessage += EOL
      errorMessage += '<error>Command was aborted before completion</error>'
    }
    const hasBoth = stdout.trim() && errorMessage
    return `${stdout.trim()}${hasBoth ? '\n' : ''}${errorMessage.trim()}`
  },
  async *call(
    { command, timeout = 120000 },
    { abortController, readFileTimestamps },
  ) {
    let stdout = ''
    let stderr = ''

    // 🔧 Check if already cancelled before starting execution
    if (abortController.signal.aborted) {
      const data: Out = {
        stdout: '',
        stdoutLines: 0,
        stderr: 'Command cancelled before execution',
        stderrLines: 1,
        interrupted: true,
      }

      yield {
        type: 'result',
        resultForAssistant: this.renderResultForAssistant(data),
        data,
      }
      return
    }

    try {
      // Execute commands
      const result = await PersistentShell.getInstance().exec(
        command,
        abortController.signal,
        timeout,
      )
      stdout += (result.stdout || '').trim() + EOL
      stderr += (result.stderr || '').trim() + EOL
      if (result.code !== 0) {
        stderr += `Exit code ${result.code}`
      }

      if (!isInDirectory(getCwd(), getOriginalCwd())) {
        // Shell directory is outside original working directory, reset it
        await PersistentShell.getInstance().setCwd(getOriginalCwd())
        stderr = `${stderr.trim()}${EOL}Shell cwd was reset to ${getOriginalCwd()}`
        
      }

      // Update read timestamps for any files referenced by the command
      // Don't block the main thread!
      // Skip this in tests because it makes fixtures non-deterministic (they might not always get written),
      // so will be missing in CI.
      if (process.env.NODE_ENV !== 'test') {
        getCommandFilePaths(command, stdout).then(filePaths => {
          for (const filePath of filePaths) {
            const fullFilePath = isAbsolute(filePath)
              ? filePath
              : resolve(getCwd(), filePath)

            // Try/catch in case the file doesn't exist (because Haiku didn't properly extract it)
            try {
              readFileTimestamps[fullFilePath] = statSync(fullFilePath).mtimeMs
            } catch (e) {
              logError(e)
            }
          }
        })
      }

      const { totalLines: stdoutLines, truncatedContent: stdoutContent } =
        formatOutput(stdout.trim())
      const { totalLines: stderrLines, truncatedContent: stderrContent } =
        formatOutput(stderr.trim())

      const data: Out = {
        stdout: stdoutContent,
        stdoutLines,
        stderr: stderrContent,
        stderrLines,
        interrupted: result.interrupted,
      }

      yield {
        type: 'result',
        resultForAssistant: this.renderResultForAssistant(data),
        data,
      }
    } catch (error) {
      // 🔧 Handle cancellation or other errors properly
      const isAborted = abortController.signal.aborted
      const errorMessage = isAborted 
        ? 'Command was cancelled by user' 
        : `Command failed: ${error instanceof Error ? error.message : String(error)}`
      
      const data: Out = {
        stdout: stdout.trim(),
        stdoutLines: stdout.split('\n').length,
        stderr: errorMessage,
        stderrLines: 1,
        interrupted: isAborted,
      }

      yield {
        type: 'result',
        resultForAssistant: this.renderResultForAssistant(data),
        data,
      }
    }
  },
} satisfies Tool<In, Out>
