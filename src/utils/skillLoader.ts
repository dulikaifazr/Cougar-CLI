/**
 * Skill configuration loader
 * Loads skill configurations from SKILL.md files with YAML frontmatter.
 * Compatible with Claude Code `.claude/skills` directory structure.
 *
 * Skills are directory-based: each skill is a folder containing SKILL.md
 * Example: ~/.claude/skills/pdf/SKILL.md
 */

import { existsSync, readFileSync, readdirSync, statSync, watch, FSWatcher } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import matter from 'gray-matter'
import { getCwd } from './state'
import { memoize } from 'lodash-es'

export interface SkillConfig {
  name: string              // Skill identifier (from frontmatter or directory name)
  description: string       // When to use this skill (for model discovery)
  instructions: string      // Skill instructions (markdown body)
  allowedTools?: string[]   // Optional: restrict available tools
  location: 'user' | 'project'
  dirPath: string          // Full path to skill directory
}

/**
 * Parse allowed-tools field from frontmatter
 */
function parseAllowedTools(tools: any): string[] | undefined {
  if (!tools) return undefined
  if (Array.isArray(tools)) {
    const filtered = tools.filter((t): t is string => typeof t === 'string')
    return filtered.length > 0 ? filtered : undefined
  }
  if (typeof tools === 'string') {
    // Support comma-separated string: "Read, Grep, Glob"
    return tools.split(',').map(t => t.trim()).filter(Boolean)
  }
  return undefined
}

/**
 * Scan a directory for skill configurations
 * Skills are directories containing SKILL.md
 */
async function scanSkillDirectory(basePath: string, location: 'user' | 'project'): Promise<SkillConfig[]> {
  if (!existsSync(basePath)) {
    return []
  }

  const skills: SkillConfig[] = []

  try {
    const entries = readdirSync(basePath)

    for (const entry of entries) {
      const skillDirPath = join(basePath, entry)
      const stat = statSync(skillDirPath)

      // Skills must be directories
      if (!stat.isDirectory()) continue

      const skillFilePath = join(skillDirPath, 'SKILL.md')

      // Check if SKILL.md exists in the directory
      if (!existsSync(skillFilePath)) continue

      try {
        const content = readFileSync(skillFilePath, 'utf-8')
        const { data: frontmatter, content: body } = matter(content)

        // Use frontmatter name or directory name as skill identifier
        const skillName = frontmatter.name || entry

        // Validate required description field
        if (!frontmatter.description) {
          console.warn(`Skipping skill ${skillFilePath}: missing required 'description' field`)
          continue
        }

        const skill: SkillConfig = {
          name: skillName,
          description: frontmatter.description,
          instructions: body.trim(),
          allowedTools: parseAllowedTools(frontmatter['allowed-tools']),
          location,
          dirPath: skillDirPath,
        }

        skills.push(skill)
      } catch (error) {
        console.warn(`Failed to parse skill file ${skillFilePath}:`, error)
      }
    }
  } catch (error) {
    console.warn(`Failed to scan skills directory ${basePath}:`, error)
  }

  return skills
}

/**
 * Load all skill configurations from all directories
 */
async function loadAllSkills(): Promise<{
  activeSkills: SkillConfig[]
  allSkills: SkillConfig[]
}> {
  try {
    // Scan both .claude and .cougar directories in parallel
    // Priority: .claude (user) < .cougar (user) < .claude (project) < .cougar (project)
    const userClaudeDir = join(homedir(), '.claude', 'skills')
    const userKodeDir = join(homedir(), '.cougar', 'skills')
    const projectClaudeDir = join(getCwd(), '.claude', 'skills')
    const projectKodeDir = join(getCwd(), '.cougar', 'skills')

    const [userClaudeSkills, userKodeSkills, projectClaudeSkills, projectKodeSkills] = await Promise.all([
      scanSkillDirectory(userClaudeDir, 'user'),
      scanSkillDirectory(userKodeDir, 'user'),
      scanSkillDirectory(projectClaudeDir, 'project'),
      scanSkillDirectory(projectKodeDir, 'project')
    ])

    // Apply priority override (later entries override earlier ones with same name)
    const skillMap = new Map<string, SkillConfig>()

    for (const skill of userClaudeSkills) {
      skillMap.set(skill.name, skill)
    }
    for (const skill of userKodeSkills) {
      skillMap.set(skill.name, skill)
    }
    for (const skill of projectClaudeSkills) {
      skillMap.set(skill.name, skill)
    }
    for (const skill of projectKodeSkills) {
      skillMap.set(skill.name, skill)
    }

    const activeSkills = Array.from(skillMap.values())
    const allSkills = [...userClaudeSkills, ...userKodeSkills, ...projectClaudeSkills, ...projectKodeSkills]

    return { activeSkills, allSkills }
  } catch (error) {
    console.error('Failed to load skills:', error)
    return {
      activeSkills: [],
      allSkills: []
    }
  }
}

