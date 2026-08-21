"use client"

import { useSyncExternalStore } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@pindou/ui/components/ui/button"
import { useI18n } from "@pindou/core/i18n/client.tsx"

const emptySubscribe = () => () => {}

/** True once mounted on the client; false during SSR and first hydration. */
function useIsMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
}

/** Light/dark theme toggle. Renders a placeholder until mounted to avoid a
 *  hydration mismatch on the resolved theme. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const { t } = useI18n()
  const isMounted = useIsMounted()

  if (!isMounted) {
    return <Button variant="ghost" size="icon-sm" aria-hidden className="invisible" />
  }

  const isDark = resolvedTheme === "dark"

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={t("header.toggleTheme")}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <Sun className={isDark ? "hidden" : undefined} />
      <Moon className={isDark ? undefined : "hidden"} />
    </Button>
  )
}
