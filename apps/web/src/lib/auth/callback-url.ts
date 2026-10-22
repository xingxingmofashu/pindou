import type { Locale } from "@pindou/core/i18n/config"

/**
 * Keep a post-sign-in redirect on this site.
 *
 * Only relative paths are accepted. Parsing against a dummy origin also
 * rejects protocol-relative (`//evil.com`) and backslash-smuggled
 * (`/\evil.com`) URLs that naive `startsWith("/")` checks let through.
 *
 * @param value  - The untrusted `callback` query parameter.
 * @param locale - Locale used for the fallback home path.
 * @returns A safe site-relative path.
 */
export function sanitizeCallback(value: string | undefined, locale: Locale): string {
  if (!value) return `/${locale}`

  try {
    const url = new URL(value, "http://localhost")
    if (url.origin !== "http://localhost") return `/${locale}`
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return `/${locale}`
  }
}
