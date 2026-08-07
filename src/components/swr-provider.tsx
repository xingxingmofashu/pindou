"use client"

import type { ReactNode } from "react"
import { SWRConfig, type Cache, type State } from "swr"

/** Cache keys under this prefix are persisted to localStorage. */
const PERSIST_PREFIX = "/api/brands"
/** localStorage key holding the persisted SWR cache. */
const STORAGE_KEY = "swr-cache-brands"
/** How long a persisted entry stays fresh before being discarded. */
const TTL_MS = 7 * 24 * 60 * 60 * 1000

interface StoredEntry {
  /** ms epoch when the entry was written to storage. */
  timestamp: number
  value: State
}

/**
 * SWR global configuration.
 *
 * Brands are effectively immutable at runtime (they only change via
 * `db:migrate`), so their responses are persisted to localStorage for 7 days —
 * refreshing the page renders the palette instantly while SWR revalidates in
 * the background. Pattern lists/details stay in-memory only, so they always
 * pick up fresh data on mount.
 */
export function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        provider: brandsPersistentProvider,
        keepPreviousData: true,
        dedupingInterval: 2000,
        revalidateOnFocus: false,
        errorRetryCount: 2,
      }}
    >
      {children}
    </SWRConfig>
  )
}

/** In-memory SWR cache, hydrated with unexpired persisted brands entries. */
function brandsPersistentProvider(): Cache {
  const cache = new Map<string, State>()
  if (typeof window === "undefined") return cache

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const entries = JSON.parse(raw) as Array<[string, StoredEntry]>
      const now = Date.now()
      for (const [key, entry] of entries) {
        if (now - entry.timestamp < TTL_MS) cache.set(key, entry.value)
      }
    }
  } catch {
    // Ignore malformed storage
  }

  const persist = () => {
    const now = Date.now()
    const entries: Array<[string, StoredEntry]> = []
    for (const [key, value] of cache) {
      if (key.startsWith(PERSIST_PREFIX)) entries.push([key, { timestamp: now, value }])
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch {
      // Ignore quota errors
    }
  }
  window.addEventListener("beforeunload", persist)

  return cache
}
