/**
 * CLI Checkpoint Interface
 * 
 * 为 CLI 系统提供简化的 checkpoint 管理接口
 * 封装 CheckpointTracker 的核心功能，提供友好的 CLI API
 */

import CheckpointTracker from './CheckpointTracker'
import simpleGit from 'simple-git'
import * as path from 'path'
import { getShadowGitPath, hashWorkingDir } from './CheckpointUtils'

/**
 * Checkpoint 信息接口
 */
export interface CheckpointInfo {
  hash: string
  shortHash: string
  message: string
  date: Date
  author: string
}

/**
 * 文件差异接口
 */
export interface FileDiff {
  relativePath: string
  absolutePath: string
  before: string
  after: string
  linesAdded: number
  linesRemoved: number
}

/**
 * CLI Checkpoint Manager
 * 
 * 核心功能：
 * - saveCheckpoint: 保存当前工作区状态
 * - restoreCheckpoint: 恢复到指定检查点
 * - listCheckpoints: 列出所有检查点
 * - getCheckpointDiff: 获取检查点差异
 * - getCheckpointInfo: 获取检查点详情
 */
export class CLICheckpointManager {
  private sessionId: string
  private cwd: string

  constructor(sessionId: string = 'default', cwd?: string) {
    this.sessionId = sessionId
    this.cwd = cwd || process.cwd()
  }

  /**
   * 保存当前工作区为检查点
   * @param message 可选的检查点描述信息
   * @returns 返回创建的 commit hash
   */
  async saveCheckpoint(message?: string): Promise<string | undefined> {
    try {
      console.debug(`[CLI Checkpoint] Saving checkpoint for session: ${this.sessionId}`)
      
      const tracker = await CheckpointTracker.create(
        this.sessionId,
        true, // enableCheckpoints
        this.cwd
      )

      if (!tracker) {
        throw new Error('无法初始化 checkpoint tracker')
      }

      const hash = await tracker.commit()
      
      if (hash && message) {
        // 如果提供了消息，可以在这里记录（暂时只在日志中）
        console.debug(`[CLI Checkpoint] Saved with message: ${message}`)
      }

      return hash
    } catch (error) {
      console.error('[CLI Checkpoint] Save failed:', error)
      throw error
    }
  }

  /**
   * 恢复工作区到指定检查点
   * @param hash 检查点的 commit hash（完整或短 hash）
   */
  async restoreCheckpoint(hash: string): Promise<void> {
    try {
      console.debug(`[CLI Checkpoint] Restoring to: ${hash}`)
      
      const tracker = await CheckpointTracker.create(
        this.sessionId,
        true,
        this.cwd
      )

      if (!tracker) {
        throw new Error('无法初始化 checkpoint tracker')
      }

      await tracker.resetHead(hash)
      console.debug(`[CLI Checkpoint] Restore completed`)
    } catch (error) {
      console.error('[CLI Checkpoint] Restore failed:', error)
      throw error
    }
  }

  /**
   * 列出所有检查点
   * @param limit 限制返回数量（默认 10）
   * @returns 检查点信息数组
   */
  async listCheckpoints(limit: number = 10): Promise<CheckpointInfo[]> {
    try {
      const cwdHash = hashWorkingDir(this.cwd)
      const gitPath = await getShadowGitPath(cwdHash)
      const git = simpleGit(path.dirname(gitPath))

      // 获取 git log
      const log = await git.log({ maxCount: limit })

      // 转换为 CheckpointInfo 格式
      return log.all.map(commit => ({
        hash: commit.hash,
        shortHash: commit.hash.substring(0, 8),
        message: commit.message,
        date: new Date(commit.date),
        author: commit.author_name,
      }))
    } catch (error) {
      console.error('[CLI Checkpoint] List failed:', error)
      throw error
    }
  }

