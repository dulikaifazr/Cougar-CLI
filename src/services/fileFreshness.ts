import { statSync, existsSync, watchFile, unwatchFile } from 'fs'
import {
  emitReminderEvent,
  systemReminderService,
} from '@services/systemReminder'
import { getAgentFilePath } from '@utils/agentStorage'

interface FileTimestamp {
  path: string
  lastRead: number
  lastModified: number
  size: number
  lastAgentEdit?: number // Track when Agent last edited this file
}

interface FileFreshnessState {
  readTimestamps: Map<string, FileTimestamp>
  editConflicts: Set<string>
  sessionFiles: Set<string>
  watchedTodoFiles: Map<string, string> // agentId -> filePath
}

class FileFreshnessService {
  private state: FileFreshnessState = {
    readTimestamps: new Map(),
    editConflicts: new Set(),
    sessionFiles: new Set(),
    watchedTodoFiles: new Map(),
  }

  constructor() {
    this.setupEventListeners()
  }

  /**
   * Setup event listeners for session management
   */
  private setupEventListeners(): void {
    // Listen for session startup events through the SystemReminderService
    systemReminderService.addEventListener(
      'session:startup',
      (context: any) => {
        // Reset session state on startup
        this.resetSession()

        
      },
    )
  }

  /**
   * Record file read operation with timestamp tracking
   */
  public recordFileRead(filePath: string): void {
    try {
      if (!existsSync(filePath)) {
        return
      }

      const stats = statSync(filePath)
      const timestamp: FileTimestamp = {
        path: filePath,
        lastRead: Date.now(),
        lastModified: stats.mtimeMs,
        size: stats.size,
      }

      this.state.readTimestamps.set(filePath, timestamp)
      this.state.sessionFiles.add(filePath)

      // Emit file read event for system reminders
      emitReminderEvent('file:read', {
        filePath,
        timestamp: timestamp.lastRead,
        size: timestamp.size,
        modified: timestamp.lastModified,
      })
    } catch (error) {
      console.error(`Error recording file read for ${filePath}:`, error)
    }
  }

  /**
   * Check if file has been modified since last read
   */
  public checkFileFreshness(filePath: string): {
    isFresh: boolean
    lastRead?: number
    currentModified?: number
    conflict: boolean
  } {
    const recorded = this.state.readTimestamps.get(filePath)

    if (!recorded) {
      return { isFresh: true, conflict: false }
    }

    try {
      if (!existsSync(filePath)) {
        return { isFresh: false, conflict: true }
      }

      const currentStats = statSync(filePath)
      const isFresh = currentStats.mtimeMs <= recorded.lastModified
      const conflict = !isFresh

      if (conflict) {
        this.state.editConflicts.add(filePath)

        // Emit file conflict event
        emitReminderEvent('file:conflict', {
          filePath,
          lastRead: recorded.lastRead,
          lastModified: recorded.lastModified,
          currentModified: currentStats.mtimeMs,
          sizeDiff: currentStats.size - recorded.size,
        })
      }

      return {
        isFresh,
        lastRead: recorded.lastRead,
        currentModified: currentStats.mtimeMs,
        conflict,
      }
    } catch (error) {
      console.error(`Error checking freshness for ${filePath}:`, error)
      return { isFresh: false, conflict: true }
    }
  }

  /**
   * Record file edit operation by Agent
   */
  public recordFileEdit(filePath: string, content?: string): void {
    try {
      const now = Date.now()

      // Update recorded timestamp after edit
      if (existsSync(filePath)) {
        const stats = statSync(filePath)
        const existing = this.state.readTimestamps.get(filePath)

        if (existing) {
          existing.lastModified = stats.mtimeMs
          existing.size = stats.size
          existing.lastAgentEdit = now // Mark this as Agent-initiated edit
          this.state.readTimestamps.set(filePath, existing)
        } else {
          // Create new record for Agent-edited file
          const timestamp: FileTimestamp = {
            path: filePath,
            lastRead: now,
            lastModified: stats.mtimeMs,
            size: stats.size,
            lastAgentEdit: now,
          }
          this.state.readTimestamps.set(filePath, timestamp)
        }
      }

      // Remove from conflicts since we just edited it
      this.state.editConflicts.delete(filePath)

      // Emit file edit event
      emitReminderEvent('file:edited', {
        filePath,
        timestamp: now,
        contentLength: content?.length || 0,
        source: 'agent',
      })
    } catch (error) {
      console.error(`Error recording file edit for ${filePath}:`, error)
    }
  }

  public generateFileModificationReminder(filePath: string): string | null {
    const recorded = this.state.readTimestamps.get(filePath)

    if (!recorded) {
      return null
    }

    try {
      if (!existsSync(filePath)) {
        return `Note: ${filePath} was deleted since last read.`
      }

      const currentStats = statSync(filePath)
      const isModified = currentStats.mtimeMs > recorded.lastModified

      if (!isModified) {
        return null
      }

      // Check if this was an Agent-initiated change
      // Use small time tolerance to handle filesystem timestamp precision issues
      const TIME_TOLERANCE_MS = 100
      if (
        recorded.lastAgentEdit &&
        recorded.lastAgentEdit >= recorded.lastModified - TIME_TOLERANCE_MS
      ) {
        // Agent modified this file recently, no reminder needed
        // (context already contains before/after content)
        return null
      }

      // External modification detected - generate reminder
      return `Note: ${filePath} was modified externally since last read. The file may have changed outside of this session.`
    } catch (error) {
      console.error(`Error checking modification for ${filePath}:`, error)
      return null
    }
  }

