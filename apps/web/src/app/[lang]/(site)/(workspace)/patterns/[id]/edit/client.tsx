"use client"

import { useCallback, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { PatternEditPage } from "@pindou/ui/pages/pattern-edit-page"
import { useEditStore } from "@pindou/core/hooks/use-edit"
import { PatternUpdateSchema } from "@/db/schema"
import { postJson } from "@/lib/utils"
import { localizedPath } from "@pindou/core/i18n/config"
import { useI18n } from "@pindou/core/i18n/client"
import { toast } from "@pindou/ui/components/ui/toast"
import type { PatternDetailType } from "@/db/schema"
import type { Palette } from "@pindou/shared/types"

/**
 * Thin web wrapper around the shared {@link PatternEditPage}: seeds the shared
 * store from the loaded pattern, wires the Next.js router, and persists edits
 * through the PATCH API with the web's schema validation + toasts.
 */
export function PatternEditContentClient({
  id,
  pattern,
  palette,
}: {
  id: string
  pattern: PatternDetailType
  palette: Palette
}) {
  const router = useRouter()
  const { locale, t } = useI18n()

  // Seed the draft fields + reset per-instance state once per pattern. The
  // parent `key`s this form by `pattern.id`, so revalidation never re-seeds an
  // in-progress draft.
  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current) return
    seeded.current = true
    useEditStore.getState().reset(pattern.title, pattern.description)
  }, [pattern.title, pattern.description])

  const handleSave = useCallback(
    async (input: { title: string; description: string; beadStats: string; grid: string[][] }) => {
      const parsed = PatternUpdateSchema.safeParse({
        title: input.title,
        description: input.description,
        gridData: input.grid,
        beadStats: input.beadStats,
      })
      if (!parsed.success) {
        toast.add({
          type: "error",
          title: t("editor.invalidInput"),
          description: parsed.error.issues[0]?.message ?? t("editor.invalidInput"),
        })
        return
      }
      await postJson<{ id: string }>(
        `/api/patterns/${id}`,
        JSON.stringify(parsed.data),
        t("patternDetail.saveFailedTitle"),
        "PATCH",
      )
      toast.add({ type: "success", title: t("patternDetail.saveSuccess") })
      router.push(localizedPath(locale, `/patterns/${id}`))
    },
    [id, locale, router, t],
  )

  return (
    <PatternEditPage
      palette={palette}
      grid={pattern.gridData}
      onBack={() => router.push(localizedPath(locale, `/patterns/${id}`))}
      onSave={handleSave}
    />
  )
}
