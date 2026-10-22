import Link from "next/link"
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
import { sanitizeCallback } from "@/lib/auth/callback-url"
import { getDictionary, getLocale } from "@/i18n/server"
import { ResetPasswordForm } from "./reset-password-form"

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const params = await searchParams

  const token = typeof params.token === "string" ? params.token : undefined
  const error = typeof params.error === "string" ? params.error : undefined
  const callbackURL = sanitizeCallback(
    typeof params.callback === "string" ? params.callback : undefined,
    locale,
  )

  const signInHref = `${I18nConfig.localizedPath(locale, "/sign-in")}?callback=${encodeURIComponent(callbackURL)}`
  const forgotHref = `${I18nConfig.localizedPath(locale, "/forgot-password")}?callback=${encodeURIComponent(callbackURL)}`

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="place-items-center text-center">
        <Logo className="h-10 w-48" />
        <CardTitle>{dict.auth.resetPasswordTitle}</CardTitle>
        <CardDescription>{dict.auth.resetPasswordDescription}</CardDescription>
      </CardHeader>

      <CardContent className="grid gap-3">
        {token && !error ? (
          <ResetPasswordForm token={token} callbackURL={callbackURL} />
        ) : (
          <>
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {dict.auth.invalidResetLink}
            </p>
            <Link className="text-sm text-primary underline-offset-4 hover:underline" href={forgotHref}>
              {dict.auth.requestNewLink}
            </Link>
          </>
        )}
      </CardContent>

      <CardFooter className="text-sm">
        <Link className="text-primary underline-offset-4 hover:underline" href={signInHref}>
          {dict.auth.backToSignIn}
        </Link>
      </CardFooter>
    </Card>
  )
}
