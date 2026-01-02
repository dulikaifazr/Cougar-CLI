import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { memoize } from 'lodash-es'
import type { MessageParam } from '@anthropic-ai/sdk/resources/index.mjs'
import type { Command } from '@commands'
import { getCwd } from '@utils/state'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/**
 * Execute bash commands found in custom command content using !`command` syntax
 *
 * This function processes dynamic command execution within custom commands,
 * following the same security model as the main BashTool but with restricted scope.
 * Commands are executed in the current working directory with a timeout.
 *
 * @param content - The custom command content to process
 * @returns Promise<string> - Content with bash commands replaced by their output
 */
export async function executeBashCommands(content: string): Promise<string> {
  // Match patterns like !`git status` or !`command here`
  const bashCommandRegex = /!\`([^`]+)\`/g
  const matches = [...content.matchAll(bashCommandRegex)]

  if (matches.length === 0) {
    return content
  }

  let result = content

  for (const match of matches) {
    const fullMatch = match[0]
    const command = match[1].trim()

    try {
      // Parse command and args using simple shell parsing
      // This mirrors the approach used in the main BashTool but with stricter limits
      const parts = command.split(/\s+/)
      const cmd = parts[0]
      const args = parts.slice(1)

      // Execute with conservative timeout (5s vs BashTool's 2min default)
      const { stdout, stderr } = await execFileAsync(cmd, args, {
        timeout: 5000,
        encoding: 'utf8',
        cwd: getCwd(), // Use current working directory for consistency
      })

      // Replace the bash command with its output, preferring stdout
      const output = stdout.trim() || stderr.trim() || '(no output)'
      result = result.replace(fullMatch, output)
    } catch (error) {
      console.warn(`Failed to execute bash command "${command}":`, error)
      result = result.replace(fullMatch, `(error executing: ${command})`)
    }
  }

  return result
}

/**
 * Resolve file references using @filepath syntax within custom commands
 *
 * This function implements file inclusion for custom commands, similar to how
 * the FileReadTool works but with inline processing. Files are read from the
 * current working directory and formatted as markdown code blocks.
 *
 * Security note: Files are read with the same permissions as the main process,
 * following the same security model as other file operations in the system.
 *
 * @param content - The custom command content to process
 * @returns Promise<string> - Content with file references replaced by file contents
 */
export async function resolveFileReferences(content: string): Promise<string> {
  // Match patterns like @src/file.js or @path/to/file.txt
  // Use consistent file mention pattern from mentionProcessor
  // Exclude agent and ask-model patterns to avoid conflicts
  const fileRefRegex = /@([a-zA-Z0-9/._-]+(?:\.[a-zA-Z0-9]+)?)/g
  const matches = [...content.matchAll(fileRefRegex)]

  if (matches.length === 0) {
    return content
  }

  let result = content

  for (const match of matches) {
    const fullMatch = match[0]
    const filePath = match[1]

    // Skip agent mentions - these are handled by the mention processor
    if (filePath.startsWith('agent-')) {
      continue
    }

    try {
      // Resolve relative to current working directory
      // This maintains consistency with how other file operations work
      const fullPath = join(getCwd(), filePath)

      if (existsSync(fullPath)) {
        const fileContent = readFileSync(fullPath, { encoding: 'utf-8' })

        // Format file content with filename header for clarity
        // This matches the format used by FileReadTool for consistency
        const formattedContent = `\n\n## File: ${filePath}\n\`\`\`\n${fileContent}\n\`\`\`\n`
        result = result.replace(fullMatch, formattedContent)
      } else {
        result = result.replace(fullMatch, `(file not found: ${filePath})`)
      }
    } catch (error) {
      console.warn(`Failed to read file "${filePath}":`, error)
      result = result.replace(fullMatch, `(error reading: ${filePath})`)
    }
  }

  return result
}

/**
 * Validate and process allowed-tools specification from frontmatter
 *
 * This function handles tool restriction specifications in custom commands.
 * Currently it provides logging and validation structure - full enforcement
 * would require deep integration with the tool permission system.
 *
 * Future implementation should connect to src/permissions.ts and the
 * tool execution pipeline to enforce these restrictions.
 *
 * @param allowedTools - Array of tool names from frontmatter
 * @returns boolean - Currently always true, future will return actual validation result
 */
