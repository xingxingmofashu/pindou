"use client"

import { useCallback, useRef, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { PixiCanvas, type PixiCanvasApi } from "@/components/editor/pixi-canvas"
import { ColorPalette } from "@/components/editor/color-palette"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { PatternUpdateSchema } from "@/db/schema"
import { fetcher, postJson } from "@/lib/utils"
import { localizedPath } from "@/i18n/config"
import { useI18n } from "@/i18n/client"
import type { PatternDetailType } from "@/db/schema"
import type { Palette } from "@/types"
import Loading from "./loading"

export default function PatternEditPage() {
  const { id } = useParams<{ id: string }>()
  const { locale, t } = useI18n()
  const { data, error } = useSWR<PatternDetailType>(`/api/patterns/${id}`, fetcher)
  const { data: brand } = useSWR<Palette>(
    data ? `/api/brands/${data.brandId}` : null,
    fetcher,
  )

  if (error) return null

  if (!data || !brand) {
    return <Loading />
  }

  if (!data.canEdit) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 border p-6 text-center">
        <p className="text-sm text-muted-foreground">{t("patternDetail.notOwnerDescription")}</p>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={localizedPath(locale, `/patterns/${id}`)} />}
        >
          {t("patternDetail.backToPattern")}
        </Button>
      </div>
    )
  }

  return <EditForm key={data.id} id={id} pattern={data} palette={brand} />
}

/** Editable form + canvas for an owned pattern (lazy-inits from the loaded pattern). */
function EditForm({
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
  const canvasApiRef = useRef<PixiCanvasApi>(null)
  const [title, setTitle] = useState(pattern.title)
  const [description, setDescription] = useState(pattern.description ?? "")
  const [activeColorIndex, setActiveColorIndex] = useState(1)
  const [saving, setSaving] = useState(false)

  const backToPattern = useCallback(
    () => router.push(localizedPath(locale, `/patterns/${id}`)),
    [router, locale, id],
  )

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      toast.add({
        type: "error",
        title: t("editor.invalidInput"),
        description: t("editor.titleRequired"),
      })
      return
    }
    const cells = canvasApiRef.current?.getCellsData()
    if (!cells) {
      toast.add({
        type: "error",
        title: t("editor.canvasEmpty"),
        description: t("editor.canvasEmptyDescription"),
      })
      return
    }

    const parsed = PatternUpdateSchema.safeParse({
      title,
      description,
      gridData: cells.grid,
      beadStats: cells.beadStats,
    })
    if (!parsed.success) {
      toast.add({
        type: "error",
        title: t("editor.invalidInput"),
        description: parsed.error.issues[0]?.message ?? t("editor.invalidInput"),
      })
      return
    }

    setSaving(true)
    try {
      await postJson<{ id: string }>(
        `/api/patterns/${id}`,
        JSON.stringify(parsed.data),
        t("patternDetail.saveFailedTitle"),
        "PATCH",
      )
      toast.add({ type: "success", title: t("patternDetail.saveSuccess") })
      backToPattern()
    } catch (e) {
      toast.add({
        type: "error",
        title: t("patternDetail.saveFailedTitle"),
        description: e instanceof Error ? e.message : t("editor.networkError"),
      })
    } finally {
      setSaving(false)
    }
  }, [title, description, id, t, backToPattern])

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={localizedPath(locale, `/patterns/${id}`)} />}
        >
          <ArrowLeft data-icon="inline-start" />
          {t("patternDetail.backToPattern")}
        </Button>
        <h1 className="text-sm font-semibold truncate">{t("patternDetail.editTitle")}</h1>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving && <Spinner data-icon="inline-start" />}
          {t("patternDetail.save")}
        </Button>
      </div>
      <div className="flex-1 min-h-0 flex gap-2">
        <div className="w-56 shrink-0 min-h-0 flex flex-col gap-3">
          <div className="space-y-1.5 border p-3">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-title">
                {t("editor.title")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-title"
                type="text"
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-description">{t("editor.description")}</Label>
              <Textarea
                id="edit-description"
                maxLength={280}
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="resize-none"
              />
            </div>
            <p className="text-xs text-muted-foreground">{t("patternDetail.editHint")}</p>
          </div>
          <div className="flex-1 min-h-0">
            <ColorPalette
              palette={palette}
              activeColorIndex={activeColorIndex}
              onColorPick={setActiveColorIndex}
            />
          </div>
        </div>
        <PixiCanvas
          palette={palette}
          grid={pattern.gridData}
          activeColorIndex={activeColorIndex}
          apiRef={canvasApiRef}
          className="flex-1 min-w-0 border"
        />
      </div>
    </div>
  )
}
