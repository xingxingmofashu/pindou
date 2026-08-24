import { GITHUB_URL } from "@pindou/shared/constants"
import { Logo } from "@pindou/ui/components/logo"
import { useI18n } from "@pindou/core/i18n/client"

interface DesktopFooterProps {
  onPatterns: () => void
  onEditor: () => void
}

/** Footer — mirrors the web footer (logo + tagline, nav, copyright). */
export function DesktopFooter({ onPatterns, onEditor }: DesktopFooterProps) {
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
          <button type="button" className="hover:text-foreground" onClick={onPatterns}>
            {t("header.patterns")}
          </button>
          <button type="button" className="hover:text-foreground" onClick={onEditor}>
            {t("header.editor")}
          </button>
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
