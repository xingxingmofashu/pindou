import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Logo } from "@pindou/ui/components/logo"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@pindou/ui/components/ui/card"
import { I18nConfig } from "@pindou/core/i18n/config"
import { auth } from "@/lib/auth/server"
import { sanitizeCallback } from "@/lib/auth/callback-url"
import { getDictionary, getLocale } from "@/i18n/server"
import { GitHubSignIn } from "../github-sign-in"
import { SignUpForm } from "./sign-up-form"

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const params = await searchParams

  const callbackURL = sanitizeCallback(
    typeof params.callback === "string" ? params.callback : undefined,
    locale,
  )

  if (session) redirect(callbackURL)

  const signInHref = `${I18nConfig.localizedPath(locale, "/sign-in")}?callback=${encodeURIComponent(callbackURL)}`

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="place-items-center text-center">
        <Logo className="h-10 w-48" />
        <CardTitle>{dict.auth.signUpTitle}</CardTitle>
        <CardDescription>{dict.auth.signUpDescription}</CardDescription>
      </CardHeader>

      <CardContent className="grid gap-4">
        <SignUpForm callbackURL={callbackURL} />

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">{dict.auth.or}</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <GitHubSignIn callbackURL={callbackURL} />
      </CardContent>

      <CardFooter className="text-sm">
        <p className="text-muted-foreground">
          {dict.auth.haveAccount}{" "}
          <Link className="text-primary underline-offset-4 hover:underline" href={signInHref}>
            {dict.auth.signInWithEmail}
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
