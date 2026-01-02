import { isAbsolute, resolve } from 'path'
import { getCwd } from '@utils/state'
import { readFileSync } from 'fs'
import { detectFileEncoding } from '@utils/file'
import { type Hunk } from 'diff'
import { getPatch } from '@utils/diff'

/**
 * Applies an edit to a file and returns the patch and updated file.
 * Does not write the file to disk.
 */
export function applyEdit(
  file_path: string,
  old_string: string,
  new_string: string,
): { patch: Hunk[]; updatedFile: string } {
  const fullFilePath = isAbsolute(file_path)
    ? file_path
    : resolve(getCwd(), file_path)

  let originalFile
  let updatedFile
  if (old_string === '') {
    // Create new file
    originalFile = ''
    updatedFile = new_string
  } else {
    // Edit existing file
    const enc = detectFileEncoding(fullFilePath)
    originalFile = readFileSync(fullFilePath, enc)
    if (new_string === '') {
      if (
        !old_string.endsWith('\n') &&
        originalFile.includes(old_string + '\n')
      ) {
        updatedFile = originalFile.replace(old_string + '\n', () => new_string)
      } else {
        updatedFile = originalFile.replace(old_string, () => new_string)
      }
    } else {
      updatedFile = originalFile.replace(old_string, () => new_string)
    }
    if (updatedFile === originalFile) {
      throw new Error(
        'Original and edited file match exactly. Failed to apply edit.',
      )
    }
  }

  const patch = getPatch({
    filePath: file_path,
    fileContents: originalFile,
    oldStr: originalFile,
    newStr: updatedFile,
  })

  return { patch, updatedFile }
}
