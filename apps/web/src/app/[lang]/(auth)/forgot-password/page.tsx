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
import { isEmailDeliveryConfigured } from "@/lib/email"
import { getDictionary, getLocale } from "@/i18n/server"
import { ForgotPasswordForm } from "./forgot-password-form"

// Mail configuration is read at request time; don't bake the "unavailable"
// state into a static build.
export const dynamic = "force-dynamic"

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const locale = await getLocale()
  const dict = await getDictionary(locale)
  const params = await searchParams

  const callbackURL = sanitizeCallback(
    typeof params.callback === "string" ? params.callback : undefined,
    locale,
  )
  const signInHref = `${I18nConfig.localizedPath(locale, "/sign-in")}?callback=${encodeURIComponent(callbackURL)}`

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="place-items-center text-center">
        <Logo className="h-10 w-48" />
        <CardTitle>{dict.auth.forgotPasswordTitle}</CardTitle>
        <CardDescription>{dict.auth.forgotPasswordDescription}</CardDescription>
      </CardHeader>

      <CardContent>
        {isEmailDeliveryConfigured() ? (
          <ForgotPasswordForm callbackURL={callbackURL} />
        ) : (
          <p role="status" className="rounded-lg border border-border bg-muted px-3 py-2 text-sm">
            {dict.auth.resetUnavailable}
          </p>
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
