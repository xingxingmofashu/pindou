"use client"

import { useCallback } from "react"
import { GitHubButton } from "@pindou/ui/components/github-button"
import { I18nConfig } from "@pindou/core/i18n/config"
import { useI18n } from "@pindou/core/i18n/client"
import { signIn } from "@/lib/auth/client"

interface GitHubSignInProps {
  callbackURL: string
  label?: string
  className?: string
}

/**
 * Client bridge between the auth pages and the shared GitHubButton.
 *
 * Errors from the OAuth callback are sent back to the sign-in page so it can
 * show a useful message (for example when the email is already registered).
 */
export function GitHubSignIn({ callbackURL, label, className }: GitHubSignInProps) {
  const { locale } = useI18n()

  const handleSignIn = useCallback(
    (url: string) =>
      signIn.social({
        provider: "github",
        callbackURL: url,
        errorCallbackURL: `${I18nConfig.localizedPath(locale, "/sign-in")}?callback=${encodeURIComponent(callbackURL)}`,
      }),
    [callbackURL, locale],
  )

  return (
    <GitHubButton
      callbackURL={callbackURL}
      onSignIn={handleSignIn}
      label={label}
      className={className}
    />
  )
}