function validateAllowedTools(allowedTools: string[] | undefined): boolean {
  // Log allowed tools for debugging and future integration
  if (allowedTools && allowedTools.length > 0) {
    // TODO: Integrate with src/permissions.ts tool permission system
    // TODO: Connect to Tool.tsx needsPermissions() mechanism
  }
  return true // Allow execution for now - future versions will enforce restrictions
}

/**
 * Frontmatter configuration for custom commands
 *
 * This interface defines the YAML frontmatter structure that can be used
 * to configure custom commands. It mirrors the Claude Desktop custom command
 * system for compatibility while adding Cougar-specific enhancements.
 */
export interface CustomCommandFrontmatter {
  /** Display name for the command (overrides filename-based naming) */
  name?: string
  /** Brief description of what the command does */
  description?: string
  /** Alternative names that can be used to invoke this command */
  aliases?: string[]
  /** Whether this command is active and can be executed */
  enabled?: boolean
  /** Whether this command should be hidden from help output */
  hidden?: boolean
  /** Message to display while the command is running */
  progressMessage?: string
  /** Named arguments for legacy {arg} placeholder support */
  argNames?: string[]
  /** Tools that this command is restricted to use */
  'allowed-tools'?: string[]
}

/**
 * Extended Command interface with scope information
 *
 * This extends the base Command interface to include scope metadata
 * for distinguishing between user-level and project-level commands.
 */
export interface CustomCommandWithScope {
  /** Command type - matches PromptCommand */
  type: 'prompt'
  /** Command name */
  name: string
  /** Command description */
  description: string
  /** Whether command is enabled */
  isEnabled: boolean
  /** Whether command is hidden */
  isHidden: boolean
  /** Command aliases */
  aliases?: string[]
  /** Progress message */
  progressMessage: string
  /** Argument names for legacy support */
  argNames?: string[]
  /** User-facing name function */
  userFacingName(): string
  /** Prompt generation function */
  getPromptForCommand(args: string): Promise<MessageParam[]>
  /** Scope indicates whether this is a user or project command */
  scope?: 'user' | 'project'
}

/**
 * Parsed custom command file representation
 *
 * This interface represents a fully parsed custom command file with
 * separated frontmatter and content sections.
 */
export interface CustomCommandFile {
  /** Parsed frontmatter configuration */
  frontmatter: CustomCommandFrontmatter
  /** Markdown content (without frontmatter) */
  content: string
  /** Absolute path to the source file */
  filePath: string
}

/**
 * Parse YAML frontmatter from markdown content
 *
 * This function extracts and parses YAML frontmatter from markdown files,
 * supporting the same syntax as Jekyll and other static site generators.
 * It handles basic YAML constructs including strings, booleans, and arrays.
 *
 * The parser is intentionally simple and focused on the specific needs of
 * custom commands rather than being a full YAML parser. Complex YAML features
 * like nested objects, multi-line strings, and advanced syntax are not supported.
 *
 * @param content - Raw markdown content with optional frontmatter
 * @returns Object containing parsed frontmatter and remaining content
 */
