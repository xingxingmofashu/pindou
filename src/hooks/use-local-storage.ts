"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * 持久化 localStorage 的泛型 hook（versioned schema 防损坏）。
 * 返回 [value, setValue, removeValue]。
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (v: T) => void, () => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored !== null) return JSON.parse(stored) as T
    } catch {
      // ignore
    }
    return initialValue
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // quota exceeded
    }
  }, [key, value])

  const remove = useCallback(() => {
    localStorage.removeItem(key)
    setValue(initialValue)
  }, [key, initialValue])

  return [value, setValue, remove]
}
