"use client"

import { useCallback, useState, type FormEvent } from "react"
import { Button } from "@pindou/ui/components/ui/button"
import { Input } from "@pindou/ui/components/ui/input"
import { Label } from "@pindou/ui/components/ui/label"
import { Spinner } from "@pindou/ui/components/ui/spinner"
import { I18nConfig } from "@pindou/core/i18n/config"
import { useI18n } from "@pindou/core/i18n/client"
import { requestPasswordReset } from "@/lib/auth/client"
import { authErrorKey } from "@/lib/auth/errors"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Sends a password-reset link without revealing whether the email exists. */
export function ForgotPasswordForm({ callbackURL }: { callbackURL: string }) {
  const { locale, t } = useI18n()
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (pending) return

      const trimmedEmail = email.trim()
      if (!EMAIL_PATTERN.test(trimmedEmail)) {
        setError(t("auth.errors.invalidEmail"))
        return
      }

      setError(null)
      setPending(true)
      try {
        const resetPath = I18nConfig.localizedPath(locale, "/reset-password")
        const search = new URLSearchParams({ callback: callbackURL })
        const redirectTo = `${window.location.origin}${resetPath}?${search.toString()}`
        const { error: resetError } = await requestPasswordReset({
          email: trimmedEmail,
          redirectTo,
        })

        if (resetError) {
          setError(t(authErrorKey(resetError)))
          return
        }

        setSent(true)
      } catch {
        setError(t("auth.errors.generic"))
      } finally {
        setPending(false)
      }
    },
    [callbackURL, email, locale, pending, t],
  )

  if (sent) {
    return (
      <p role="status" className="rounded-lg border border-border bg-muted px-3 py-2 text-sm">
        {t("auth.resetLinkSent")}
      </p>
    )
  }

  return (
    <form className="grid gap-3" onSubmit={handleSubmit} noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="forgot-password-email">{t("auth.email")}</Label>
        <Input
          id="forgot-password-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={error ? true : undefined}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Spinner data-icon="inline-start" />}
        {t("auth.sendResetLink")}
      </Button>
    </form>
  )
}
