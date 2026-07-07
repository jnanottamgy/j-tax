"use client"

import { useEffect, useMemo, useRef } from "react"

/**
 * Debounce a callback — used by search inputs so each keystroke doesn't
 * fire a server round-trip (and results can't land out of order).
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs = 350
) {
  const callbackRef = useRef(callback)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep the latest callback without re-creating the debounced fn
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return useMemo(
    () =>
      (...args: Args) => {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          callbackRef.current(...args)
        }, delayMs)
      },
    [delayMs]
  )
}
