import { getGlobalConfig, getOrCreateUserID } from './config'
import { memoize } from 'lodash-es'
import { env } from './env'
import { execFileNoThrow } from './execFileNoThrow'
import { logError, SESSION_ID } from './log'
import { MACRO } from '@constants/macros'
export const getGitEmail = memoize(async (): Promise<string | undefined> => {
  const result = await execFileNoThrow('git', ['config', 'user.email'])
  if (result.code !== 0) {
    logError(`Failed to get git email: ${result.stdout} ${result.stderr}`)
    return undefined
  }
  return result.stdout.trim() || undefined
})

type SimpleUser = {
  customIDs?: Record<string, string>
  userID: string
  appVersion?: string
  userAgent?: string
  email?: string
  custom?: Record<string, unknown>
}

export const getUser = memoize(async (): Promise<SimpleUser> => {
  const userID = getOrCreateUserID()
  const config = getGlobalConfig()
  const email = undefined
  return {
    customIDs: {
      // for session level tests
      sessionId: SESSION_ID,
    },
    userID,
    appVersion: MACRO.VERSION,
    userAgent: env.platform,
    email,
    custom: {
      nodeVersion: env.nodeVersion,
      userType: process.env.USER_TYPE,
      organizationUuid: config.oauthAccount?.organizationUuid,
      accountUuid: config.oauthAccount?.accountUuid,
    },
  }
})
