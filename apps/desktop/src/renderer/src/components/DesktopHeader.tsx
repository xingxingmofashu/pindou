import { Moon, Sun } from "lucide-react"
import { GITHUB_URL } from "@pindou/shared/constants"
import { Button } from "@pindou/ui/components/ui/button"
import { Separator } from "@pindou/ui/components/ui/separator"
import { Logo } from "@pindou/ui/components/logo"
import { useI18n } from "@pindou/core/i18n/client"

interface DesktopHeaderProps {
  isDark: boolean
  onToggleDark: () => void
  onHome: () => void
  onPatterns: () => void
  onEditor: () => void
  /** Which nav section is active ("detail" maps to "list"). */
  activeSection: "home" | "list" | "editor"
}

/** Top navigation bar — mirrors the web header (logo + nav + theme toggle),
 *  minus the auth area (the desktop app has no sign-in). */
export function DesktopHeader({
  isDark,
  onToggleDark,
  onHome,
  onPatterns,
  onEditor,
  activeSection,
}: DesktopHeaderProps) {
  const { t } = useI18n()

  return (
    <header className="flex items-center justify-between border px-3 py-2">
      <div className="flex items-center gap-4">
        <button type="button" className="flex items-center" aria-label={t("header.homeAria")} onClick={onHome}>
          <Logo className="h-5 w-24" />
        </button>
        <Separator orientation="vertical" className="mx-1 h-8" />
        <nav className="flex items-center gap-1">
          <Button
            variant={activeSection === "list" ? "secondary" : "link"}
            size="sm"
            onClick={onPatterns}
          >
            {t("header.patterns")}
          </Button>
          <Button
            variant={activeSection === "editor" ? "secondary" : "link"}
            size="sm"
            onClick={onEditor}
          >
            {t("header.editor")}
          </Button>
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <Button
          render={
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" aria-label={t("header.githubAria")} />
          }
          variant="link"
          size="sm"
        >
          {t("header.github")}
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={t("header.toggleTheme")} onClick={onToggleDark}>
          <Sun className={isDark ? "hidden" : undefined} />
          <Moon className={isDark ? undefined : "hidden"} />
        </Button>
      </div>
    </header>
  )
}
