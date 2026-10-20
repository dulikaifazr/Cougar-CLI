import { build } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Bundle source aliases as ESM, matching the CLI build (Ink uses top-level await).
const scratch = mkdtempSync(resolve('node_modules/.cougar-mcp-test-'))
try {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  const outfile = join(scratch, 'mcp-parallel.test.mjs')
  await build({
    entryPoints: ['test/mcp-parallel.test.mts'],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    external: Object.keys(pkg.dependencies),
    tsconfig: 'tsconfig.json',
  })
  // Imported runtime caches have process-wide maintenance intervals.
  execFileSync(process.execPath, ['--test', '--test-force-exit', outfile], {
    stdio: 'inherit',
  })
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
