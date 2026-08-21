"use client"

import { useEffect } from "react"
import { Button } from "@pindou/ui/components/ui/button"
import { useI18n } from "@pindou/core/i18n/client"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useI18n()

  useEffect(() => {
    // Log the error to the console (e.g. capture with your error tooling).
    console.error(error)
  }, [error])

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-2xl font-semibold">{t("common.errorTitle")}</h1>
      <p className="text-sm text-muted-foreground">{t("common.errorDescription")}</p>
      <Button onClick={reset} variant="outline">
        {t("common.retry")}
      </Button>
    </div>
  )
}
