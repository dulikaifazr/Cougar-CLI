import { existsSync, readFileSync } from 'fs'
import { Box, Text } from 'ink'
import { extname, isAbsolute, relative, resolve } from 'path'
import * as React from 'react'
import { z } from 'zod'
import { FallbackToolUseRejectedMessage } from '@components/FallbackToolUseRejectedMessage'
import { HighlightedCode } from '@components/HighlightedCode'
import type { Tool } from '@tool'
import { NotebookCellType, NotebookContent } from '@cougar-types/notebook'
import {
  detectFileEncoding,
  detectLineEndings,
  writeTextContent,
} from '@utils/file'
import { safeParseJSON } from '@utils/json'
import { getCwd } from '@utils/state'
import { DESCRIPTION, PROMPT } from './prompt'
import { hasWritePermission } from '@utils/permissions/filesystem'
import { emitReminderEvent } from '@services/systemReminder'
import { recordFileEdit } from '@services/fileFreshness'

const inputSchema = z.strictObject({
  notebook_path: z
    .string()
    .describe(
      'The absolute path to the Jupyter notebook file to edit (must be absolute, not relative)',
    ),
  cell_number: z.number().describe('The index of the cell to edit (0-based)'),
  new_source: z.string().describe('The new source for the cell'),
  cell_type: z
    .enum(['code', 'markdown'])
    .optional()
    .describe(
      'The type of the cell (code or markdown). If not specified, it defaults to the current cell type. If using edit_mode=insert, this is required.',
    ),
  edit_mode: z
    .string()
    .optional()
    .describe(
      'The type of edit to make (replace, insert, delete). Defaults to replace.',
    ),
})

