import { Moon, Sun } from "lucide-react"
import { Link } from "react-router-dom"
import { GITHUB_URL } from "@pindou/shared/constants"
import { Button } from "@pindou/ui/components/ui/button"
import { Separator } from "@pindou/ui/components/ui/separator"
import { Logo } from "@pindou/ui/components/logo"
import { useI18n } from "@pindou/core/i18n/client"
import { useTheme } from "../theme"
import { WindowControls } from "./WindowControls"

interface HeaderProps {
  /** Which nav section is active ("detail" maps to "list"). */
  activeSection?: "home" | "list" | "editor"
}

/** Top navigation bar — mirrors the web header (logo + nav + theme toggle),
 *  minus the auth area (the desktop app has no sign-in). The bar doubles as
 *  the frameless window's drag region, so interactive children opt out with
 *  `no-drag` and the window controls live at the far right. */
export function Header({ activeSection = "home" }: HeaderProps) {
  const { t, locale, setLocale } = useI18n()
  const { isDark, toggleDark } = useTheme()

  return (
    <header className="drag flex items-center border px-3 py-2">
      <div className="no-drag flex items-center gap-4">
        <Link
          to="/"
          className="flex items-center"
          aria-label={t("header.homeAria")}
          onDoubleClick={() => window.pindou.window.toggleMaximize()}
        >
          <Logo className="h-5 w-24" />
        </Link>
        <Separator orientation="vertical" className="mx-1 h-8" />
        <nav className="flex items-center gap-1">
          <Button
            variant={activeSection === "list" ? "secondary" : "link"}
            size="sm"
            render={<Link to="/patterns" />}
          >
            {t("header.patterns")}
          </Button>
          <Button
            variant={activeSection === "editor" ? "secondary" : "link"}
            size="sm"
            render={<Link to="/editor" />}
          >
            {t("header.editor")}
          </Button>
        </nav>
      </div>

      {/* Spacer that fills the bar and gives the window a large drag area. */}
      <div className="min-h-8 flex-1" />

      <div className="no-drag flex items-center gap-2">
        <Button
          render={
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" aria-label={t("header.githubAria")} />
          }
          variant="link"
          size="sm"
        >
          {t("header.github")}
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={t("header.toggleTheme")} onClick={toggleDark}>
          <Sun className={isDark ? "hidden" : undefined} />
          <Moon className={isDark ? undefined : "hidden"} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("header.language")}
          onClick={() => setLocale(locale === "en" ? "zh" : "en")}
          className="font-medium uppercase"
        >
          {locale === "en" ? "中文" : "EN"}
        </Button>
        <WindowControls />
      </div>
    </header>
  )
}
