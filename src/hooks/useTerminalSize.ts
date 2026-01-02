import { useEffect, useState } from 'react'

// Global state to share across all hook instances
let globalSize = {
  columns: process.stdout.columns || 80,
  rows: process.stdout.rows || 24,
}

const listeners = new Set<() => void>()
let isListenerAttached = false

function updateAllListeners() {
  globalSize = {
    columns: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
  }
  listeners.forEach(listener => listener())
}

export function useTerminalSize() {
  const [size, setSize] = useState(globalSize)

  useEffect(() => {
    // Add this component's listener to the set
    const updateSize = () => setSize({ ...globalSize })
    listeners.add(updateSize)

    // Only attach the global resize listener once
    if (!isListenerAttached) {
      // Increase max listeners to prevent warnings
      process.stdout.setMaxListeners(20)
      process.stdout.on('resize', updateAllListeners)
      isListenerAttached = true
    }

    return () => {
      // Remove this component's listener
      listeners.delete(updateSize)

      // If no more listeners, remove the global listener
      if (listeners.size === 0 && isListenerAttached) {
        process.stdout.off('resize', updateAllListeners)
        isListenerAttached = false
      }
    }
  }, [])

  return size
}