// Memoized version for performance
export const getActiveSkills = memoize(
  async (): Promise<SkillConfig[]> => {
    const { activeSkills } = await loadAllSkills()
    return activeSkills
  }
)

// Get all skills (both active and overridden)
export const getAllSkills = memoize(
  async (): Promise<SkillConfig[]> => {
    const { allSkills } = await loadAllSkills()
    return allSkills
  }
)

// Clear cache when needed
export function clearSkillCache() {
  getActiveSkills.cache?.clear?.()
  getAllSkills.cache?.clear?.()
  getSkillByName.cache?.clear?.()
  getAvailableSkillNames.cache?.clear?.()
}

// Get a specific skill by name
export const getSkillByName = memoize(
  async (skillName: string): Promise<SkillConfig | undefined> => {
    const skills = await getActiveSkills()
    return skills.find(skill => skill.name === skillName)
  }
)

// Get all available skill names for validation
export const getAvailableSkillNames = memoize(
  async (): Promise<string[]> => {
    const skills = await getActiveSkills()
    return skills.map(skill => skill.name)
  }
)

// Read a supporting file from a skill directory
export async function readSkillFile(skillName: string, filename: string): Promise<string | null> {
  const skill = await getSkillByName(skillName)
  if (!skill) return null

  const filePath = join(skill.dirPath, filename)
  if (!existsSync(filePath)) return null

  try {
    return readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

// List files in a skill directory
export async function listSkillFiles(skillName: string): Promise<string[]> {
  const skill = await getSkillByName(skillName)
  if (!skill) return []

  try {
    return readdirSync(skill.dirPath).filter(f => f !== 'SKILL.md')
  } catch {
    return []
  }
}

// File watcher for hot reload
let watchers: FSWatcher[] = []

/**
 * Start watching skill directories for changes
 */
export async function startSkillWatcher(onChange?: () => void): Promise<void> {
  await stopSkillWatcher() // Clean up any existing watchers

  const userClaudeDir = join(homedir(), '.claude', 'skills')
  const userKodeDir = join(homedir(), '.cougar', 'skills')
  const projectClaudeDir = join(getCwd(), '.claude', 'skills')
  const projectKodeDir = join(getCwd(), '.cougar', 'skills')

  const watchDirectory = (dirPath: string, label: string) => {
    if (existsSync(dirPath)) {
      // Watch with recursive to catch SKILL.md changes in subdirectories
      const watcher = watch(dirPath, { recursive: true }, async (eventType, filename) => {
        if (filename && (filename.endsWith('SKILL.md') || filename === 'SKILL.md')) {
          if (process.env.COUGAR_DEBUG_SKILLS === '1') {
            console.log(`🔄 Skill configuration changed in ${label}: ${filename}`)
          }
          clearSkillCache()
          onChange?.()
        }
      })
      watchers.push(watcher)
    }
  }

  watchDirectory(userClaudeDir, 'user/.claude/skills')
  watchDirectory(userKodeDir, 'user/.cougar/skills')
  watchDirectory(projectClaudeDir, 'project/.claude/skills')
  watchDirectory(projectKodeDir, 'project/.cougar/skills')
}

/**
 * Stop watching skill directories
 */
export async function stopSkillWatcher(): Promise<void> {
  try {
    for (const watcher of watchers) {
      try {
        watcher.close()
      } catch (err) {
        console.error('Failed to close skill watcher:', err)
      }
    }
  } finally {
    watchers = []
  }
}
