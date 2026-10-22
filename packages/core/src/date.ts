import { format, formatDistanceToNow, parseISO, isValid } from "date-fns"
import { zhCN } from "date-fns/locale"

/**
 * Localized date formatting for the app's two locales.
 *
 * All entry points return `""` for an invalid ISO string rather than
 * propagating `Invalid Date` into the UI.
 */
export class Dates {
  /**
   * The date-fns locale for an app locale (`zh` → `zhCN`, otherwise the default).
   *
   * @param locale - The current locale (`"en"` or `"zh"`).
   */
  private static localeFor(locale: string | undefined) {
    return locale === "zh" ? zhCN : undefined
  }

  /**
   * Parse an ISO timestamp, or `null` when it is invalid.
   *
   * @param iso - An ISO timestamp string.
   */
  private static parsed(iso: string): Date | null {
    const date = parseISO(iso)
    return isValid(date) ? date : null
  }

  /**
   * "3 days ago"-style relative date, localized.
   *
   * @param iso    - An ISO timestamp string.
   * @param locale - The current locale (`"en"` or `"zh"`).
   * @returns The relative date string, or `""` when the input is invalid.
   */
  static relative(iso: string, locale: string | undefined): string {
    const date = Dates.parsed(iso)
    if (!date) return ""
    return formatDistanceToNow(date, { addSuffix: true, locale: Dates.localeFor(locale) })
  }

  /**
   * Absolute localized date using a dictionary format string.
   *
   * @param iso     - An ISO timestamp string.
   * @param locale  - The current locale (`"en"` or `"zh"`).
   * @param pattern - A date-fns format pattern (from the dictionary).
   * @returns The formatted date, or `""` when the input is invalid.
   */
  static absolute(iso: string, locale: string | undefined, pattern: string): string {
    const date = Dates.parsed(iso)
    if (!date) return ""
    return format(date, pattern, { locale: Dates.localeFor(locale) })
  }
}
