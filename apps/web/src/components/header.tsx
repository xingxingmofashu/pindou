import Link from "next/link"
import { Download } from "lucide-react"
import { Button } from "@pindou/ui/components/ui/button"
import { Separator } from "@pindou/ui/components/ui/separator"
import { Logo } from "@pindou/ui/components/logo"
import { AuthNav } from "@/components/auth-nav"
import { NavMenu } from "@/components/nav-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { GITHUB_URL } from "@pindou/shared/constants"
import { localizedPath } from "@pindou/core/i18n/config"
import { getDictionary, getLocale } from "@/i18n/server"

export async function Header() {
  const locale = await getLocale()
  const dict = await getDictionary()

  return (
    <header className="flex items-center justify-between gap-2 px-3 py-2 border">
      <div className="flex min-w-0 items-center gap-4">
        <Link
          href={`/${locale}`}
          className="hidden items-center md:flex"
          aria-label={dict.header.homeAria}
        >
          <Logo className="h-5 w-24" />
        </Link>
        <Separator orientation="vertical" className="mx-1 hidden h-8 md:block" />
        <NavMenu locale={locale} />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          render={
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" aria-label={dict.header.githubAria} />
          }
          nativeButton={false}
          variant="link"
          className="hidden md:inline-flex"
        >
          {dict.header.github}
        </Button>
        <ThemeToggle />
        {/* Landing page for the desktop app — platform cards + install notes. */}
        <Button
          render={<Link href={localizedPath(locale, "/download")} />}
          nativeButton={false}
          className="hidden gap-2 md:inline-flex"
        >
          <Download className="size-4" aria-hidden="true" />
          {dict.header.download}
        </Button>
        <AuthNav />
      </div>
    </header>
  )
}
