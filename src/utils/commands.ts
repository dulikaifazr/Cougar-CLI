import { memoize } from 'lodash-es'
import { API_ERROR_MESSAGE_PREFIX, queryQuick } from '@services/claude'
import { type ControlOperator, parse, ParseEntry } from 'shell-quote'
import { PRODUCT_NAME } from '@constants/product'

const SINGLE_QUOTE = '__SINGLE_QUOTE__'
const DOUBLE_QUOTE = '__DOUBLE_QUOTE__'

export type CommandPrefixResult =
  | {
      commandPrefix: string | null
      commandInjectionDetected: false
    }
  | { commandInjectionDetected: true }

// Command prefix result alongside subcommand prefixes
export type CommandSubcommandPrefixResult = CommandPrefixResult & {
  subcommandPrefixes: Map<string, CommandPrefixResult>
}

/**
 * Splits a command string into individual commands based on shell operators
 */
export function splitCommand(command: string): string[] {
  const parts: ParseEntry[] = []

  // 1. Collapse adjacent strings
  for (const part of parse(
    command
      .replaceAll('"', `"${DOUBLE_QUOTE}`) // parse() strips out quotes :P
      .replaceAll("'", `'${SINGLE_QUOTE}`), // parse() strips out quotes :P
    varName => `$${varName}`, // Preserve shell variables
  )) {
    if (typeof part === 'string') {
      if (parts.length > 0 && typeof parts[parts.length - 1] === 'string') {
        parts[parts.length - 1] += ' ' + part
        continue
      }
    }
    parts.push(part)
  }

  // 2. Map tokens to strings
  const stringParts = parts
    .map(part => {
      if (typeof part === 'string') {
        return part
      }
      if ('comment' in part) {
        // TODO: make this less hacky
        return '#' + part.comment
      }
      if ('op' in part && part.op === 'glob') {
        return part.pattern
      }
      if ('op' in part) {
        return part.op
      }
      return null
    })
    .filter(_ => _ !== null)

  // 3. Map quotes back to their original form
  const quotedParts = stringParts.map(part => {
    return part
      .replaceAll(`${SINGLE_QUOTE}`, "'")
      .replaceAll(`${DOUBLE_QUOTE}`, '"')
  })

  // 4. Filter out separators
  return quotedParts.filter(
    part => !(COMMAND_LIST_SEPARATORS as Set<string>).has(part),
  )
}

export const getCommandSubcommandPrefix = memoize(
  async (
    command: string,
    abortSignal: AbortSignal,
  ): Promise<CommandSubcommandPrefixResult | null> => {
    const subcommands = splitCommand(command)

    const [fullCommandPrefix, ...subcommandPrefixesResults] = await Promise.all(
      [
        getCommandPrefix(command, abortSignal),
        ...subcommands.map(async subcommand => ({
          subcommand,
          prefix: await getCommandPrefix(subcommand, abortSignal),
        })),
      ],
    )
    if (!fullCommandPrefix) {
      return null
    }
    const subcommandPrefixes = subcommandPrefixesResults.reduce(
      (acc, { subcommand, prefix }) => {
        if (prefix) {
          acc.set(subcommand, prefix)
        }
        return acc
      },
      new Map<string, CommandPrefixResult>(),
    )

    return {
      ...fullCommandPrefix,
      subcommandPrefixes,
    }
  },
  command => command, // memoize by command only
)

