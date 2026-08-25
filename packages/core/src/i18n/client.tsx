"use client"

import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import type { Locale } from "./config"
import type { Messages } from "./types"
import en from "./dictionaries/en.json"
import zh from "./dictionaries/zh.json"

const dictionaries = { en, zh } as const

export interface I18n {
  locale: Locale
  /** Translate a dotted message key, interpolating `{var}` placeholders. */
  t: (path: string, vars?: Record<string, string | number>) => string
  /** Switch the active locale. */
  setLocale: (locale: Locale) => void
}

/** Shared i18n context. Apps render `<I18nContext.Provider value={...}>`
 *  directly with their own locale state and dictionary. */
export const I18nContext = createContext<I18n | null>(null)

interface I18nProviderProps {
  locale: Locale
  messages?: Messages
  children: ReactNode
}

/**
 * Convenience wrapper around {@link I18nContext}: owns the locale state and
 * resolves the dictionary itself. Apps that need to hook locale changes into
 * navigation/persistence should render `I18nContext.Provider` directly.
 */
export function I18nProvider({ locale: initialLocale, messages, children }: I18nProviderProps) {
  const [locale, setLocale] = useState<Locale>(initialLocale)
  const dictionary = messages ?? dictionaries[locale]
  const value = useMemo<I18n>(
    () => ({
      locale,
      t: (path, vars) => translate(dictionary, path, vars),
      setLocale,
    }),
    [locale, dictionary],
  )
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used within I18nContext.Provider")
  return ctx
}

/** Translate a dotted message key against a dictionary, interpolating
 *  `{var}` placeholders. Returns the raw path when the key is missing. */
export function translate(
  messages: Messages,
  path: string,
  vars?: Record<string, string | number>,
): string {
  const value = path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, messages)
  if (typeof value !== "string") return path
  if (!vars) return value
  return value.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`,
  )
}
