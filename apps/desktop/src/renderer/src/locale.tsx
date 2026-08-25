import { createContext, useContext } from "react"
import type { Locale } from "@pindou/core/i18n/config"

interface LocaleContextValue {
  locale: Locale
  /** Switch to the other supported language. */
  toggleLocale: () => void
}

/** Language state shared by the shell and the header's language toggle. */
export const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  toggleLocale: () => {},
})

/** Read the active locale from the nearest LocaleContext provider. */
export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext)
}
