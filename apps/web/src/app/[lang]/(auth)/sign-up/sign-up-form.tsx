"use client"

import { useCallback, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@pindou/ui/components/ui/button"
import { Input } from "@pindou/ui/components/ui/input"
import { Label } from "@pindou/ui/components/ui/label"
import { Spinner } from "@pindou/ui/components/ui/spinner"
import { useI18n } from "@pindou/core/i18n/client"
import { signUp } from "@/lib/auth/client"
import { authErrorKey } from "@/lib/auth/errors"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Registration form wired to Better Auth. */
export function SignUpForm({ callbackURL }: { callbackURL: string }) {
  const router = useRouter()
  const { t } = useI18n()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [verificationSent, setVerificationSent] = useState(false)

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (pending) return

      const trimmedName = name.trim()
      const trimmedEmail = email.trim()

      if (!trimmedName) {
        setError(t("auth.errors.required"))
        return
      }
      if (trimmedName.length > 50) {
        setError(t("auth.errors.nameTooLong"))
        return
      }
      if (!EMAIL_PATTERN.test(trimmedEmail)) {
        setError(t("auth.errors.invalidEmail"))
        return
      }
      if (password.length < 8) {
        setError(t("auth.errors.passwordTooShort"))
        return
      }
      if (password !== confirmPassword) {
        setError(t("auth.errors.passwordMismatch"))
        return
      }

      setError(null)
      setPending(true)
      try {
        const { data, error: signUpError } = await signUp.email({
          name: trimmedName,
          email: trimmedEmail,
          password,
          callbackURL,
        })

        if (signUpError) {
          setError(t(authErrorKey(signUpError)))
          return
        }

        // With email verification enabled, sign-up returns no session.
        if (!data?.token) {
          setVerificationSent(true)
          return
        }

        router.push(callbackURL)
        router.refresh()
      } catch {
        setError(t("auth.errors.generic"))
      } finally {
        setPending(false)
      }
    },
    [callbackURL, confirmPassword, email, name, password, pending, router, t],
  )

  if (verificationSent) {
    return (
      <p role="status" className="rounded-lg border border-border bg-muted px-3 py-2 text-sm">
        {t("auth.verifyEmailSent")}
      </p>
    )
  }

  return (
    <form className="grid gap-3" onSubmit={handleSubmit} noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="sign-up-name">{t("auth.name")}</Label>
        <Input
          id="sign-up-name"
          type="text"
          autoComplete="name"
          maxLength={50}
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={error ? true : undefined}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="sign-up-email">{t("auth.email")}</Label>
        <Input
          id="sign-up-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={error ? true : undefined}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="sign-up-password">{t("auth.password")}</Label>
        <Input
          id="sign-up-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={error ? true : undefined}
        />
        <p className="text-xs text-muted-foreground">{t("auth.passwordHint")}</p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="sign-up-confirm-password">{t("auth.confirmPassword")}</Label>
        <Input
          id="sign-up-confirm-password"
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
        {t("auth.signUp")}
      </Button>
    </form>
  )
}
