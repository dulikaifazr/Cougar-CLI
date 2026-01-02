import { readTextContent } from './file'
import { fileFreshnessService } from '@services/fileFreshness'

/**
 * File recovery configuration for auto-compact feature
 * These limits ensure recovered files don't overwhelm the compressed context
 */
const MAX_FILES_TO_RECOVER = 5
const MAX_TOKENS_PER_FILE = 10_000
const MAX_TOTAL_FILE_TOKENS = 50_000

/**
 * Selects and reads recently accessed files for context recovery
 *
 * During auto-compact, this function preserves development context by:
 * - Selecting files based on recent access patterns
 * - Enforcing token budgets to prevent context bloat
 * - Truncating large files while preserving essential content
 *
 * @returns Array of file data with content, token counts, and truncation flags
 */
export async function selectAndReadFiles(): Promise<
  Array<{
    path: string
    content: string
    tokens: number
    truncated: boolean
  }>
> {
  const importantFiles =
    fileFreshnessService.getImportantFiles(MAX_FILES_TO_RECOVER)
  const results = []
  let totalTokens = 0

  for (const fileInfo of importantFiles) {
    try {
      const { content } = readTextContent(fileInfo.path)
      const estimatedTokens = Math.ceil(content.length * 0.25)

      // Apply per-file token limit to prevent any single file from dominating context
      let finalContent = content
      let truncated = false

      if (estimatedTokens > MAX_TOKENS_PER_FILE) {
        const maxChars = Math.floor(MAX_TOKENS_PER_FILE / 0.25)
        finalContent = content.substring(0, maxChars)
        truncated = true
      }

      const finalTokens = Math.min(estimatedTokens, MAX_TOKENS_PER_FILE)

      // Enforce total token budget to maintain auto-compact effectiveness
      if (totalTokens + finalTokens > MAX_TOTAL_FILE_TOKENS) {
        break
      }

      totalTokens += finalTokens
      results.push({
        path: fileInfo.path,
        content: finalContent,
        tokens: finalTokens,
        truncated,
      })
    } catch (error) {
      // Skip files that cannot be read, don't let one failure stop the process
      console.error(`Failed to read file for recovery: ${fileInfo.path}`, error)
    }
  }

  return results
}
