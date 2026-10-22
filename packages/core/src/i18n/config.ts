/** Supported application locales. The first entry is the default. */
const LOCALES = ["en", "zh"] as const

/** A supported application locale. */
export type Locale = (typeof LOCALES)[number]

/** Locale configuration and the routing helpers built on it. */
export class I18nConfig {
  /** Supported locales, in switcher order. */
  static readonly locales = LOCALES

  /** Locale used when detection finds nothing (the first supported one). */
  static readonly defaultLocale: Locale = LOCALES[0]

  /**
   * Narrow a runtime string to a supported locale.
   *
   * @param value - The string to test.
   * @returns `true` when `value` is a supported locale.
   */
  static isLocale(value: string): value is Locale {
    return (LOCALES as readonly string[]).includes(value)
  }

  /**
   * Prefix a path with the given locale (`/editor` → `/en/editor`, `/` → `/en`).
   *
   * @param locale - The locale segment.
   * @param path   - The unlocalized path.
   * @returns The localized path.
   */
  static localizedPath(locale: Locale, path: string): string {
    if (path === "/") return `/${locale}`
    return `/${locale}${path}`
  }

  /**
   * Best-effort locale detection from the `Accept-Language` header.
   *
   * Each accepted language is reduced to its primary subtag (`zh-CN` → `zh`,
   * `en-US` → `en`) and the first one that matches a supported locale wins,
   * falling back to {@link defaultLocale}.
   *
   * @param acceptLanguage - The raw header value, if any.
   * @returns The detected locale.
   */
  static detectLocale(acceptLanguage: string | null): Locale {
    if (!acceptLanguage) return I18nConfig.defaultLocale
    for (const part of acceptLanguage.split(",")) {
      const [tag] = part.split(";")
      const primary = tag?.trim().split("-")[0]?.toLowerCase()
      if (primary && I18nConfig.isLocale(primary)) return primary
    }
    return I18nConfig.defaultLocale
  }
}
