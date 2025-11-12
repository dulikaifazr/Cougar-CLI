/**
 * CLI version: Simplified lock system for single-user environment
 * 
 * In CLI mode, we skip actual file locking since:
 * 1. Single user environment (no multi-instance conflicts)
 * 2. Simpler deployment without database dependencies
 * 3. Process-level safety is sufficient
 */

export interface FolderLockWithRetryResult {
	acquired: boolean
	skipped: boolean
	conflictingLock?: any
}

/**
 * Base path for checkpoint folders
 */
const CHECKPOINTS_BASE_PATH = "~/.cline-cli/checkpoints"

/**
 * CLI: Attempt to acquire checkpoint folder lock (simplified version)
 * 
 * For CLI single-user environment, we skip actual locking.
 * Returns skipped=true to indicate lock was not needed.
 *
 * @param cwdHash - The hash of the working directory
 * @param taskId - The task ID
 * @returns Promise<FolderLockWithRetryResult> with skipped status
 */
export async function tryAcquireCheckpointLockWithRetry(
	cwdHash: string,
	taskId: string
): Promise<FolderLockWithRetryResult> {
	// CLI 版本: 跳过锁定，单用户环境不需要并发控制
	console.debug(`[Checkpoint Lock] Skipping lock for CLI mode: ${cwdHash}`)
	return {
		acquired: false,
		skipped: true, // 表示跳过了锁定
	}
}

/**
 * CLI: Release checkpoint folder lock (simplified version)
 * 
 * For CLI single-user environment, this is a no-op.
 *
 * @param cwdHash - The hash of the working directory
 * @param taskId - The task ID
 */
export async function releaseCheckpointLock(cwdHash: string, taskId: string): Promise<void> {
	// CLI 版本: 无操作
	console.debug(`[Checkpoint Lock] No lock to release (CLI mode)`)
}
