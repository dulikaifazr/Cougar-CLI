import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

function readPackageJsonVersion(): string {
  const startDir = dirname(fileURLToPath(import.meta.url))
  let dir = startDir
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, 'package.json')
    if (existsSync(candidate)) {
      try {
        const pkg = JSON.parse(readFileSync(candidate, 'utf8'))
        if (typeof pkg?.version === 'string') return pkg.version
      } catch {
      }
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return '0.0.0'
}

export const MACRO = {
  VERSION: readPackageJsonVersion(),
}