  /**
   * 获取检查点详细信息
   * @param hash 检查点的 commit hash
   * @returns 检查点详细信息
   */
  async getCheckpointInfo(hash: string): Promise<CheckpointInfo | null> {
    try {
      const cwdHash = hashWorkingDir(this.cwd)
      const gitPath = await getShadowGitPath(cwdHash)
      const git = simpleGit(path.dirname(gitPath))

      const log = await git.log({ from: hash, to: hash })
      
      if (log.all.length === 0) {
        return null
      }

      const commit = log.all[0]
      return {
        hash: commit.hash,
        shortHash: commit.hash.substring(0, 8),
        message: commit.message,
        date: new Date(commit.date),
        author: commit.author_name,
      }
    } catch (error) {
      console.error('[CLI Checkpoint] Get info failed:', error)
      return null
    }
  }

  /**
   * 获取检查点之间的文件差异
   * @param hash1 旧检查点的 hash
   * @param hash2 新检查点的 hash（可选，不提供则与当前工作区比较）
   * @returns 文件差异数组
   */
  async getCheckpointDiff(
    hash1: string,
    hash2?: string
  ): Promise<FileDiff[]> {
    try {
      const tracker = await CheckpointTracker.create(
        this.sessionId,
        true,
        this.cwd
      )

      if (!tracker) {
        throw new Error('无法初始化 checkpoint tracker')
      }

      const diffSet = await tracker.getDiffSet(hash1, hash2)

      // 转换为 FileDiff 格式并计算行数变化
      return diffSet.map(file => {
        const beforeLines = file.before.split('\n').length
        const afterLines = file.after.split('\n').length
        const diff = afterLines - beforeLines

        return {
          relativePath: file.relativePath,
          absolutePath: file.absolutePath,
          before: file.before,
          after: file.after,
          linesAdded: diff > 0 ? diff : 0,
          linesRemoved: diff < 0 ? Math.abs(diff) : 0,
        }
      })
    } catch (error) {
      console.error('[CLI Checkpoint] Get diff failed:', error)
      throw error
    }
  }

  /**
   * 获取检查点的文件变更统计
   * @param hash1 旧检查点的 hash
   * @param hash2 新检查点的 hash（可选）
   * @returns 变更文件数量
   */
  async getCheckpointDiffCount(
    hash1: string,
    hash2?: string
  ): Promise<number> {
    try {
      const tracker = await CheckpointTracker.create(
        this.sessionId,
        true,
        this.cwd
      )

      if (!tracker) {
        throw new Error('无法初始化 checkpoint tracker')
      }

      return await tracker.getDiffCount(hash1, hash2)
    } catch (error) {
      console.error('[CLI Checkpoint] Get diff count failed:', error)
      throw error
    }
  }

  /**
   * 获取检查点统计信息
   * @param hash 检查点的 hash
   * @returns 统计信息（文件数、插入行、删除行）
   */
  async getCheckpointStats(hash: string): Promise<{
    files: number
    insertions: number
    deletions: number
  }> {
    try {
      const cwdHash = hashWorkingDir(this.cwd)
      const gitPath = await getShadowGitPath(cwdHash)
      const git = simpleGit(path.dirname(gitPath))

      // 获取与父提交的差异统计
      const diffSummary = await git.diffSummary([`${hash}^`, hash])

      return {
        files: diffSummary.files.length,
        insertions: diffSummary.insertions,
        deletions: diffSummary.deletions,
      }
    } catch (error) {
      console.error('[CLI Checkpoint] Get stats failed:', error)
      return { files: 0, insertions: 0, deletions: 0 }
    }
  }

  /**
   * 检查是否存在检查点
   * @returns 是否存在至少一个检查点
   */
  async hasCheckpoints(): Promise<boolean> {
    try {
      const checkpoints = await this.listCheckpoints(1)
      return checkpoints.length > 0
    } catch (error) {
      return false
    }
  }
}

/**
 * 创建 CLI Checkpoint Manager 实例
 * @param sessionId 会话 ID（默认 'default'）
 * @param cwd 工作目录（默认 process.cwd()）
 * @returns CLICheckpointManager 实例
 */
export function createCheckpointManager(
  sessionId?: string,
  cwd?: string
): CLICheckpointManager {
  return new CLICheckpointManager(sessionId, cwd)
}

/**
 * 导出默认实例（使用 default 会话）
 */
export const defaultCheckpointManager = new CLICheckpointManager('default')