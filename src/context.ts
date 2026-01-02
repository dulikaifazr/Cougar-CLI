import {
  getCurrentProjectConfig,
  saveCurrentProjectConfig,
} from '@utils/config'
import { logError } from './utils/log'
import { getCodeStyle } from './utils/style'
import { getCwd } from './utils/state'
import { memoize, omit } from 'lodash-es'
import { LSTool } from './tools/lsTool/lsTool'
import { getIsGit } from './utils/git'
import { ripGrep } from './utils/ripgrep'
import * as path from 'path'
import { execFileNoThrow } from './utils/execFileNoThrow'
import { join } from 'path'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { getModelManager } from './utils/model'
import { lastX } from './utils/generators'
import { getGitEmail } from './utils/user'
import { PROJECT_FILE } from './constants/product'
/**
 * Locate AGENTS.md and CLAUDE.md files for backward compatibility with
 * existing documentation workflows.
 */
export async function getClaudeFiles(): Promise<string | null> {
  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), 3000)
  try {
    // Search for both AGENTS.md and CLAUDE.md files
    const [codeContextFiles, claudeFiles] = await Promise.all([
      ripGrep(
        ['--files', '--glob', join('**', '*', PROJECT_FILE)],
        getCwd(),
        abortController.signal,
      ).catch(() => []),
      ripGrep(
        ['--files', '--glob', join('**', '*', 'CLAUDE.md')],
        getCwd(),
        abortController.signal,
      ).catch(() => []),
    ])

    const allFiles = [...codeContextFiles, ...claudeFiles]
    if (!allFiles.length) {
      return null
    }

    // Add instructions for additional project files
    const fileTypes = []
    if (codeContextFiles.length > 0) fileTypes.push('AGENTS.md')
    if (claudeFiles.length > 0) fileTypes.push('CLAUDE.md')

    return `NOTE: Additional project documentation files (${fileTypes.join(', ')}) were found. When working in these directories, make sure to read and follow the instructions in the corresponding files:\n${allFiles
      .map(_ => path.join(getCwd(), _))
      .map(_ => `- ${_}`)
      .join('\n')}`
  } catch (error) {
    logError(error)
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export function setContext(key: string, value: string): void {
  const projectConfig = getCurrentProjectConfig()
  const context = omit(
    { ...projectConfig.context, [key]: value },
    'codeStyle',
    'directoryStructure',
  )
  saveCurrentProjectConfig({ ...projectConfig, context })
}

export function removeContext(key: string): void {
  const projectConfig = getCurrentProjectConfig()
  const context = omit(
    projectConfig.context,
    key,
    'codeStyle',
    'directoryStructure',
  )
  saveCurrentProjectConfig({ ...projectConfig, context })
}

export const getReadme = memoize(async (): Promise<string | null> => {
  try {
    const readmePath = join(getCwd(), 'README.md')
    if (!existsSync(readmePath)) {
      return null
    }
    const content = await readFile(readmePath, 'utf-8')
    return content
  } catch (e) {
    logError(e)
    return null
  }
})

/**
 * Get project documentation content (AGENTS.md and CLAUDE.md)
 */
export const getProjectDocs = memoize(async (): Promise<string | null> => {
  try {
    const cwd = getCwd()
    const codeContextPath = join(cwd, 'AGENTS.md')
    const claudePath = join(cwd, 'CLAUDE.md')

    const docs = []

    // Try to read AGENTS.md
    if (existsSync(codeContextPath)) {
      try {
        const content = await readFile(codeContextPath, 'utf-8')
        docs.push(`# AGENTS.md\n\n${content}`)
      } catch (e) {
        logError(e)
      }
    }

    // Try to read CLAUDE.md
    if (existsSync(claudePath)) {
      try {
        const content = await readFile(claudePath, 'utf-8')
        docs.push(`# CLAUDE.md\n\n${content}`)
      } catch (e) {
        logError(e)
      }
    }

    return docs.length > 0 ? docs.join('\n\n---\n\n') : null
  } catch (e) {
    logError(e)
    return null
  }
})

export const getGitStatus = memoize(async (): Promise<string | null> => {
  if (process.env.NODE_ENV === 'test') {
    // Avoid cycles in tests
    return null
  }
  if (!(await getIsGit())) {
    return null
  }

  try {
    const [branch, mainBranch, status, log, authorLog] = await Promise.all([
      execFileNoThrow(
        'git',
        ['branch', '--show-current'],
        undefined,
        undefined,
        false,
      ).then(({ stdout }) => stdout.trim()),
      execFileNoThrow(
        'git',
        ['rev-parse', '--abbrev-ref', 'origin/HEAD'],
        undefined,
        undefined,
        false,
      ).then(({ stdout }) => stdout.replace('origin/', '').trim()),
      execFileNoThrow(
        'git',
        ['status', '--short'],
        undefined,
        undefined,
        false,
      ).then(({ stdout }) => stdout.trim()),
      execFileNoThrow(
        'git',
        ['log', '--oneline', '-n', '5'],
        undefined,
        undefined,
        false,
      ).then(({ stdout }) => stdout.trim()),
      execFileNoThrow(
        'git',
        [
          'log',
          '--oneline',
          '-n',
          '5',
          '--author',
          (await getGitEmail()) || '',
        ],
        undefined,
        undefined,
        false,
      ).then(({ stdout }) => stdout.trim()),
    ])
    // Check if status has more than 200 lines
    const statusLines = status.split('\n').length
    const truncatedStatus =
      statusLines > 200
        ? status.split('\n').slice(0, 200).join('\n') +
          '\n... (truncated because there are more than 200 lines. If you need more information, run "git status" using BashTool)'
        : status

    return `This is the git status at the start of the conversation. Note that this status is a snapshot in time, and will not update during the conversation.\nCurrent branch: ${branch}\n\nMain branch (you will usually use this for PRs): ${mainBranch}\n\nStatus:\n${truncatedStatus || '(clean)'}\n\nRecent commits:\n${log}\n\nYour recent commits:\n${authorLog || '(no recent commits)'}`
  } catch (error) {
    logError(error)
    return null
  }
})

/**
 * This context is prepended to each conversation, and cached for the duration of the conversation.
 */
export const getContext = memoize(
  async (): Promise<{
    [k: string]: string
  }> => {
    const codeStyle = getCodeStyle()
    const projectConfig = getCurrentProjectConfig()
    const dontCrawl = projectConfig.dontCrawlDirectory
    const [gitStatus, directoryStructure, claudeFiles, readme, projectDocs] =
      await Promise.all([
        getGitStatus(),
        dontCrawl ? Promise.resolve('') : getDirectoryStructure(),
        dontCrawl ? Promise.resolve('') : getClaudeFiles(),
        getReadme(),
        getProjectDocs(),
      ])
    return {
      ...projectConfig.context,
      ...(directoryStructure ? { directoryStructure } : {}),
      ...(gitStatus ? { gitStatus } : {}),
      ...(codeStyle ? { codeStyle } : {}),
      ...(claudeFiles ? { claudeFiles } : {}),
      ...(readme ? { readme } : {}),
      ...(projectDocs ? { projectDocs } : {}),
    }
  },
)

/**
 * Approximate directory structure, to orient Claude. Claude will start with this, then use
 * tools like LS and View to get more information.
 */
export const getDirectoryStructure = memoize(
  async function (): Promise<string> {
    let lines: string
    try {
      const abortController = new AbortController()
      setTimeout(() => {
        abortController.abort()
      }, 1_000)
      // 🔧 Fix: Use ModelManager instead of legacy function
      const model = getModelManager().getModelName('main')
      const resultsGen = LSTool.call(
        {
          path: '.',
        },
        {
          abortController,
          options: {
            commands: [],
            tools: [],
            forkNumber: 0,
            messageLogName: 'unused',
            maxThinkingTokens: 0,
          },
          messageId: undefined,
          readFileTimestamps: {},
        },
      )
      const result = await lastX(resultsGen)
      lines = result.data
    } catch (error) {
      logError(error)
      return ''
    }

    return `Below is a snapshot of this project's file structure at the start of the conversation. This snapshot will NOT update during the conversation.

${lines}`
  },
)
