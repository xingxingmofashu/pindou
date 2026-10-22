"use client"

import { useI18n } from "@pindou/core/i18n/client"
import { authErrorKey } from "@/lib/auth/errors"

/** Inline error banner for auth pages; the code may come from OAuth or an API call. */
export function AuthError({ code }: { code?: string }) {
  const { t } = useI18n()
  if (!code) return null

  return (
    <p
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {t(authErrorKey(code))}
    </p>
  )
}
