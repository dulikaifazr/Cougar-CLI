import { useEffect } from 'react'
 

export function useLogStartupTime(): void {
  useEffect(() => {
    const startupTimeMs = Math.round(process.uptime() * 1000)
  }, [])
}
