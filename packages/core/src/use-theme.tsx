"use client"

import { createContext, useContext } from "react"

export interface Theme {
  isDark: boolean
  toggleDark: () => void
}

/** Shared theme context. Apps render `<ThemeContext.Provider value={...}>`
 *  directly with their own dark-mode state; shared components (e.g. the
 *  PixiJS canvas) read it via {@link useTheme}. */
export const ThemeContext = createContext<Theme>({
  isDark: false,
  toggleDark: () => {},
})

/** Read the dark-mode flag from the nearest ThemeContext provider. */
export function useTheme(): Theme {
  return useContext(ThemeContext)
}
