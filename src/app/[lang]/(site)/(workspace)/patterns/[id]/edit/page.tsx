"use client"

import { useCallback, useRef, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, CaseSensitive, Download, List, Palette as PaletteIcon } from "lucide-react"
import { PixiCanvas, type PixiCanvasApi } from "@/components/editor/pixi-canvas"
import { ColorPalette } from "@/components/editor/color-palette"
import { BeadStatsPanel } from "@/components/editor/bead-stats"
import { ZoomControls } from "@/components/editor/zoom-controls"
import { ExportDialog } from "@/components/editor/export-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "@/components/ui/toast"
import { PatternUpdateSchema } from "@/db/schema"
import { fetcher, postJson } from "@/lib/utils"
import { DEFAULT_ZOOM } from "@/lib/constants"
import { localizedPath } from "@/i18n/config"
import { useI18n } from "@/i18n/client"
import type { BeadStats } from "@/lib/editor"
import type { PatternDetailType } from "@/db/schema"
import type { Palette } from "@/types"
import Loading from "./loading"
import Error from "./error"

export default function PatternEditPage() {
  const { id } = useParams<{ id: string }>()
  const { locale, t } = useI18n()
  const { data, error, mutate } = useSWR<PatternDetailType>(`/api/patterns/${id}`, fetcher)
  const { data: brand, error: brandError, mutate: mutateBrand } = useSWR<Palette>(
    data ? `/api/brands/${data.brandId}` : null,
    fetcher,
  )

  // Pattern fetch failed — show an error state instead of a blank page.
  if (error) {
    return (
      <Error
        title={t("patternDetail.loadFailedTitle")}
        description={t("patternDetail.loadFailedDescription")}
        onRetry={() => mutate()}
      />
    )
  }

  // Brand (palette) fetch failed — without it the editor can't run, so show a
  // distinct error instead of spinning forever.
  if (brandError) {
    return (
      <Error
        title={t("patternDetail.paletteFailedTitle")}
        description={t("patternDetail.paletteFailedDescription")}
        onRetry={() => mutateBrand()}
      />
    )
  }

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

interface EditToolbarProps {
  id: string
  showLabels: boolean
  onToggleLabels: () => void
  showLeftPanel: boolean
  onToggleLeftPanel: () => void
  showBeadStats: boolean
  onToggleBeadStats: () => void
  zoom: number
  onSetZoom: (z: number | ((prev: number) => number)) => void
  onReset: () => void
  onExport: () => void
  saving: boolean
  onSave: () => void
}

/** Pattern-editor toolbar: back + title on the left, view toggles and actions on the right. */
function EditToolbar({
  id,
  showLabels,
  onToggleLabels,
  showLeftPanel,
  onToggleLeftPanel,
  showBeadStats,
  onToggleBeadStats,
  zoom,
  onSetZoom,
  onReset,
  onExport,
  saving,
  onSave,
}: EditToolbarProps) {
  const { locale, t } = useI18n()
  return (
    <div className="flex items-center justify-between gap-2 border px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href={localizedPath(locale, `/patterns/${id}`)} />}
        >
          <ArrowLeft data-icon="inline-start" />
          {t("patternDetail.backToPattern")}
        </Button>
        <h1 className="truncate text-sm font-semibold">{t("patternDetail.editTitle")}</h1>
      </div>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant={showLabels ? "secondary" : "outline"}
                size="icon-sm"
                aria-label={t("editor.showLabels")}
              >
                <CaseSensitive data-icon="inline-start" />
              </Button>
            }
            onClick={onToggleLabels}
          />
          <TooltipContent side="bottom">{t("editor.labels")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant={showLeftPanel ? "secondary" : "outline"}
                size="icon-sm"
                aria-label={t("editor.showColorPaletteToggle")}
              >
                <PaletteIcon data-icon="inline-start" />
              </Button>
            }
            onClick={onToggleLeftPanel}
          />
          <TooltipContent side="bottom">{t("editor.colorPalette")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant={showBeadStats ? "secondary" : "outline"}
                size="icon-sm"
                aria-label={t("editor.showBeadStatsToggle")}
              >
                <List data-icon="inline-start" />
              </Button>
            }
            onClick={onToggleBeadStats}
          />
          <TooltipContent side="bottom">{t("editor.beadStats")}</TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ZoomControls zoom={zoom} onSetZoom={onSetZoom} onReset={onReset} />
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download data-icon="inline-start" />
          {t("editor.export")}
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving && <Spinner data-icon="inline-start" />}
          {t("patternDetail.save")}
        </Button>
      </div>
    </div>
  )
}

