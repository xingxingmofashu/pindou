"use client"

import { useCallback } from "react"
import { GitHubButton } from "@pindou/ui/components/github-button"
import { signIn } from "@/lib/auth/client"

interface SignInWithGitHubProps {
  callbackURL: string
  className?: string
}

/**
 * Client bridge between the server sign-in page and the shared GitHubButton:
 * wires the app's Better Auth `signIn.social` into the framework-agnostic
 * button's `onSignIn` prop.
 */
export function SignInWithGitHub({ callbackURL, className }: SignInWithGitHubProps) {
  const handleSignIn = useCallback(
    (url: string) =>
      signIn.social({
        provider: "github",
        callbackURL: url,
      }),
    [],
  )

  return <GitHubButton callbackURL={callbackURL} onSignIn={handleSignIn} className={className} />
}