export const NotebookEditTool = {
  name: 'NotebookEditCell',
  async description() {
    return DESCRIPTION
  },
  async prompt() {
    return PROMPT
  },
  inputSchema,
  userFacingName() {
    return 'Edit Notebook'
  },
  async isEnabled() {
    return true
  },
  isReadOnly() {
    return false
  },
  isConcurrencySafe() {
    return false // NotebookEditTool modifies state/files, not safe for concurrent execution
  },
  needsPermissions({ notebook_path }) {
    return !hasWritePermission(notebook_path)
  },
  renderResultForAssistant({ cell_number, edit_mode, new_source, error }) {
    if (error) {
      return error
    }
    switch (edit_mode) {
      case 'replace':
        return `Updated cell ${cell_number} with ${new_source}`
      case 'insert':
        return `Inserted cell ${cell_number} with ${new_source}`
      case 'delete':
        return `Deleted cell ${cell_number}`
    }
  },
  renderToolUseMessage(input, { verbose }) {
    return `notebook_path: ${verbose ? input.notebook_path : relative(getCwd(), input.notebook_path)}, cell: ${input.cell_number}, content: ${input.new_source.slice(0, 30)}…, cell_type: ${input.cell_type}, edit_mode: ${input.edit_mode ?? 'replace'}`
  },
  renderToolUseRejectedMessage() {
    return <FallbackToolUseRejectedMessage />
  },
  renderToolResultMessage({ cell_number, new_source, language, error }) {
    if (error) {
      return (
        <Box flexDirection="column">
          <Text color="red">{error}</Text>
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        <Text>Updated cell {cell_number}:</Text>
        <Box marginLeft={2}>
          <HighlightedCode code={new_source} language={language} />
        </Box>
      </Box>
    )
  },
  async validateInput({
    notebook_path,
    cell_number,
    cell_type,
    edit_mode = 'replace',
  }) {
    const fullPath = isAbsolute(notebook_path)
      ? notebook_path
      : resolve(getCwd(), notebook_path)

    if (!existsSync(fullPath)) {
      return {
        result: false,
        message: 'Notebook file does not exist.',
      }
    }

    if (extname(fullPath) !== '.ipynb') {
      return {
        result: false,
        message:
          'File must be a Jupyter notebook (.ipynb file). For editing other file types, use the FileEdit tool.',
      }
    }

    if (cell_number < 0) {
      return {
        result: false,
        message: 'Cell number must be non-negative.',
      }
    }

    if (
      edit_mode !== 'replace' &&
      edit_mode !== 'insert' &&
      edit_mode !== 'delete'
    ) {
      return {
        result: false,
        message: 'Edit mode must be replace, insert, or delete.',
      }
    }

    if (edit_mode === 'insert' && !cell_type) {
      return {
        result: false,
        message: 'Cell type is required when using edit_mode=insert.',
      }
    }

    const enc = detectFileEncoding(fullPath)
    const content = readFileSync(fullPath, enc)
    const notebook = safeParseJSON(content) as NotebookContent | null
    if (!notebook) {
      return {
        result: false,
        message: 'Notebook is not valid JSON.',
      }
    }

    if (edit_mode === 'insert' && cell_number > notebook.cells.length) {
      return {
        result: false,
        message: `Cell number is out of bounds. For insert mode, the maximum value is ${notebook.cells.length} (to append at the end).`,
      }
    } else if (
      (edit_mode === 'replace' || edit_mode === 'delete') &&
      (cell_number >= notebook.cells.length || !notebook.cells[cell_number])
    ) {
      return {
        result: false,
        message: `Cell number is out of bounds. Notebook has ${notebook.cells.length} cells.`,
      }
    }

    return { result: true }
  },
  async *call({
    notebook_path,
    cell_number,
    new_source,
    cell_type,
    edit_mode,
  }) {
    const fullPath = isAbsolute(notebook_path)
      ? notebook_path
      : resolve(getCwd(), notebook_path)

    try {
      const enc = detectFileEncoding(fullPath)
      const content = readFileSync(fullPath, enc)
      const notebook = JSON.parse(content) as NotebookContent
      const language = notebook.metadata.language_info?.name ?? 'python'

      if (edit_mode === 'delete') {
        // Delete the specified cell
        notebook.cells.splice(cell_number, 1)
      } else if (edit_mode === 'insert') {
        // Insert the new cell
        const new_cell = {
          cell_type: cell_type!, // validateInput ensures cell_type is not undefined
          source: new_source,
          metadata: {},
        }
        notebook.cells.splice(
          cell_number,
          0,
          cell_type == 'markdown' ? new_cell : { ...new_cell, outputs: [] },
        )
      } else {
        // Find the specified cell
        const targetCell = notebook.cells[cell_number]! // validateInput ensures cell_number is in bounds
        targetCell.source = new_source
        // Reset execution count and clear outputs since cell was modified
        targetCell.execution_count = undefined
        targetCell.outputs = []
        if (cell_type && cell_type !== targetCell.cell_type) {
          targetCell.cell_type = cell_type
        }
      }
      // Write back to file
      const endings = detectLineEndings(fullPath)
      const updatedNotebook = JSON.stringify(notebook, null, 1)
      writeTextContent(fullPath, updatedNotebook, enc, endings!)

      // Record Agent edit operation for file freshness tracking
      recordFileEdit(fullPath, updatedNotebook)

      // Emit file edited event for system reminders
      emitReminderEvent('file:edited', {
        filePath: fullPath,
        cellNumber: cell_number,
        newSource: new_source,
        cellType: cell_type,
        editMode: edit_mode || 'replace',
        timestamp: Date.now(),
        operation: 'notebook_edit',
      })
      const data = {
        cell_number,
        new_source,
        cell_type: cell_type ?? 'code',
        language,
        edit_mode: edit_mode ?? 'replace',
        error: '',
      }
      yield {
        type: 'result',
        data,
        resultForAssistant: this.renderResultForAssistant(data),
      }
    } catch (error) {
      if (error instanceof Error) {
        const data = {
          cell_number,
          new_source,
          cell_type: cell_type ?? 'code',
          language: 'python',
          edit_mode: 'replace',
          error: error.message,
        }
        yield {
          type: 'result',
          data,
          resultForAssistant: this.renderResultForAssistant(data),
        }
        return
      }
      const data = {
        cell_number,
        new_source,
        cell_type: cell_type ?? 'code',
        language: 'python',
        edit_mode: 'replace',
        error: 'Unknown error occurred while editing notebook',
      }
      yield {
        type: 'result',
        data,
        resultForAssistant: this.renderResultForAssistant(data),
      }
    }
  },
} satisfies Tool<
  typeof inputSchema,
  {
    cell_number: number
    new_source: string
    cell_type: NotebookCellType
    language: string
    edit_mode: string
    error?: string
  }
>
