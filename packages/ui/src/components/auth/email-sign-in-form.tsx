"use client"

import { useCallback, useState, type FormEvent } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Spinner } from "../ui/spinner"
import { cn } from "../../utils"
import { useI18n } from "@pindou/core/i18n/client"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface EmailSignInFormProps {
  /**
   * Sign in with the given credentials. Resolves to a localized error message,
   * or `null` when authentication succeeded.
   */
  onSubmit: (email: string, password: string) => Promise<string | null>
  submitLabel?: string
  className?: string
}

/**
 * Presentational email/password form.
 *
 * Better Auth and routing stay in the host app: the form only owns field state,
 * client-side validation, and the pending/error UI.
 */
export function EmailSignInForm({
  onSubmit,
  submitLabel,
  className,
}: EmailSignInFormProps) {
  const { t } = useI18n()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (pending) return

      const trimmedEmail = email.trim()
      if (!EMAIL_PATTERN.test(trimmedEmail)) {
        setError(t("auth.errors.invalidEmail"))
        return
      }
      if (!password) {
        setError(t("auth.errors.required"))
        return
      }

      setError(null)
      setPending(true)
      try {
        const message = await onSubmit(trimmedEmail, password)
        if (message) setError(message)
      } catch {
        setError(t("auth.errors.generic"))
      } finally {
        setPending(false)
      }
    },
    [email, onSubmit, password, pending, t],
  )

  return (
    <form className={cn("grid gap-3", className)} onSubmit={handleSubmit} noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="email-sign-in-email">{t("auth.email")}</Label>
        <Input
          id="email-sign-in-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={error ? true : undefined}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="email-sign-in-password">{t("auth.password")}</Label>
        <Input
          id="email-sign-in-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
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
        {submitLabel ?? t("auth.signInWithEmail")}
      </Button>
    </form>
  )
}
