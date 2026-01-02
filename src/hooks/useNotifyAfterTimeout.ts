import { useEffect } from 'react'
import { sendNotification } from '@services/notifier'
import { memoize } from 'lodash-es'

// The time threshold in milliseconds for considering an interaction "recent" (6 seconds)
const DEFAULT_INTERACTION_THRESHOLD_MS = 6000

const STATE = {
  lastInteractionTime: Date.now(),
}

function updateLastInteractionTime(): void {
  STATE.lastInteractionTime = Date.now()
}

function getTimeSinceLastInteraction(): number {
  return Date.now() - STATE.lastInteractionTime
}

function hasRecentInteraction(threshold: number): boolean {
  return getTimeSinceLastInteraction() < threshold
}

function shouldNotify(threshold: number): boolean {
  return process.env.NODE_ENV !== 'test' && !hasRecentInteraction(threshold)
}

// Start tracking the time of the user's last interaction with the app
const init = memoize(() => process.stdin.on('data', updateLastInteractionTime))

/**
 * Hook that manages desktop notifications after a timeout period.
 *
 * Shows a notification in two cases:
 * 1. Immediately if the app has been idle for longer than the threshold
 * 2. After the specified timeout if the user doesn't interact within that time
 *
 * @param message - The notification message to display
 * @param timeout - The timeout in milliseconds (defaults to 6000ms)
 */
export function useNotifyAfterTimeout(
  message: string,
  timeout: number = DEFAULT_INTERACTION_THRESHOLD_MS,
): void {
  // Reset interaction time when hook is called to make sure that requests
  // that took a long time to complete don't pop up a notification right away
  useEffect(() => {
    init()
    updateLastInteractionTime()
  }, [])

  useEffect(() => {
    let hasNotified = false
    const timer = setInterval(() => {
      if (shouldNotify(timeout) && !hasNotified) {
        hasNotified = true
        sendNotification({
          message,
        })
      }
    }, timeout)

    return () => clearTimeout(timer)
  }, [message, timeout])
}
