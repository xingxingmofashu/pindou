"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/i18n/client"

/**
 * Centered error panel with a retry button.
 *
 * Used two ways:
 * - Explicitly by the edit page with `title` / `description` / `onRetry` for
 *   SWR load failures.
 * - As the route error boundary (Next.js convention) with `error` / `reset`.
 */
export default function Error({
  title,
  description,
  onRetry,
  error,
  reset,
}: {
  title?: string
  description?: string
  onRetry?: () => void
  error?: Error & { digest?: string }
  reset?: () => void
}) {
  const { t } = useI18n()

  useEffect(() => {
    if (error) console.error(error)
  }, [error])

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 border p-6 text-center">
      <div>
        <p className="text-sm font-medium">{title ?? t("common.errorTitle")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description ?? t("common.errorDescription")}</p>
      </div>
      <Button variant="outline" onClick={() => (onRetry ? onRetry() : reset?.())}>
        {t("common.retry")}
      </Button>
    </div>
  )
}
