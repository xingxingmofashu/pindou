import Link from "next/link"
import { headers } from "next/headers"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Logo } from "@/components/logo"
import { GithubIcon } from "@/components/auth/github-icon"
import { GitHubButton } from "@/components/auth/github-button"
import { UserMenu } from "@/components/auth/user-menu"
import { auth } from "@/lib/auth"

const GITHUB_URL = "https://github.com/xingxingmofashu/pindou"

export async function Header() {
  const session = await auth.api.getSession({ headers: await headers() })

  return (
    <header className="flex items-center justify-between px-3 py-2 border">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center" aria-label="PINDOW home">
          <Logo className="h-5 w-24" />
        </Link>
        <Separator orientation="vertical" className="mx-1 h-8" />
        <nav className="flex items-center gap-1">
          <Button
            variant="link"
            nativeButton={false}
            render={<Link href="/patterns" />}
          >
            Patterns
          </Button>
          <Button
            variant="link"
            nativeButton={false}
            render={<Link href="/editor" />}
          >
            Editor
          </Button>
        </nav>
      </div>

      <div className="flex items-center gap-2">
        {session ? (
          <UserMenu name={session.user.name} image={session.user.image} />
        ) : (
          <GitHubButton label="Sign in" />
        )}
        <Button
          render={
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" aria-label="View source on GitHub" />
          }
          nativeButton={false}
          variant="outline"
          size="icon"
        >
          <GithubIcon />
        </Button>
      </div>
    </header>
  )
}