export function parseFrontmatter(content: string): {
  frontmatter: CustomCommandFrontmatter
  content: string
} {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)---\s*\n?/
  const match = content.match(frontmatterRegex)

  if (!match) {
    return { frontmatter: {}, content }
  }

  const yamlContent = match[1] || ''
  const markdownContent = content.slice(match[0].length)
  const frontmatter: CustomCommandFrontmatter = {}

  // Simple YAML parser for basic key-value pairs and arrays
  // This handles the subset of YAML needed for custom command configuration
  const lines = yamlContent.split('\n')
  let currentKey: string | null = null
  let arrayItems: string[] = []
  let inArray = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    // Handle array item continuation (- item)
    if (inArray && trimmed.startsWith('-')) {
      const item = trimmed.slice(1).trim().replace(/['"]/g, '')
      arrayItems.push(item)
      continue
    }

    // End array processing when we hit a new key
    if (inArray && trimmed.includes(':')) {
      if (currentKey) {
        ;(frontmatter as any)[currentKey] = arrayItems
      }
      inArray = false
      arrayItems = []
      currentKey = null
    }

    const colonIndex = trimmed.indexOf(':')
    if (colonIndex === -1) continue

    const key = trimmed.slice(0, colonIndex).trim()
    const value = trimmed.slice(colonIndex + 1).trim()

    // Handle inline arrays [item1, item2]
    if (value.startsWith('[') && value.endsWith(']')) {
      const items = value
        .slice(1, -1)
        .split(',')
        .map(s => s.trim().replace(/['"]/g, ''))
        .filter(s => s.length > 0)
      ;(frontmatter as any)[key] = items
    }
    // Handle multi-line arrays (value is empty or [])
    else if (value === '' || value === '[]') {
      currentKey = key
      inArray = true
      arrayItems = []
    }
    // Handle boolean values
    else if (value === 'true' || value === 'false') {
      ;(frontmatter as any)[key] = value === 'true'
    }
    // Handle string values (remove quotes)
    else {
      ;(frontmatter as any)[key] = value.replace(/['"]/g, '')
    }
  }

  // Handle final array if we ended in array mode
  if (inArray && currentKey) {
    ;(frontmatter as any)[currentKey] = arrayItems
  }

  return { frontmatter, content: markdownContent }
}

/**
 * Scan directory for markdown files using find command
 *
 * This function discovers .md files in the specified directory using the
 * system's find command. It's designed as a fallback when ripgrep is not
 * available, providing the same functionality with broader compatibility.
 *
 * The function includes timeout and signal handling for robustness,
 * especially important when scanning large directory trees.
 *
 * @param args - Legacy parameter for ripgrep compatibility (ignored)
 * @param directory - Directory to scan for markdown files
 * @param signal - AbortSignal for cancellation support
 * @returns Promise<string[]> - Array of absolute paths to .md files
 */
async function scanMarkdownFiles(
  args: string[], // Legacy parameter for ripgrep compatibility
  directory: string,
  signal: AbortSignal,
): Promise<string[]> {
  try {
    // Use find command as fallback since ripgrep may not be available
    // This provides broader compatibility across different systems
    const { stdout } = await execFileAsync(
      'find',
      [directory, '-name', '*.md', '-type', 'f'],
      { signal, timeout: 3000 },
    )
    return stdout
      .trim()
      .split('\n')
      .filter(line => line.length > 0)
  } catch (error) {
    // If find fails or directory doesn't exist, return empty array
    // This ensures graceful degradation when directories are missing
    return []
  }
}

/**
 * Create a Command object from custom command file data
 *
 * This function transforms parsed custom command data into a Command object
 * that integrates with the main command system. It handles naming, scoping,
 * and prompt generation according to the project's command patterns.
 *
 * Command naming follows a hierarchical structure:
 * - Project commands: "project:namespace:command"
 * - User commands: "user:namespace:command"
 * - Namespace is derived from directory structure
 *
 * @param frontmatter - Parsed frontmatter configuration
 * @param content - Markdown content of the command
 * @param filePath - Absolute path to the command file
 * @param baseDir - Base directory for scope determination
 * @returns CustomCommandWithScope | null - Processed command or null if invalid
 */
function createCustomCommand(
  frontmatter: CustomCommandFrontmatter,
  content: string,
  filePath: string,
  baseDir: string,
): CustomCommandWithScope | null {
  // Extract command name with namespace support
  const relativePath = filePath.replace(baseDir + '/', '')
  const pathParts = relativePath.split('/')
  const fileName = pathParts[pathParts.length - 1].replace('.md', '')

  // Determine scope based on directory location
  // This follows the same pattern as Claude Desktop's command system
  const userClaudeDir = join(homedir(), '.claude', 'commands')
  const userCougarDir = join(homedir(), '.cougar', 'commands')
  const scope: 'user' | 'project' =
    (baseDir === userClaudeDir || baseDir === userCougarDir) ? 'user' : 'project'
  const prefix = scope === 'user' ? 'user' : 'project'

  // Create proper command name with prefix and namespace
  let finalName: string
  if (frontmatter.name) {
    // If frontmatter specifies name, use it but ensure proper prefix
    finalName = frontmatter.name.startsWith(`${prefix}:`)
      ? frontmatter.name
      : `${prefix}:${frontmatter.name}`
  } else {
    // Generate name from file path, supporting directory-based namespacing
    if (pathParts.length > 1) {
      const namespace = pathParts.slice(0, -1).join(':')
      finalName = `${prefix}:${namespace}:${fileName}`
    } else {
      finalName = `${prefix}:${fileName}`
    }
  }

  // Extract configuration with sensible defaults
  const description = frontmatter.description || `Custom command: ${finalName}`
  const enabled = frontmatter.enabled !== false // Default to true
  const hidden = frontmatter.hidden === true // Default to false
  const aliases = frontmatter.aliases || []
  const progressMessage =
    frontmatter.progressMessage || `Running ${finalName}...`
  const argNames = frontmatter.argNames

  // Validate required fields
  if (!finalName) {
    console.warn(`Custom command file ${filePath} has no name, skipping`)
    return null
  }

  // Create the command object following the project's Command interface
  const command: CustomCommandWithScope = {
    type: 'prompt',
    name: finalName,
    description,
    isEnabled: enabled,
    isHidden: hidden,
    aliases,
    progressMessage,
    argNames,
    scope,
    userFacingName(): string {
      return finalName
    },
    async getPromptForCommand(args: string): Promise<MessageParam[]> {
      let prompt = content.trim()

  // Process argument substitution following legacy conventions
      // This supports both the official $ARGUMENTS format and legacy {arg} format

      // Step 1: Handle $ARGUMENTS placeholder (legacy command format)
      if (prompt.includes('$ARGUMENTS')) {
        prompt = prompt.replace(/\$ARGUMENTS/g, args || '')
      }

      // Step 2: Legacy support for named argument placeholders
      if (argNames && argNames.length > 0) {
        const argValues = args.trim().split(/\s+/)
        argNames.forEach((argName, index) => {
          const value = argValues[index] || ''
          prompt = prompt.replace(new RegExp(`\\{${argName}\\}`, 'g'), value)
        })
      }

      // Step 3: If args are provided but no placeholders used, append to prompt
      if (
        args.trim() &&
        !prompt.includes('$ARGUMENTS') &&
        (!argNames || argNames.length === 0)
      ) {
        prompt += `\n\nAdditional context: ${args}`
      }

      // Step 4: Add tool restrictions if specified
      const allowedTools = frontmatter['allowed-tools']
      if (
        allowedTools &&
        Array.isArray(allowedTools) &&
        allowedTools.length > 0
      ) {
        const allowedToolsStr = allowedTools.join(', ')
        prompt += `\n\nIMPORTANT: You are restricted to using only these tools: ${allowedToolsStr}. Do not use any other tools even if they might be helpful for the task.`
      }

      return [
        {
          role: 'user',
          content: prompt,
        },
      ]
    },
  }

  return command
}

/**
 * Load custom commands from .claude/commands/ directories
 *
 * This function scans both user-level and project-level command directories
 * for markdown files and processes them into Command objects. It follows the
 * same discovery pattern as Claude Desktop but with additional performance
 * optimizations and error handling.
 *
 * Directory structure:
 * - User commands: ~/.claude/commands/
 * - Project commands: {project}/.claude/commands/
 *
 * The function is memoized for performance but includes cache invalidation
 * based on directory contents and timestamps.
 *
 * @returns Promise<CustomCommandWithScope[]> - Array of loaded and enabled commands
 */
export const loadCustomCommands = memoize(
  async (): Promise<CustomCommandWithScope[]> => {
    // Support both .claude and .cougar directories
    const userClaudeDir = join(homedir(), '.claude', 'commands')
    const projectClaudeDir = join(getCwd(), '.claude', 'commands')
    const userCougarDir = join(homedir(), '.cougar', 'commands')
    const projectCougarDir = join(getCwd(), '.cougar', 'commands')

    // Set up abort controller for timeout handling
    const abortController = new AbortController()
    const timeout = setTimeout(() => abortController.abort(), 3000)

    try {
      const startTime = Date.now()

      // Scan all four directories for .md files concurrently
      // This pattern matches the async loading used elsewhere in the project
      const [projectClaudeFiles, userClaudeFiles, projectCougarFiles, userCougarFiles] = await Promise.all([
        existsSync(projectClaudeDir)
          ? scanMarkdownFiles(
              ['--files', '--hidden', '--glob', '*.md'], // Legacy args for ripgrep compatibility
              projectClaudeDir,
              abortController.signal,
            )
          : Promise.resolve([]),
        existsSync(userClaudeDir)
          ? scanMarkdownFiles(
              ['--files', '--glob', '*.md'], // Legacy args for ripgrep compatibility
              userClaudeDir,
              abortController.signal,
            )
          : Promise.resolve([]),
        existsSync(projectCougarDir)
          ? scanMarkdownFiles(
              ['--files', '--hidden', '--glob', '*.md'], // Legacy args for ripgrep compatibility
              projectCougarDir,
              abortController.signal,
            )
          : Promise.resolve([]),
        existsSync(userCougarDir)
          ? scanMarkdownFiles(
              ['--files', '--glob', '*.md'], // Legacy args for ripgrep compatibility
              userCougarDir,
              abortController.signal,
            )
          : Promise.resolve([]),
      ])

      // Combine files with priority: project > user, cougar > claude
      const projectFiles = [...projectCougarFiles, ...projectClaudeFiles]
      const userFiles = [...userCougarFiles, ...userClaudeFiles]
      const allFiles = [...projectFiles, ...userFiles]
      const duration = Date.now() - startTime

      // Log performance metrics for monitoring
      // This follows the same pattern as other performance-sensitive operations
      

      // Parse files and create command objects
      const commands: CustomCommandWithScope[] = []

      // Process project files first (higher priority)
      for (const filePath of projectFiles) {
        try {
          const content = readFileSync(filePath, { encoding: 'utf-8' })
          const { frontmatter, content: commandContent } =
            parseFrontmatter(content)
          // Determine which base directory this file is from
          const baseDir = filePath.includes('.cougar/commands') ? projectCougarDir : projectClaudeDir
          const command = createCustomCommand(
            frontmatter,
            commandContent,
            filePath,
            baseDir,
          )

          if (command) {
            commands.push(command)
          }
        } catch (error) {
          console.warn(`Failed to load custom command from ${filePath}:`, error)
        }
      }

      // Process user files second (lower priority)
      for (const filePath of userFiles) {
        try {
          const content = readFileSync(filePath, { encoding: 'utf-8' })
          const { frontmatter, content: commandContent } =
            parseFrontmatter(content)
          // Determine which base directory this file is from
          const baseDir = filePath.includes('.cougar/commands') ? userCougarDir : userClaudeDir
          const command = createCustomCommand(
            frontmatter,
            commandContent,
            filePath,
            baseDir,
          )

          if (command) {
            commands.push(command)
          }
        } catch (error) {
          console.warn(`Failed to load custom command from ${filePath}:`, error)
        }
      }

      // Filter enabled commands and log results
      const enabledCommands = commands.filter(cmd => cmd.isEnabled)

      // Log loading results for debugging and monitoring
      

      return enabledCommands
    } catch (error) {
      console.warn('Failed to load custom commands:', error)
      return []
    } finally {
      clearTimeout(timeout)
    }
  },
  // Memoization resolver based on current working directory and directory state
  // This ensures cache invalidation when directories change
  () => {
    const cwd = getCwd()
    const userClaudeDir = join(homedir(), '.claude', 'commands')
    const projectClaudeDir = join(cwd, '.claude', 'commands')
    const userCougarDir = join(homedir(), '.cougar', 'commands')
    const projectCougarDir = join(cwd, '.cougar', 'commands')

    // Create cache key that includes directory existence and timestamp
    // This provides reasonable cache invalidation without excessive file system checks
    return `${cwd}:${existsSync(userClaudeDir)}:${existsSync(projectClaudeDir)}:${existsSync(userCougarDir)}:${existsSync(projectCougarDir)}:${Math.floor(Date.now() / 60000)}`
  },
)

/**
 * Clear the custom commands cache to force reload
 *
 * This function invalidates the memoized cache for custom commands,
 * forcing the next invocation to re-scan the filesystem. It's useful
 * when commands are added, removed, or modified during runtime.
 *
 * This follows the same pattern as other cache invalidation functions
 * in the project, such as getCommands.cache.clear().
 */
export const reloadCustomCommands = (): void => {
  loadCustomCommands.cache.clear()
}

/**
 * Get custom command directories for help and diagnostic purposes
 *
 * This function returns the standard directory paths where custom commands
 * are expected to be found. It's used by help systems and diagnostic tools
 * to inform users about the proper directory structure.
 *
 * @returns Object containing user and project command directory paths
 */
export function getCustomCommandDirectories(): {
  userClaude: string
  projectClaude: string
  userCougar: string
  projectCougar: string
} {
  return {
    userClaude: join(homedir(), '.claude', 'commands'),
    projectClaude: join(getCwd(), '.claude', 'commands'),
    userCougar: join(homedir(), '.cougar', 'commands'),
    projectCougar: join(getCwd(), '.cougar', 'commands'),
  }
}

/**
 * Check if custom commands are available in either directory
 *
 * This function provides a quick way to determine if custom commands
 * are configured without actually loading them. It's useful for conditional
 * UI elements and feature detection.
 *
 * @returns boolean - True if at least one command directory exists
 */
export function hasCustomCommands(): boolean {
  const { userClaude, projectClaude, userCougar, projectCougar } = getCustomCommandDirectories()
  return existsSync(userClaude) || existsSync(projectClaude) || existsSync(userCougar) || existsSync(projectCougar)
}
