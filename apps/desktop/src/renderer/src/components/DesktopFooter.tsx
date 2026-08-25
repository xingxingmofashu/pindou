import { Link } from "react-router-dom"
import { GITHUB_URL } from "@pindou/shared/constants"
import { Logo } from "@pindou/ui/components/logo"
import { useI18n } from "@pindou/core/i18n/client"

/** Footer — mirrors the web footer (logo + tagline, nav, copyright). */
export function DesktopFooter() {
  const { t } = useI18n()
  const year = new Date().getFullYear()

  return (
    <footer className="border px-3 py-3">
      <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
        <div className="flex items-center gap-2">
          <Logo className="h-4 w-20" />
          <span className="text-xs text-muted-foreground">{t("footer.tagline")}</span>
        </div>

        <nav className="flex items-center gap-4 text-xs text-muted-foreground" aria-label="Footer">
          <Link to="/patterns" className="hover:text-foreground">
            {t("header.patterns")}
          </Link>
          <Link to="/editor" className="hover:text-foreground">
            {t("header.editor")}
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground"
            aria-label={t("header.githubAria")}
          >
            {t("header.github")}
          </a>
        </nav>

        <p className="text-xs text-muted-foreground">
          {t("footer.rights").replace("{year}", String(year))}
        </p>
      </div>
    </footer>
  )
}
