"use client"

import { useEffect, useRef } from "react"

export function useDebounce(
  callback: () => void,
  delayMs: number,
  deps: unknown[]
): void {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(callback, delayMs)
    return () => clearTimeout(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
