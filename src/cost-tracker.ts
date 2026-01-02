import chalk from 'chalk'
import { useEffect } from 'react'
import { formatDuration } from './utils/format'
import {
  getCurrentProjectConfig,
  saveCurrentProjectConfig,
} from '@utils/config'
import { SESSION_ID } from './utils/log'

// DO NOT ADD MORE STATE HERE OR BORIS WILL CURSE YOU
const STATE: {
  totalCost: number
  totalAPIDuration: number
  startTime: number
} = {
  totalCost: 0,
  totalAPIDuration: 0,
  startTime: Date.now(),
}

export function addToTotalCost(cost: number, duration: number): void {
  STATE.totalCost += cost
  STATE.totalAPIDuration += duration
}

export function getTotalCost(): number {
  return STATE.totalCost
}

export function getTotalDuration(): number {
  return Date.now() - STATE.startTime
}

export function getTotalAPIDuration(): number {
  return STATE.totalAPIDuration
}

function formatCost(cost: number): string {
  return `$${cost > 0.5 ? round(cost, 100).toFixed(2) : cost.toFixed(4)}`
}

export function formatTotalCost(): string {
  return chalk.grey(
    `Total cost: ${formatCost(STATE.totalCost)}
Total duration (API): ${formatDuration(STATE.totalAPIDuration)}
Total duration (wall): ${formatDuration(getTotalDuration())}`,
  )
}

export function useCostSummary(): void {
  useEffect(() => {
    const f = () => {
      process.stdout.write('\n' + formatTotalCost() + '\n')

      // Save last cost and duration to project config
      const projectConfig = getCurrentProjectConfig()
      saveCurrentProjectConfig({
        ...projectConfig,
        lastCost: STATE.totalCost,
        lastAPIDuration: STATE.totalAPIDuration,
        lastDuration: getTotalDuration(),
        lastSessionId: SESSION_ID,
      })
    }
    process.on('exit', f)
    return () => {
      process.off('exit', f)
    }
  }, [])
}

function round(number: number, precision: number): number {
  return Math.round(number * precision) / precision
}

// Only used in tests
export function resetStateForTests(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('resetStateForTests can only be called in tests')
  }
  STATE.startTime = Date.now()
  STATE.totalCost = 0
  STATE.totalAPIDuration = 0
}
