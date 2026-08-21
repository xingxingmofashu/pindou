"use client"

import { useCallback, useState } from "react"
import { Button } from "./ui/button"
import { Spinner } from "./ui/spinner"
import { toast } from "./ui/toast"
import { GithubIcon } from "./icon/github"
import { useI18n } from "@pindou/core/i18n/client.tsx"

interface GitHubButtonProps {
  label?: string
  className?: string
  /** URL to return to after OAuth. */
  callbackURL: string
  /**
   * Starts the GitHub OAuth flow — injected by the host app (e.g.
   * `signIn.social({ provider: "github", callbackURL })`).
   */
  onSignIn: (callbackURL: string) => Promise<{ error?: unknown }>
}

export function GitHubButton({
  label,
  className,
  callbackURL,
  onSignIn,
}: GitHubButtonProps) {
  const { t } = useI18n()
  const [pending, setPending] = useState(false)

  const handleSignIn = useCallback(async () => {
    if (pending) return
    setPending(true)
    const { error } = await onSignIn(callbackURL)
    // On success the client redirects to GitHub (full page load), so keep
    // `pending` true — resetting it here would re-enable the button during
    // the navigation gap and allow a second click that overwrites the OAuth
    // state cookie, breaking the callback.
    if (error) {
      setPending(false)
      toast.add({
        id: "sign-in-failed",
        type: "error",
        title: t("auth.signInFailed"),
        description: t("auth.signInFailedDescription"),
      })
    }
  }, [callbackURL, pending, t, onSignIn])

  return (
    <Button
      variant="outline"
      className={className}
      onClick={handleSignIn}
      disabled={pending}
    >
      {pending && <Spinner data-icon="inline-start" />}
      <GithubIcon />
      {label ?? t("auth.continueWithGitHub")}
    </Button>
  )
}
