"use client"

import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { signIn } from "@/lib/auth/client"
import { GithubIcon } from "@/components/icon/github"
import { useI18n } from "@/i18n/client"

interface GitHubButtonProps {
  label?: string
  className?: string
  /** URL to return to after OAuth; defaults to the current page. */
  callbackURL?: string
}

export function GitHubButton({
  label,
  className,
  callbackURL,
}: GitHubButtonProps) {
  const { t } = useI18n()
  const [pending, setPending] = useState(false)

  const handleSignIn = useCallback(async () => {
    setPending(true)
    await signIn.social({
      provider: "github",
      callbackURL: callbackURL ?? window.location.href,
    })
    setPending(false)
  }, [callbackURL])

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
