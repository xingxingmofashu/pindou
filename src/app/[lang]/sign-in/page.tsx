import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { GitHubButton } from "@/components/github-button"
import { Logo } from "@/components/logo"
import { auth } from "@/lib/auth/server"
import { getLocale } from "@/i18n/server"

/** Keep the post-sign-in return path on-site to avoid open redirects. */
function sanitizeCallback(value: string | undefined, locale: string): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value
  return `/${locale}`
}

export default async function SignInPage(props: PageProps<"/[lang]/sign-in">) {
  const session = await auth.api.getSession({ headers: await headers() })
  const locale = await getLocale()
  const { callback } = await props.searchParams
  const callbackURL = sanitizeCallback(
    typeof callback === "string" ? callback : undefined,
    locale,
  )

  if (session) redirect(callbackURL)

  return (
    <div className="flex h-dvh items-center justify-center p-4">
      <div className="grid w-full max-w-sm place-items-center gap-6 border p-6">
        <Logo className="h-10 w-48" />
        <GitHubButton callbackURL={callbackURL} className="w-full" />
      </div>
    </div>
  )
}
