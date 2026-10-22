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
import { isEmailDeliveryConfigured } from "@/lib/email"
import { getDictionary, getLocale } from "@/i18n/server"
import { AuthError } from "../auth-error"
import { GitHubSignIn } from "../github-sign-in"
import { EmailSignIn } from "./email-sign-in"

export default async function SignInPage({
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
  const error = typeof params.error === "string" ? params.error : undefined
  const reset = params.reset === "1"

  if (session) redirect(callbackURL)

  const query = `?callback=${encodeURIComponent(callbackURL)}`
  const signUpHref = I18nConfig.localizedPath(locale, `/sign-up${query}`)
  const forgotHref = I18nConfig.localizedPath(locale, `/forgot-password${query}`)

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="place-items-center text-center">
        <Logo className="h-10 w-48" />
        <CardTitle>{dict.auth.signInTitle}</CardTitle>
        <CardDescription>{dict.auth.signInDescription}</CardDescription>
      </CardHeader>

      <CardContent className="grid gap-4">
        {reset && (
          <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm">
            {dict.auth.resetSuccess}
          </p>
        )}
        <AuthError code={error} />

        <EmailSignIn callbackURL={callbackURL} />

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">{dict.auth.or}</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <GitHubSignIn callbackURL={callbackURL} />
      </CardContent>

      <CardFooter className="flex-col items-start gap-2 text-sm">
        <p className="text-muted-foreground">
          {dict.auth.noAccount}{" "}
          <Link className="text-primary underline-offset-4 hover:underline" href={signUpHref}>
            {dict.auth.signUp}
          </Link>
        </p>
        {isEmailDeliveryConfigured() && (
          <Link className="text-primary underline-offset-4 hover:underline" href={forgotHref}>
            {dict.auth.forgotPassword}
          </Link>
        )}
      </CardFooter>
    </Card>
  )
}
