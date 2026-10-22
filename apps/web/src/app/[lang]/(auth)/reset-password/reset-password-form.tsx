"use client"

import { useCallback, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@pindou/ui/components/ui/button"
import { Input } from "@pindou/ui/components/ui/input"
import { Label } from "@pindou/ui/components/ui/label"
import { Spinner } from "@pindou/ui/components/ui/spinner"
import { I18nConfig } from "@pindou/core/i18n/config"
import { useI18n } from "@pindou/core/i18n/client"
import { resetPassword } from "@/lib/auth/client"
import { authErrorKey } from "@/lib/auth/errors"

interface ResetPasswordFormProps {
  token: string
  callbackURL: string
}

/** Sets a new password using a Better Auth reset token. */
export function ResetPasswordForm({ token, callbackURL }: ResetPasswordFormProps) {
  const router = useRouter()
  const { locale, t } = useI18n()
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (pending) return

      if (newPassword.length < 8) {
        setError(t("auth.errors.passwordTooShort"))
        return
      }
      if (newPassword !== confirmPassword) {
        setError(t("auth.errors.passwordMismatch"))
        return
      }

      setError(null)
      setPending(true)
      try {
        const { error: resetError } = await resetPassword({ newPassword, token })
        if (resetError) {
          setError(t(authErrorKey(resetError)))
          return
        }

        const search = new URLSearchParams({ reset: "1", callback: callbackURL })
        router.push(`${I18nConfig.localizedPath(locale, "/sign-in")}?${search.toString()}`)
        router.refresh()
      } catch {
        setError(t("auth.errors.generic"))
      } finally {
        setPending(false)
      }
    },
    [callbackURL, confirmPassword, locale, newPassword, pending, router, t, token],
  )

  return (
    <form className="grid gap-3" onSubmit={handleSubmit} noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="reset-password-new">{t("auth.password")}</Label>
        <Input
          id="reset-password-new"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          aria-invalid={error ? true : undefined}
        />
        <p className="text-xs text-muted-foreground">{t("auth.passwordHint")}</p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="reset-password-confirm">{t("auth.confirmPassword")}</Label>
        <Input
          id="reset-password-confirm"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
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
        {t("auth.resetPassword")}
      </Button>
    </form>
  )
}
