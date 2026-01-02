import { execFileNoThrow } from './execFileNoThrow'
import { logError } from './log'
 
import { lt, gt } from 'semver'
import { MACRO } from '@constants/macros'
import { PRODUCT_NAME } from '@constants/product'
import { getGlobalConfig, saveGlobalConfig, isAutoUpdaterDisabled } from './config'
import { env } from './env'

export type VersionConfig = {
  minVersion: string
}

// Ensure current version meets minimum supported version; exit if too old
export async function assertMinVersion(): Promise<void> {
  try {
    const versionConfig: VersionConfig = { minVersion: '0.0.0' }
    if (versionConfig.minVersion && lt(MACRO.VERSION, versionConfig.minVersion)) {
      const suggestions = await getUpdateCommandSuggestions()
      // Intentionally minimal: caller may print its own message; we just exit
      // eslint-disable-next-line no-console
      console.error(
        `Your ${PRODUCT_NAME} version ${MACRO.VERSION} is below the minimum supported ${versionConfig.minVersion}.\n` +
          'Update using one of:\n' +
          suggestions.map(c => `  ${c}`).join('\n'),
      )
      process.exit(1)
    }
  } catch (error) {
    logError(`Error checking minimum version: ${error}`)
  }
}

// Get latest version from npm (via npm CLI or HTTP fallback)
export async function getLatestVersion(): Promise<string | null> {
  // Prefer npm CLI (fast when available)
  try {
    const abortController = new AbortController()
    setTimeout(() => abortController.abort(), 5000)
    const result = await execFileNoThrow(
      'npm',
      ['view', MACRO.PACKAGE_URL, 'version'],
      abortController.signal,
    )
    if (result.code === 0) {
      const v = result.stdout.trim()
      if (v) return v
    }
  } catch {}

  // Fallback: query npm registry directly
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(MACRO.PACKAGE_URL)}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.npm.install-v1+json',
          'User-Agent': `${PRODUCT_NAME}/${MACRO.VERSION}`,
        },
        signal: controller.signal,
      },
    )
    clearTimeout(timer)
    if (!res.ok) return null
    const json: any = await res.json().catch(() => null)
    const latest = json && json['dist-tags'] && json['dist-tags'].latest
    return typeof latest === 'string' ? latest : null
  } catch {
    return null
  }
}

// Suggest manual update commands; prefer Bun first, then npm
export async function getUpdateCommandSuggestions(): Promise<string[]> {
  return [
    `bun add -g ${MACRO.PACKAGE_URL}@latest`,
    `npm install -g ${MACRO.PACKAGE_URL}@latest`,
  ]
}

// Optional: background notifier that prints a simple banner
export async function checkAndNotifyUpdate(): Promise<void> {
  try {
    if (process.env.NODE_ENV === 'test') return
    if (await isAutoUpdaterDisabled()) return
    if (await env.getIsDocker()) return
    if (!(await env.hasInternetAccess())) return

    const config: any = getGlobalConfig()
    const now = Date.now()
    const DAY_MS = 24 * 60 * 60 * 1000
    const lastCheck = Number(config.lastUpdateCheckAt || 0)
    if (lastCheck && now - lastCheck < DAY_MS) return

    const latest = await getLatestVersion()
    if (!latest) {
      saveGlobalConfig({ ...config, lastUpdateCheckAt: now })
      return
    }

    if (gt(latest, MACRO.VERSION)) {
      saveGlobalConfig({
        ...config,
        lastUpdateCheckAt: now,
        lastSuggestedVersion: latest,
      })
      const suggestions = await getUpdateCommandSuggestions()
      // eslint-disable-next-line no-console
      console.log(`New version available: ${latest} (current: ${MACRO.VERSION})`)
      console.log('Run the following command to update:')
      for (const command of suggestions) console.log(`  ${command}`)
    } else {
      saveGlobalConfig({ ...config, lastUpdateCheckAt: now })
    }
  } catch (error) {
    logError(`update-notify: ${error}`)
  }
}
