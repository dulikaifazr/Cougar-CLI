import { ImageBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import { statSync } from 'node:fs'
import { Box, Text } from 'ink'
import * as path from 'node:path'
import { extname, relative } from 'node:path'
import * as React from 'react'
import { z } from 'zod'
import { FallbackToolUseRejectedMessage } from '@components/FallbackToolUseRejectedMessage'
import { HighlightedCode } from '@components/HighlightedCode'
import type { Tool } from '@tool'
import { getCwd } from '@utils/state'
import {
  addLineNumbers,
  findSimilarFile,
  normalizeFilePath,
  readTextContent,
} from '@utils/file'
import { logError } from '@utils/log'
import { getTheme } from '@utils/theme'
import { emitReminderEvent } from '@services/systemReminder'
import {
  recordFileRead,
  generateFileModificationReminder,
} from '@services/fileFreshness'
import { DESCRIPTION, PROMPT } from './prompt'
import { hasReadPermission } from '@utils/permissions/filesystem'
import { secureFileService } from '@utils/secureFile'

const MAX_LINES_TO_RENDER = 5
const MAX_OUTPUT_SIZE = 0.25 * 1024 * 1024 // 0.25MB in bytes

// Common image extensions
const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.bmp',
  '.webp',
])

// Maximum dimensions for images
const MAX_WIDTH = 2000
const MAX_HEIGHT = 2000
const MAX_IMAGE_SIZE = 3.75 * 1024 * 1024 // 5MB in bytes, with base64 encoding

const inputSchema = z.strictObject({
  file_path: z.string().describe('The absolute path to the file to read'),
  offset: z
    .number()
    .optional()
    .describe(
      'The line number to start reading from. Only provide if the file is too large to read at once',
    ),
  limit: z
    .number()
    .optional()
    .describe(
      'The number of lines to read. Only provide if the file is too large to read at once.',
    ),
})

export const FileReadTool = {
  name: 'View',
  async description() {
    return DESCRIPTION
  },
  async prompt() {
    return PROMPT
  },
  inputSchema,
  isReadOnly() {
    return true
  },
  isConcurrencySafe() {
    return true // FileRead is read-only, safe for concurrent execution
  },
  userFacingName() {
    return 'Read'
  },
  async isEnabled() {
    return true
  },
  needsPermissions({ file_path }) {
    return !hasReadPermission(file_path || getCwd())
  },
  renderToolUseMessage(input, { verbose }) {
    const { file_path, ...rest } = input
    const entries = [
      ['file_path', verbose ? file_path : relative(getCwd(), file_path)],
      ...Object.entries(rest),
    ]
    return entries
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join(', ')
  },
  renderToolResultMessage(output) {
    const verbose = false // Set default value for verbose
    // TODO: Render recursively
    switch (output.type) {
      case 'image':
        return (
          <Box justifyContent="space-between" overflowX="hidden" width="100%">
            <Box flexDirection="row">
              <Text>&nbsp;&nbsp;⎿ &nbsp;</Text>
              <Text>Read image</Text>
            </Box>
          </Box>
        )
      case 'text': {
        const { filePath, content, numLines } = output.file
        const contentWithFallback = content || '(No content)'
        return (
          <Box justifyContent="space-between" overflowX="hidden" width="100%">
            <Box flexDirection="row">
              <Text>&nbsp;&nbsp;⎿ &nbsp;</Text>
              <Box flexDirection="column">
                <HighlightedCode
                  code={
                    verbose
                      ? contentWithFallback
                      : contentWithFallback
                          .split('\n')
                          .slice(0, MAX_LINES_TO_RENDER)
                          .filter(_ => _.trim() !== '')
                          .join('\n')
                  }
                  language={extname(filePath).slice(1)}
                />
                {!verbose && numLines > MAX_LINES_TO_RENDER && (
                  <Text color={getTheme().secondaryText}>
                    ... (+{numLines - MAX_LINES_TO_RENDER} lines)
                  </Text>
                )}
              </Box>
            </Box>
          </Box>
        )
      }
    }
  },
  renderToolUseRejectedMessage() {
    return <FallbackToolUseRejectedMessage />
  },
  async validateInput({ file_path, offset, limit }) {
    const fullFilePath = normalizeFilePath(file_path)

    // Use secure file service to check if file exists and get file info
    const fileCheck = secureFileService.safeGetFileInfo(fullFilePath)
    if (!fileCheck.success) {
      // Try to find a similar file with a different extension
      const similarFilename = findSimilarFile(fullFilePath)
      let message = 'File does not exist.'

      // If we found a similar file, suggest it to the assistant
      if (similarFilename) {
        message += ` Did you mean ${similarFilename}?`
      }

      return {
        result: false,
        message,
      }
    }

    const stats = fileCheck.stats!
    const fileSize = stats.size
    const ext = path.extname(fullFilePath).toLowerCase()

    // Skip size check for image files - they have their own size limits
    if (!IMAGE_EXTENSIONS.has(ext)) {
      // If file is too large and no offset/limit provided
      if (fileSize > MAX_OUTPUT_SIZE && !offset && !limit) {
        return {
          result: false,
          message: formatFileSizeError(fileSize),
          meta: { fileSize },
        }
      }
    }

    return { result: true }
  },
  async *call(
    { file_path, offset = 1, limit = undefined },
    { readFileTimestamps },
  ) {
    const ext = path.extname(file_path).toLowerCase()
    const fullFilePath = normalizeFilePath(file_path)

    // Record file read for freshness tracking
    recordFileRead(fullFilePath)

    // Emit file read event for system reminders
    emitReminderEvent('file:read', {
      filePath: fullFilePath,
      extension: ext,
      timestamp: Date.now(),
    })

    // Update read timestamp, to invalidate stale writes
    readFileTimestamps[fullFilePath] = Date.now()

    // Check for file modifications and generate reminder if needed
    const modificationReminder = generateFileModificationReminder(fullFilePath)
    if (modificationReminder) {
      emitReminderEvent('file:modified', {
        filePath: fullFilePath,
        reminder: modificationReminder,
        timestamp: Date.now(),
      })
    }

    // If it's an image file, process and return base64 encoded contents
    if (IMAGE_EXTENSIONS.has(ext)) {
      const data = await readImage(fullFilePath, ext)
      yield {
        type: 'result',
        data,
        resultForAssistant: this.renderResultForAssistant(data),
      }
      return
    }

    // Handle offset properly - if offset is 0, don't subtract 1
    const lineOffset = offset === 0 ? 0 : offset - 1
    const { content, lineCount, totalLines } = readTextContent(
      fullFilePath,
      lineOffset,
      limit,
    )

    // Add size validation after reading for non-image files
    if (!IMAGE_EXTENSIONS.has(ext) && content.length > MAX_OUTPUT_SIZE) {
      throw new Error(formatFileSizeError(content.length))
    }

    const data = {
      type: 'text' as const,
      file: {
        filePath: file_path,
        content: content,
        numLines: lineCount,
        startLine: offset,
        totalLines,
      },
    }

    yield {
      type: 'result',
      data,
      resultForAssistant: this.renderResultForAssistant(data),
    }
  },
  renderResultForAssistant(data) {
    switch (data.type) {
      case 'image':
        return [
          {
            type: 'image',
            source: {
              type: 'base64',
              data: data.file.base64,
              media_type: data.file.type,
            },
          },
        ]
      case 'text':
        return addLineNumbers(data.file)
    }
  },
} satisfies Tool<
  typeof inputSchema,
  | {
      type: 'text'
      file: {
        filePath: string
        content: string
        numLines: number
        startLine: number
        totalLines: number
      }
    }
  | {
      type: 'image'
      file: { base64: string; type: ImageBlockParam.Source['media_type'] }
    }
