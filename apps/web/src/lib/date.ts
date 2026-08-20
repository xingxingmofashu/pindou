import { format, formatDistanceToNow, parseISO, isValid } from "date-fns"
import { zhCN } from "date-fns/locale"

function localeFor(locale: string | undefined) {
  return locale === "zh" ? zhCN : undefined
}

function parsed(iso: string): Date | null {
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
export function formatRelativeDate(iso: string, locale: string | undefined): string {
  const date = parsed(iso)
  if (!date) return ""
  return formatDistanceToNow(date, { addSuffix: true, locale: localeFor(locale) })
}

/**
 * Absolute localized date using a dictionary format string.
 *
 * @param iso     - An ISO timestamp string.
 * @param locale  - The current locale (`"en"` or `"zh"`).
 * @param pattern - A date-fns format pattern (from the dictionary).
 * @returns The formatted date, or `""` when the input is invalid.
 */
export function formatAbsoluteDate(
  iso: string,
  locale: string | undefined,
  pattern: string,
): string {
  const date = parsed(iso)
  if (!date) return ""
  return format(date, pattern, { locale: localeFor(locale) })
}