  public getConflictedFiles(): string[] {
    return Array.from(this.state.editConflicts)
  }

  public getSessionFiles(): string[] {
    return Array.from(this.state.sessionFiles)
  }

  public resetSession(): void {
    // Clean up existing todo file watchers
    this.state.watchedTodoFiles.forEach(filePath => {
      try {
        unwatchFile(filePath)
      } catch (error) {
        console.error(`Error unwatching file ${filePath}:`, error)
      }
    })

    this.state = {
      readTimestamps: new Map(),
      editConflicts: new Set(),
      sessionFiles: new Set(),
      watchedTodoFiles: new Map(),
    }
  }

  /**
   * Start watching todo file for an agent
   */
  public startWatchingTodoFile(agentId: string): void {
    try {
      const filePath = getAgentFilePath(agentId)

      // Don't watch if already watching
      if (this.state.watchedTodoFiles.has(agentId)) {
        return
      }

      this.state.watchedTodoFiles.set(agentId, filePath)

      // Record initial state if file exists
      if (existsSync(filePath)) {
        this.recordFileRead(filePath)
      }

      // Start watching for changes
      watchFile(filePath, { interval: 1000 }, (curr, prev) => {
        // Check if this was an external modification
        const reminder = this.generateFileModificationReminder(filePath)
        if (reminder) {
          // File was modified externally, emit todo change reminder
          emitReminderEvent('todo:file_changed', {
            agentId,
            filePath,
            reminder,
            timestamp: Date.now(),
            currentStats: { mtime: curr.mtime, size: curr.size },
            previousStats: { mtime: prev.mtime, size: prev.size },
          })
        }
      })
    } catch (error) {
      console.error(
        `Error starting todo file watch for agent ${agentId}:`,
        error,
      )
    }
  }

  /**
   * Stop watching todo file for an agent
   */
  public stopWatchingTodoFile(agentId: string): void {
    try {
      const filePath = this.state.watchedTodoFiles.get(agentId)
      if (filePath) {
        unwatchFile(filePath)
        this.state.watchedTodoFiles.delete(agentId)
      }
    } catch (error) {
      console.error(
        `Error stopping todo file watch for agent ${agentId}:`,
        error,
      )
    }
  }

  public getFileInfo(filePath: string): FileTimestamp | null {
    return this.state.readTimestamps.get(filePath) || null
  }

  public isFileTracked(filePath: string): boolean {
    return this.state.readTimestamps.has(filePath)
  }

  /**
   * Retrieves files prioritized for recovery during conversation compression
   *
   * Selects recently accessed files based on:
   * - File access recency (most recent first)
   * - File type relevance (excludes dependencies, build artifacts)
   * - Development workflow importance
   *
   * Used to maintain coding context when conversation history is compressed
   */
  public getImportantFiles(maxFiles: number = 5): Array<{
    path: string
    timestamp: number
    size: number
  }> {
    return Array.from(this.state.readTimestamps.entries())
      .map(([path, info]) => ({
        path,
        timestamp: info.lastRead,
        size: info.size,
      }))
      .filter(file => this.isValidForRecovery(file.path))
      .sort((a, b) => b.timestamp - a.timestamp) // Newest first
      .slice(0, maxFiles)
  }

  /**
   * Determines which files are suitable for automatic recovery
   *
   * Excludes files that are typically not relevant for development context:
   * - Build artifacts and generated files
   * - Dependencies and cached files
   * - Temporary files and system directories
   */
  private isValidForRecovery(filePath: string): boolean {
    return (
      !filePath.includes('node_modules') &&
      !filePath.includes('.git') &&
      !filePath.startsWith('/tmp') &&
      !filePath.includes('.cache') &&
      !filePath.includes('dist/') &&
      !filePath.includes('build/')
    )
  }
}

export const fileFreshnessService = new FileFreshnessService()

export const recordFileRead = (filePath: string) =>
  fileFreshnessService.recordFileRead(filePath)
export const recordFileEdit = (filePath: string, content?: string) =>
  fileFreshnessService.recordFileEdit(filePath, content)
export const checkFileFreshness = (filePath: string) =>
  fileFreshnessService.checkFileFreshness(filePath)
export const generateFileModificationReminder = (filePath: string) =>
  fileFreshnessService.generateFileModificationReminder(filePath)
export const resetFileFreshnessSession = () =>
  fileFreshnessService.resetSession()
export const startWatchingTodoFile = (agentId: string) =>
  fileFreshnessService.startWatchingTodoFile(agentId)
export const stopWatchingTodoFile = (agentId: string) =>
  fileFreshnessService.stopWatchingTodoFile(agentId)
