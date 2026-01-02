import { useEffect, useRef } from 'react'

/**
 * A custom hook that runs a callback at a specified interval.
 * The interval is cleared when the component unmounts.
 * The interval is also cleared and restarted if the delay changes.
 */
export function useInterval(callback: () => void, delay: number): void {
  const savedCallback = useRef(callback)

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  // Set up the interval
  useEffect(() => {
    function tick() {
      savedCallback.current()
    }

    const id = setInterval(tick, delay)
    return () => clearInterval(id)
  }, [delay])
}
