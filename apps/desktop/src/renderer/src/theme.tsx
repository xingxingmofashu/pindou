import { createContext, useContext } from "react"

interface ThemeContextValue {
  isDark: boolean
  toggleDark: () => void
}

/** Dark-mode state shared by the shell, pages, and the canvas. */
export const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  toggleDark: () => {},
})

/** Read the dark-mode flag from the nearest ThemeContext provider. */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}
