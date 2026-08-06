import "server-only"
import { lang } from "next/root-params"
import { notFound } from "next/navigation"
import { isLocale, type Locale } from "./config"
import type { Messages } from "./types"
import en from "./dictionaries/en.json"
import zh from "./dictionaries/zh.json"

const dictionaries = { en, zh } satisfies Record<Locale, Messages>

/** Resolve the current route's locale, 404ing when the segment is unsupported. */
export async function getLocale(): Promise<Locale> {
  const locale = await lang()
  if (!isLocale(locale)) notFound()
  return locale
}

/**
 * Load the message dictionary for the current route (or an explicit locale).
 *
 * The locale is resolved from the `[lang]` route segment via `next/root-params`,
 * so callers don't need to thread it through props.
 */
export async function getDictionary(locale?: Locale): Promise<Messages> {
  const current = locale ?? (await getLocale())
  return dictionaries[current]
}
