/** Supported application locales. The first entry is the default. */
export const locales = ["en", "zh"] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = locales[0]

/** Narrow a runtime string to a supported locale. */
export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value)
}

/** Prefix a path with the given locale (`/editor` → `/en/editor`, `/` → `/en`). */
export function localizedPath(locale: Locale, path: string): string {
  if (path === "/") return `/${locale}`
  return `/${locale}${path}`
}

/**
 * Best-effort locale detection from the `Accept-Language` header.
 *
 * Each accepted language is reduced to its primary subtag (`zh-CN` → `zh`,
 * `en-US` → `en`) and the first one that matches a supported locale wins,
 * falling back to {@link defaultLocale}.
 */
export function detectLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale
  for (const part of acceptLanguage.split(",")) {
    const [tag] = part.split(";")
    const primary = tag?.trim().split("-")[0]?.toLowerCase()
    if (primary && isLocale(primary)) return primary
  }
  return defaultLocale
}
