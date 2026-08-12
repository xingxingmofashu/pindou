import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Logo } from "@/components/layout/logo"
import { AuthNav } from "@/components/auth/auth-nav"
import { GITHUB_URL } from "@/lib/constants"
import { localizedPath } from "@/i18n/config"
import { getDictionary, getLocale } from "@/i18n/server"

export async function Header() {
  const locale = await getLocale()
  const dict = await getDictionary()

  return (
    <header className="flex items-center justify-between px-3 py-2 border">
      <div className="flex items-center gap-4">
        <Link href={`/${locale}`} className="flex items-center" aria-label={dict.header.homeAria}>
          <Logo className="h-5 w-24" />
        </Link>
        <Separator orientation="vertical" className="mx-1 h-8" />
        <nav className="flex items-center gap-1">
          <Button
            variant="link"
            nativeButton={false}
            render={<Link href={localizedPath(locale, "/patterns")} />}
          >
            {dict.header.patterns}
          </Button>
          <Button
            variant="link"
            nativeButton={false}
            render={<Link href={localizedPath(locale, "/editor")} />}
          >
            {dict.header.editor}
          </Button>
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <Button
          render={
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" aria-label={dict.header.githubAria} />
          }
          nativeButton={false}
          variant="link"
        >
          {dict.header.github}
        </Button>
        <AuthNav />
      </div>
    </header>
  )
}
