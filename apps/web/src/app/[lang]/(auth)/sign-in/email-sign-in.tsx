"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { EmailSignInForm } from "@pindou/ui/components/auth/email-sign-in-form"
import { useI18n } from "@pindou/core/i18n/client"
import { signIn } from "@/lib/auth/client"
import { authErrorKey } from "@/lib/auth/errors"

/** Email/password sign-in form wired to Better Auth and the Next router. */
export function EmailSignIn({ callbackURL }: { callbackURL: string }) {
  const router = useRouter()
  const { t } = useI18n()

  const handleSubmit = useCallback(
    async (email: string, password: string) => {
      try {
        const { error } = await signIn.email({ email, password, callbackURL })
        if (error) return t(authErrorKey(error))

        router.push(callbackURL)
        router.refresh()
        return null
      } catch {
        return t("auth.errors.generic")
      }
    },
    [callbackURL, router, t],
  )

  return <EmailSignInForm onSubmit={handleSubmit} />
}
