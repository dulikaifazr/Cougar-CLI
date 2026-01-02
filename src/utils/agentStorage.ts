import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { randomUUID } from 'crypto'

/**
 * Agent Storage Utilities
 * Provides file-based state isolation for different agents
 * Based on cougar's Agent ID architecture
 */

/**
 * Get the cougar config directory
 */
function getConfigDirectory(): string {
  return process.env.COUGAR_CONFIG_DIR ?? process.env.ANYCOUGAR_CONFIG_DIR ?? join(homedir(), '.cougar')
}

/**
 * Get the current session ID
 */
function getSessionId(): string {
  // This should be set when the session starts
  return process.env.ANYCOUGAR_SESSION_ID ?? 'default-session'
}

/**
 * Generate agent-specific file path
 * Pattern: ${sessionId}-agent-${agentId}.json
 * Stored in ~/.cougar/ directory
 */
export function getAgentFilePath(agentId: string): string {
  const sessionId = getSessionId()
  const filename = `${sessionId}-agent-${agentId}.json`
  const configDir = getConfigDirectory()

  // Ensure cougar config directory exists
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true })
  }

  return join(configDir, filename)
}

/**
 * Read agent-specific data from storage
 */
export function readAgentData<T = any>(agentId: string): T | null {
  const filePath = getAgentFilePath(agentId)

  if (!existsSync(filePath)) {
    return null
  }

  try {
    const content = readFileSync(filePath, 'utf-8')
    return JSON.parse(content) as T
  } catch (error) {
    console.error(`Failed to read agent data for ${agentId}:`, error)
    return null
  }
}

/**
 * Write agent-specific data to storage
 */
export function writeAgentData<T = any>(agentId: string, data: T): void {
  const filePath = getAgentFilePath(agentId)

  try {
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  } catch (error) {
    console.error(`Failed to write agent data for ${agentId}:`, error)
    throw error
  }
}

/**
 * Get default agent ID if none is provided
 */
export function getDefaultAgentId(): string {
  return 'default'
}

/**
 * Resolve agent ID from context
 */
export function resolveAgentId(agentId?: string): string {
  return agentId || getDefaultAgentId()
}

/**
 * Generate a new unique Agent ID
 */
export function generateAgentId(): string {
  return randomUUID()
}
