import { z } from 'zod'
import React from 'react'
import { Box, Text } from 'ink'
import { Tool } from '@tool'
import { TOOL_NAME } from './constants'
import { getPrompt, DESCRIPTION } from './prompt'
import { getSkillByName, getAvailableSkillNames, listSkillFiles } from '@utils/skillLoader'
import { getTheme } from '@utils/theme'
import { MessageResponse } from '@components/MessageResponse'

const inputSchema = z.object({
  skill: z.string().describe('The skill name (no arguments). E.g., "pdf" or "xlsx"'),
})

type SkillInput = z.infer<typeof inputSchema>

interface SkillResult {
  skillName: string
  instructions: string
  supportingFiles?: string[]
  error?: string
}

export const SkillTool = {
  name: TOOL_NAME,
  userFacingName: () => 'Skill',
  description: async () => DESCRIPTION,
  inputSchema,

  isEnabled: async () => true,
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  needsPermissions: () => false,

  prompt: async () => getPrompt(),

  async *call(
    input: SkillInput,
    _context
  ): AsyncGenerator<
    | { type: 'result'; data: SkillResult; resultForAssistant?: string }
    | { type: 'progress'; content: any },
    void,
    unknown
  > {
    const { skill: skillName } = input

    // Load the skill configuration
    const skill = await getSkillByName(skillName)

    if (!skill) {
      const availableSkills = await getAvailableSkillNames()
      const errorMessage = availableSkills.length > 0
        ? `Skill "${skillName}" not found.\n\nAvailable skills:\n${availableSkills.map(s => `  - ${s}`).join('\n')}`
        : `Skill "${skillName}" not found. No skills are currently configured.\n\nTo add skills, create directories with SKILL.md files in:\n  - ~/.claude/skills/skill-name/SKILL.md\n  - ~/.cougar/skills/skill-name/SKILL.md\n  - ./.claude/skills/skill-name/SKILL.md\n  - ./.cougar/skills/skill-name/SKILL.md`

      yield {
        type: 'result',
        data: {
          skillName,
          instructions: '',
          error: errorMessage,
        },
        resultForAssistant: errorMessage,
      }
      return
    }

    // Get list of supporting files in the skill directory
    const supportingFiles = await listSkillFiles(skillName)

    // Build the result with skill instructions
    const result: SkillResult = {
      skillName: skill.name,
      instructions: skill.instructions,
      supportingFiles: supportingFiles.length > 0 ? supportingFiles : undefined,
    }

    // Format the output for the assistant
    let resultForAssistant = `# Skill: ${skill.name}\n\n${skill.instructions}`

    if (supportingFiles.length > 0) {
      resultForAssistant += `\n\n## Supporting Files\nThe following files are available in this skill's directory:\n${supportingFiles.map(f => `- ${f}`).join('\n')}`
    }

    if (skill.allowedTools && skill.allowedTools.length > 0) {
      resultForAssistant += `\n\n## Allowed Tools\nThis skill restricts tool usage to: ${skill.allowedTools.join(', ')}`
    }

    yield {
      type: 'result',
      data: result,
      resultForAssistant,
    }
  },

  renderToolUseMessage(input: SkillInput, options: { verbose: boolean }): string {
    return `Invoking skill: ${input.skill}`
  },

  renderToolUseRejectedMessage() {
    return (
      <MessageResponse children={<Text color={getTheme().error}>Skill invocation cancelled</Text>} />
    )
  },

  renderToolResultMessage(output: SkillResult) {
    const theme = getTheme()

    if (output.error) {
      return (
        <MessageResponse children={
          <Box flexDirection="column">
            <Text color={theme.error}>Skill Error</Text>
            <Text>{output.error}</Text>
          </Box>
        } />
      )
    }

    return (
      <MessageResponse children={
        <Box flexDirection="column">
          <Text color={theme.success}>Skill loaded: {output.skillName}</Text>
          {output.supportingFiles && output.supportingFiles.length > 0 && (
            <Text dimColor>
              Supporting files: {output.supportingFiles.join(', ')}
            </Text>
          )}
        </Box>
      } />
    )
  },

  renderResultForAssistant(output: SkillResult): string {
    if (output.error) {
      return output.error
    }
    return `Skill "${output.skillName}" loaded successfully. Instructions have been provided.`
  },
} satisfies Tool<typeof inputSchema, SkillResult>