interface EditFieldsPanelProps {
  title: string
  onTitleChange: (value: string) => void
  description: string
  onDescriptionChange: (value: string) => void
  palette: Palette
  activeColorIndex: number
  onColorPick: (index: number) => void
}

/** Collapsible left panel: title/description fields plus the colour palette. */
function EditFieldsPanel({
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  palette,
  activeColorIndex,
  onColorPick,
}: EditFieldsPanelProps) {
  const { t } = useI18n()
  return (
    <div className="flex w-56 shrink-0 min-h-0 flex-col gap-3 overflow-hidden">
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
            onChange={(e) => onTitleChange(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="edit-description">{t("editor.description")}</Label>
          <Textarea
            id="edit-description"
            maxLength={280}
            rows={2}
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="resize-none"
          />
        </div>
        <p className="text-xs text-muted-foreground">{t("patternDetail.editHint")}</p>
      </div>
      <div className="flex-1 min-h-0">
        <ColorPalette
          palette={palette}
          activeColorIndex={activeColorIndex}
          onColorPick={onColorPick}
        />
      </div>
    </div>
  )
}

interface EditBeadStatsPanelProps {
  stats: BeadStats | null
  palette: Palette
}

/** Collapsible right panel: live bead-usage counts. */
function EditBeadStatsPanel({ stats, palette }: EditBeadStatsPanelProps) {
  return (
    <div className="w-56 shrink-0 min-h-0 overflow-hidden">
      <BeadStatsPanel stats={stats} palette={palette} />
    </div>
  )
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
  const [showLabels, setShowLabels] = useState(false)
  const [showLeftPanel, setShowLeftPanel] = useState(true)
  const [showBeadStats, setShowBeadStats] = useState(true)
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [beadStats, setBeadStats] = useState<BeadStats | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const backToPattern = useCallback(
    () => router.push(localizedPath(locale, `/patterns/${id}`)),
    [router, locale, id],
  )

  // Recomputed by the canvas whenever the grid changes (stroke end, fill,
  // clear, import) so the bead-usage panel stays live.
  const onGridChange = useCallback(() => {
    setBeadStats(canvasApiRef.current?.getBeadStats() ?? null)
  }, [])

  // Stable so the export dialog's memoized grid snapshot stays valid.
  const onGetCellsData = useCallback(() => canvasApiRef.current?.getCellsData() ?? null, [])

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
        description: e instanceof globalThis.Error ? e.message : t("editor.networkError"),
      })
    } finally {
      setSaving(false)
    }
  }, [title, description, id, t, backToPattern])

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <EditToolbar
        id={id}
        showLabels={showLabels}
        onToggleLabels={() => setShowLabels((v) => !v)}
        showLeftPanel={showLeftPanel}
        onToggleLeftPanel={() => setShowLeftPanel((v) => !v)}
        showBeadStats={showBeadStats}
        onToggleBeadStats={() => setShowBeadStats((v) => !v)}
        zoom={zoom}
        onSetZoom={(z) => canvasApiRef.current?.setZoom(z)}
        onReset={() => canvasApiRef.current?.fitToCanvas()}
        onExport={() => setExportOpen(true)}
        saving={saving}
        onSave={handleSave}
      />

      {/* Left panel (collapsible), canvas, right bead-usage panel (collapsible). */}
      <div className="flex-1 min-h-0 flex gap-2">
        {showLeftPanel && (
          <EditFieldsPanel
            title={title}
            onTitleChange={setTitle}
            description={description}
            onDescriptionChange={setDescription}
            palette={palette}
            activeColorIndex={activeColorIndex}
            onColorPick={setActiveColorIndex}
          />
        )}
        <PixiCanvas
          palette={palette}
          grid={pattern.gridData}
          activeColorIndex={activeColorIndex}
          label={showLabels}
          apiRef={canvasApiRef}
          onZoomChange={setZoom}
          onGridChange={onGridChange}
          className="flex-1 min-w-0 border"
        />
        {showBeadStats && (
          <EditBeadStatsPanel stats={beadStats} palette={palette} />
        )}
      </div>

      {exportOpen && (
        <ExportDialog
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          onGetCellsData={onGetCellsData}
          palette={palette}
        />
      )}
    </div>
  )
}