>

const formatFileSizeError = (sizeInBytes: number) =>
  `File content (${Math.round(sizeInBytes / 1024)}KB) exceeds maximum allowed size (${Math.round(MAX_OUTPUT_SIZE / 1024)}KB). Please use offset and limit parameters to read specific portions of the file, or use the GrepTool to search for specific content.`

function createImageResponse(
  buffer: Buffer,
  ext: string,
): {
  type: 'image'
  file: { base64: string; type: ImageBlockParam.Source['media_type'] }
} {
  return {
    type: 'image',
    file: {
      base64: buffer.toString('base64'),
      type: `image/${ext.slice(1)}` as ImageBlockParam.Source['media_type'],
    },
  }
}

async function readImage(
  filePath: string,
  ext: string,
): Promise<{
  type: 'image'
  file: { base64: string; type: ImageBlockParam.Source['media_type'] }
}> {
  try {
    const stats = statSync(filePath)
    const sharp = (
      (await import('sharp')) as unknown as { default: typeof import('sharp') }
    ).default
    
    // Use secure file service to read the file
    const fileReadResult = secureFileService.safeReadFile(filePath, {
      encoding: 'buffer' as BufferEncoding,
      maxFileSize: MAX_IMAGE_SIZE
    })
    
    if (!fileReadResult.success) {
      throw new Error(`Failed to read image file: ${fileReadResult.error}`)
    }
    
    const image = sharp(fileReadResult.content as Buffer)
    const metadata = await image.metadata()

    if (!metadata.width || !metadata.height) {
      if (stats.size > MAX_IMAGE_SIZE) {
        const compressedBuffer = await image.jpeg({ quality: 80 }).toBuffer()
        return createImageResponse(compressedBuffer, 'jpeg')
      }
    }

    // Calculate dimensions while maintaining aspect ratio
    let width = metadata.width || 0
    let height = metadata.height || 0

    // Check if the original file just works
    if (
      stats.size <= MAX_IMAGE_SIZE &&
      width <= MAX_WIDTH &&
      height <= MAX_HEIGHT
    ) {
      // Use secure file service to read the file
      const fileReadResult = secureFileService.safeReadFile(filePath, {
        encoding: 'buffer' as BufferEncoding,
        maxFileSize: MAX_IMAGE_SIZE
      })
      
      if (!fileReadResult.success) {
        throw new Error(`Failed to read image file: ${fileReadResult.error}`)
      }
      
      return createImageResponse(fileReadResult.content as Buffer, ext)
    }

    if (width > MAX_WIDTH) {
      height = Math.round((height * MAX_WIDTH) / width)
      width = MAX_WIDTH
    }

    if (height > MAX_HEIGHT) {
      width = Math.round((width * MAX_HEIGHT) / height)
      height = MAX_HEIGHT
    }

    // Resize image and convert to buffer
    const resizedImageBuffer = await image
      .resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toBuffer()

    // If still too large after resize, compress quality
    if (resizedImageBuffer.length > MAX_IMAGE_SIZE) {
      const compressedBuffer = await image.jpeg({ quality: 80 }).toBuffer()
      return createImageResponse(compressedBuffer, 'jpeg')
    }

    return createImageResponse(resizedImageBuffer, ext)
  } catch (e) {
    logError(e)
    // If any error occurs during processing, return original image
    const fileReadResult = secureFileService.safeReadFile(filePath, {
      encoding: 'buffer' as BufferEncoding,
      maxFileSize: MAX_IMAGE_SIZE
    })
    
    if (!fileReadResult.success) {
      throw new Error(`Failed to read image file: ${fileReadResult.error}`)
    }
    
    return createImageResponse(fileReadResult.content as Buffer, ext)
  }
}
