"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import type { Locale } from "./config"
import type { Messages } from "./types"

export interface I18n {
  locale: Locale
  /** Translate a dotted message key, interpolating `{var}` placeholders. */
  t: (path: string, vars?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18n | null>(null)

interface I18nProviderProps {
  locale: Locale
  messages: Messages
  children: ReactNode
}

/**
 * Client i18n context. The server root layout passes the resolved locale and
 * its message dictionary down; client components read both via {@link useI18n}.
 */
export function I18nProvider({ locale, messages, children }: I18nProviderProps) {
  const value = useMemo<I18n>(
    () => ({ locale, t: (path, vars) => translate(messages, path, vars) }),
    [locale, messages],
  )
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used within I18nProvider")
  return ctx
}

function translate(
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
