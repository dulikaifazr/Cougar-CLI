import { existsSync, readFileSync } from 'fs'
import { join, parse, dirname } from 'path'
import { memoize } from 'lodash-es'
import { getCwd } from './state'
import { PROJECT_FILE } from '@constants/product'

const STYLE_PROMPT =
  'The codebase follows strict style guidelines shown below. All code changes must strictly adhere to these guidelines to maintain consistency and quality.'

export const getCodeStyle = memoize((): string => {
  const styles: string[] = []
  let currentDir = getCwd()

  while (currentDir !== parse(currentDir).root) {
    const stylePath = join(currentDir, PROJECT_FILE)
    if (existsSync(stylePath)) {
      styles.push(
        `Contents of ${stylePath}:\n\n${readFileSync(stylePath, 'utf-8')}`,
      )
    }
    currentDir = dirname(currentDir)
  }

  if (styles.length === 0) {
    return ''
  }

  return `${STYLE_PROMPT}\n\n${styles.reverse().join('\n\n')}`
})