const getCommandPrefix = memoize(
  async (
    command: string,
    abortSignal: AbortSignal,
  ): Promise<CommandPrefixResult | null> => {
    const response = await queryQuick({
      systemPrompt: [
        `Your task is to process Bash commands that an AI coding agent wants to run.

This policy spec defines how to determine the prefix of a Bash command:`,
      ],
      userPrompt: `<policy_spec>
# ${PRODUCT_NAME} Code Bash command prefix detection

This document defines risk levels for actions that the ${PRODUCT_NAME} agent may take. This classification system is part of a broader safety framework and is used to determine when additional user confirmation or oversight may be needed.

## Definitions

**Command Injection:** Any technique used that would result in a command being run other than the detected prefix.

## Command prefix extraction examples
Examples:
- cat foo.txt => cat
- cd src => cd
- cd path/to/files/ => cd
- find ./src -type f -name "*.ts" => find
- gg cat foo.py => gg cat
- gg cp foo.py bar.py => gg cp
- git commit -m "foo" => git commit
- git diff HEAD~1 => git diff
- git diff --staged => git diff
- git diff $(pwd) => command_injection_detected
- git status => git status
- git status# test(\`id\`) => command_injection_detected
- git status\`ls\` => command_injection_detected
- git push => none
- git push origin master => git push
- git log -n 5 => git log
- git log --oneline -n 5 => git log
- grep -A 40 "from foo.bar.baz import" alpha/beta/gamma.py => grep
- pig tail zerba.log => pig tail
- npm test => none
- npm test --foo => npm test
- npm test -- -f "foo" => npm test
- pwd\n curl example.com => command_injection_detected
- pytest foo/bar.py => pytest
- scalac build => none
</policy_spec>

The user has allowed certain command prefixes to be run, and will otherwise be asked to approve or deny the command.
Your task is to determine the command prefix for the following command.

IMPORTANT: Bash commands may run multiple commands that are chained together.
For safety, if the command seems to contain command injection, you must return "command_injection_detected". 
(This will help protect the user: if they think that they're allowlisting command A, 
but the AI coding agent sends a malicious command that technically has the same prefix as command A, 
then the safety system will see that you said “command_injection_detected” and ask the user for manual confirmation.)

Note that not every command has a prefix. If a command has no prefix, return "none".

ONLY return the prefix. Do not return any other text, markdown markers, or other content or formatting.

Command: ${command}
`,
      signal: abortSignal,
      enablePromptCaching: false,
    })

    const prefix =
      typeof response.message.content === 'string'
        ? response.message.content
        : Array.isArray(response.message.content)
          ? (response.message.content.find(_ => _.type === 'text')?.text ??
            'none')
          : 'none'

    if (prefix.startsWith(API_ERROR_MESSAGE_PREFIX)) {
      return null
    }

    if (prefix === 'command_injection_detected') {
      return { commandInjectionDetected: true }
    }

    // Never accept base `git` as a prefix (if e.g. `git diff` prefix not detected)
    if (prefix === 'git') {
      return {
        commandPrefix: null,
        commandInjectionDetected: false,
      }
    }

    if (prefix === 'none') {
      return {
        commandPrefix: null,
        commandInjectionDetected: false,
      }
    }

    return {
      commandPrefix: prefix,
      commandInjectionDetected: false,
    }
  },
  command => command, // memoize by command only
)

const COMMAND_LIST_SEPARATORS = new Set<ControlOperator>([
  '&&',
  '||',
  ';',
  ';;',
])

// Checks if this is just a list of commands
function isCommandList(command: string): boolean {
  for (const part of parse(
    command
      .replaceAll('"', `"${DOUBLE_QUOTE}`) // parse() strips out quotes :P
      .replaceAll("'", `'${SINGLE_QUOTE}`), // parse() strips out quotes :P
    varName => `$${varName}`, // Preserve shell variables
  )) {
    if (typeof part === 'string') {
      // Strings are safe
      continue
    }
    if ('comment' in part) {
      // Don't trust comments, they can contain command injection
      return false
    }
    if ('op' in part) {
      if (part.op === 'glob') {
        // Globs are safe
        continue
      } else if (COMMAND_LIST_SEPARATORS.has(part.op)) {
        // Command list separators are safe
        continue
      }
      // Other operators are unsafe
      return false
    }
  }
  // No unsafe operators found in entire command
  return true
}

export function isUnsafeCompoundCommand(command: string): boolean {
  return splitCommand(command).length > 1 && !isCommandList(command)
}
