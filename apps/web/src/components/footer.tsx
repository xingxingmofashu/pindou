import Link from "next/link"
import { Logo } from "@pindou/ui/components/logo"
import { GITHUB_URL } from "@pindou/shared/constants"
import { localizedPath } from "@pindou/core/i18n/config"
import { getDictionary, getLocale } from "@/i18n/server"

export async function Footer() {
  const locale = await getLocale()
  const dict = await getDictionary()
  const year = new Date().getFullYear()

  return (
    <footer className="border px-3 py-3">
      <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
        <div className="flex items-center gap-2">
          <Link href={`/${locale}`} aria-label={dict.header.homeAria}>
            <Logo className="h-4 w-20" />
          </Link>
          <span className="text-xs text-muted-foreground">{dict.footer.tagline}</span>
        </div>

        <nav className="flex items-center gap-4 text-xs text-muted-foreground" aria-label="Footer">
          <Link href={localizedPath(locale, "/patterns")} className="hover:text-foreground">
            {dict.header.patterns}
          </Link>
          <Link href={localizedPath(locale, "/editor")} className="hover:text-foreground">
            {dict.header.editor}
          </Link>
          <Link
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground"
            aria-label={dict.header.githubAria}
          >
            {dict.header.github}
          </Link>
        </nav>

        <p className="text-xs text-muted-foreground">
          {dict.footer.rights.replace("{year}", String(year))}
        </p>
      </div>
    </footer>
  )
}
