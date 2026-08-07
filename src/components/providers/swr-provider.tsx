"use client"

import type { ReactNode } from "react"
import { SWRConfig, type Cache, type State } from "swr"

/**
 * localStorage key holding all persisted SWR entries. Fixed name — the
 * persisted *shape* version lives per-entry as {@link STORAGE_VERSION}, so
 * data changes (e.g. a `db:migrate` that reorders the palette) need no manual
 * bump: SWR's stale-while-revalidate refreshes the entry on the next mount and
 * `persist()` overwrites it. Only bump {@link STORAGE_VERSION} when the
 * `StoredEntry` shape itself changes.
 */
const STORAGE_KEY = "pindou-swr-cache"

/** Version of the `StoredEntry` shape; mismatches are discarded on read. */
const STORAGE_VERSION = 2

/** A cache-key prefix pinned to localStorage for {@link PersistRule.ttlMs}. */
interface PersistRule {
  prefix: string
  ttlMs: number
}

/**
 * Persistence rules. Add a rule here to persist any other slow, rarely changing
 * data (e.g. `/api/brands/[id]`); everything else stays in-memory.
 */
const PERSIST_RULES: PersistRule[] = [
  { prefix: "/api/brands", ttlMs: 7 * 24 * 60 * 60 * 1000 },
]

interface StoredEntry {
  /** Shape version, matched against {@link STORAGE_VERSION} on read. */
  version: number
  /** ms epoch when the entry was written to storage. */
  timestamp: number
  value: State
}

interface ParsedEntry extends StoredEntry {
  key: string
}

/** A storage wrapper whose getters/setters never throw. */
interface SafeStorage {
  get(key: string): string | null
  set(key: string, value: string): void
}

/** Log persistence problems in development only. */
function warn(label: string, error?: unknown) {
  if (process.env.NODE_ENV === "production") return
  console.warn(`[swr-provider] ${label}`, error)
}

/**
 * Wrap localStorage so reads/writes never throw: availability is probed once
 * (private mode or disabled storage throws on access), then every operation
 * degrades to a no-op. Failures are reported via {@link warn}.
 */
function createSafeStorage(): SafeStorage {
  let storage: Storage | null | undefined

  const probe = (): Storage | null => {
    if (storage !== undefined) return storage
    try {
      storage = window.localStorage
      const probeKey = "pindou-swr-probe"
      storage.setItem(probeKey, "1")
      storage.removeItem(probeKey)
    } catch (error) {
      storage = null
      warn("localStorage unavailable; persistence disabled", error)
    }
    return storage
  }

  return {
    get: (key) => {
      const store = probe()
      if (!store) return null
      try {
        return store.getItem(key)
      } catch (error) {
        warn("failed to read persisted cache", error)
        return null
      }
    },
    set: (key, value) => {
      const store = probe()
      if (!store) return
      try {
        store.setItem(key, value)
      } catch (error) {
        warn("failed to persist SWR cache", error)
      }
    },
  }
}

/** Parse stored JSON into rows, returning null when missing or malformed. */
function parseRows(raw: string | null): Array<unknown> | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch (error) {
    warn("malformed persisted cache; starting empty", error)
    return null
  }
}

/** Parse a persisted row, returning null when it's malformed or from another schema version. */
function parseEntry(value: unknown): ParsedEntry | null {
  if (!Array.isArray(value) || value.length !== 2) return null
  const [key, entry] = value as [unknown, unknown]
  if (typeof key !== "string" || typeof entry !== "object" || entry === null) return null
  const { version, timestamp, value: data } = entry as { version?: unknown; timestamp: unknown; value?: unknown }
  if (typeof version !== "number" || version !== STORAGE_VERSION) return null
  if (typeof timestamp !== "number" || data === undefined) return null
  return { key, version, timestamp, value: data as State }
}

/**
 * Build a SWR cache provider that mirrors {@link PersistRule}-matched keys to
 * localStorage.
 *
 * The cache is created lazily on first mount (hydrated from storage) and
 * written back whenever the tab is hidden or the page unloads, so in-memory
 * data survives backgrounding and refreshes. SSR renders get an empty cache,
 * keeping hydration consistent.
 */
function createPersistentProvider(
  rules: PersistRule[],
  storageKey: string,
): () => Cache {
  let cache: Map<string, State> | null = null
  const matches = (key: string) => rules.some((rule) => key.startsWith(rule.prefix))
  const ttlOf = (key: string) => rules.find((rule) => key.startsWith(rule.prefix))?.ttlMs
  const storage = createSafeStorage()

  const persist = () => {
    if (!cache) return
    const entries: Array<[string, StoredEntry]> = []
    for (const [key, value] of cache) {
      if (matches(key)) entries.push([key, { version: STORAGE_VERSION, timestamp: Date.now(), value }])
    }
    storage.set(storageKey, JSON.stringify(entries))
  }

  const hydrate = () => {
    if (!cache) return
    const rows = parseRows(storage.get(storageKey))
    if (!rows) return
    const now = Date.now()
    for (const row of rows) {
      const entry = parseEntry(row)
      if (!entry) continue
      const ttl = ttlOf(entry.key)
      if (ttl !== undefined && now - entry.timestamp < ttl) {
        cache.set(entry.key, entry.value)
      }
    }
  }

  return () => {
    if (cache) return cache
    cache = new Map<string, State>()
    if (typeof window === "undefined") return cache
    hydrate()
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") persist()
    })
    window.addEventListener("beforeunload", persist)
    return cache
  }
}

/** Module-level provider instance, so the cache survives across renders. */
const persistentProvider = createPersistentProvider(PERSIST_RULES, STORAGE_KEY)

/**
 * SWR global configuration.
 *
 * Responses whose keys match a {@link PERSIST_RULES} entry are persisted to
 * localStorage, so refreshing the page renders them instantly while SWR
 * revalidates in the background. Pattern lists/details stay in-memory only, so
 * they always pick up fresh data on mount.
 */
export function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        provider: persistentProvider,
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
