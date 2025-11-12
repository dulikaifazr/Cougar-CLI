/**
 * CLI Checkpoints Module - 统一导出
 * 
 * 为 CLI 系统提供完整的 checkpoint 功能
 * 这是 CLI 版本的主入口文件
 */

// ============================================================================
// 核心类
// ============================================================================
export { default as CheckpointTracker } from './CheckpointTracker'
export { GitOperations } from './CheckpointGitOperations'

// ============================================================================
// 工具函数
// ============================================================================
export {
  getShadowGitPath,
  hashWorkingDir,
  validateWorkspacePath,
  getWorkingDirectory,
} from './CheckpointUtils'

// ============================================================================
// 锁管理（CLI 简化版本）
// ============================================================================
export {
  tryAcquireCheckpointLockWithRetry,
  releaseCheckpointLock,
  type FolderLockWithRetryResult,
} from './CheckpointLockUtils'

// ============================================================================
// CLI 友好接口
// ============================================================================
export {
  CLICheckpointManager,
  createCheckpointManager,
  defaultCheckpointManager,
  type CheckpointInfo,
  type FileDiff,
} from './cli-interface'

// ============================================================================
// 类型定义
// ============================================================================
export { ICheckpointManager } from './types'

// ============================================================================
// 排除规则（可选）
// ============================================================================
export { getLfsPatterns, writeExcludesFile } from './CheckpointExclusions'

/**
 * 默认导出：CLI Checkpoint Manager 类
 * 
 * 使用示例：
 * ```typescript
 * import CheckpointManager from './checkpoints'
 * 
 * const manager = new CheckpointManager('my-session')
 * const hash = await manager.saveCheckpoint('My checkpoint')
 * await manager.restoreCheckpoint(hash)
 * ```
 */
export { CLICheckpointManager as default } from './cli-interface'