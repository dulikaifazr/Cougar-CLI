import { env } from '@utils/env'

// The former is better vertically aligned, but isn't usually supported on Windows/Linux
export const BLACK_CIRCLE = env.platform === 'macos' ? '⏺' : '●'
