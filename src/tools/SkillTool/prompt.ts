import { getActiveSkills } from '@utils/skillLoader'

export async function getPrompt(): Promise<string> {
  const skills = await getActiveSkills()

  if (skills.length === 0) {
    return `Execute a skill within the main conversation

<skills_instructions>
No skills are currently available. Skills can be added by creating directories with SKILL.md files in:
- ~/.claude/skills/skill-name/SKILL.md (personal skills)
- ~/.cougar/skills/skill-name/SKILL.md (personal skills)
- ./.claude/skills/skill-name/SKILL.md (project skills)
- ./.cougar/skills/skill-name/SKILL.md (project skills)

Each SKILL.md should have YAML frontmatter with 'name' and 'description' fields.
</skills_instructions>`
  }

  const skillDescriptions = skills.map(skill => {
    return `- ${skill.name}: ${skill.description}`
  }).join('\n')

  return `Execute a skill within the main conversation

<skills_instructions>
When users ask you to perform tasks, check if any of the available skills below can help complete the task more effectively. Skills provide specialized capabilities and domain knowledge.

How to invoke:
- Use this tool with the skill name only (no arguments)
- Examples:
  - \`skill: "pdf"\` - invoke the pdf skill
  - \`skill: "xlsx"\` - invoke the xlsx skill
  - \`skill: "ms-office-suite:pdf"\` - invoke using fully qualified name

Important:
- When a skill is relevant, invoke this tool before producing a detailed response
- Do not mention a skill in your response unless you actually invoked this tool
- Only use skills listed in <available_skills> below
- Do not invoke a skill that is already running
- Do not use this tool for built-in CLI commands (like /help, /clear, etc.)
</skills_instructions>

<available_skills>
${skillDescriptions}
</available_skills>
`
}

export const DESCRIPTION = `Invoke a skill to extend capabilities for the current task`
