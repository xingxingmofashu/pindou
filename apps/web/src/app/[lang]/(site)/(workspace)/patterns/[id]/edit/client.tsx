"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  ArrowLeft,
  CaseSensitive,
  Download,
  Eraser,
  List,
  PaintBucket,
  Palette as PaletteIcon,
  Pencil,
  Pipette,
  Redo2,
  Trash2,
  Undo2,
} from "lucide-react"
import { PixiCanvas, type PixiCanvasApi } from "@pindou/ui/components/pixi-canvas"
import { ColorPalette } from "@/components/color-palette"
import { BeadStatsPanel } from "@pindou/ui/components/bead-stats"
import { ZoomControls } from "@pindou/ui/components/zoom-controls"
import { ExportDialog } from "@pindou/ui/dialogs/export-dialog"
import { Button } from "@pindou/ui/components/ui/button"
import { Input } from "@pindou/ui/components/ui/input"
import { Label } from "@pindou/ui/components/ui/label"
import { Separator } from "@pindou/ui/components/ui/separator"
import { Spinner } from "@pindou/ui/components/ui/spinner"
import { Textarea } from "@pindou/ui/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pindou/ui/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@pindou/ui/components/ui/alert-dialog"
import { toast } from "@pindou/ui/components/ui/toast"
import { PatternUpdateSchema } from "@/db/schema"
import { postJson } from "@/lib/utils"
import { localizedPath } from "@pindou/core/i18n/config.ts"
import { useI18n } from "@pindou/core/i18n/client.tsx"
import { useEditStore } from "@pindou/core/hooks/use-edit"
import { useShortcuts } from "@pindou/core/hooks/use-shortcuts"
import type { PatternDetailType } from "@/db/schema"
import type { Palette } from "@pindou/shared/types"
import type { ToolKind } from "@pindou/core/editor"

const TOOLS: { value: ToolKind; icon: typeof Pencil; shortcut: string }[] = [
  { value: "pen", icon: Pencil, shortcut: "B" },
  { value: "eraser", icon: Eraser, shortcut: "E" },
  { value: "fill", icon: PaintBucket, shortcut: "G" },
  { value: "eyedropper", icon: Pipette, shortcut: "I" },
]

/**
 * Editable form + canvas for an owned pattern. Registers the canvas API and
 * seeds the shared store from the loaded pattern; the toolbar, panels, and
 * export dialog all read/write {@link useEditStore}.
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
  const { resolvedTheme } = useTheme()
  const canvasApiRef = useRef<PixiCanvasApi>(null)
  const setApi = useEditStore((s) => s.setApi)
  const setZoom = useEditStore((s) => s.setZoom)
  const setActiveTool = useEditStore((s) => s.setActiveTool)
  const activeTool = useEditStore((s) => s.activeTool)
  const activeColorIndex = useEditStore((s) => s.activeColorIndex)
  const setActiveColorIndex = useEditStore((s) => s.setActiveColorIndex)
  const showLabels = useEditStore((s) => s.showLabels)
  const showLeftPanel = useEditStore((s) => s.showLeftPanel)
  const showBeadStats = useEditStore((s) => s.showBeadStats)
  const exportOpen = useEditStore((s) => s.exportOpen)
  const closeExport = useEditStore((s) => s.closeExport)

  // Seed the draft fields + reset per-instance state once per pattern. The
  // parent `key`s this form by `pattern.id`, and revalidation must not re-seed
  // (that would wipe in-progress edits), so guard on the pattern id.
  const lastSeededId = useRef<string | null>(null)
  useEffect(() => {
    if (lastSeededId.current === pattern.id) return
    lastSeededId.current = pattern.id
    useEditStore.getState().reset(pattern.title, pattern.description ?? "")
  }, [pattern.id, pattern.title, pattern.description])

  // Registers the canvas's imperative API into the shared store.
  useEffect(() => {
    setApi(canvasApiRef.current)
    return () => setApi(null)
  }, [setApi])

  // Stable so the export dialog's memoized grid snapshot stays valid.
  const onGetCellsData = useCallback(() => canvasApiRef.current?.getCellsData() ?? null, [])
  // Recomputed by the canvas whenever the grid changes (stroke end, fill,
  // clear, import) so the bead-usage panel stays live.
  const onGridChange = useCallback(() => {
    useEditStore.getState().setBeadStats(canvasApiRef.current?.getBeadStats() ?? null)
  }, [])

  // Keeps the toolbar's undo/redo buttons in sync with the canvas history.
  const onHistoryChange = useCallback((canUndo: boolean, canRedo: boolean) => {
    useEditStore.getState().setHistory(canUndo, canRedo)
  }, [])

  // Tool shortcuts (B/E/G) advertised in the toolbar tooltips.
  useShortcuts(setActiveTool)

  // Eyedropper pick: set the sampled colour, then return to the pen tool so a
  // follow-up click draws instead of picking again.
  const handleColorPick = useCallback(
    (index: number) => {
      setActiveColorIndex(index)
      setActiveTool("pen")
    },
    [setActiveColorIndex, setActiveTool],
  )

  const backToPattern = useCallback(
    () => router.push(localizedPath(locale, `/patterns/${id}`)),
    [router, locale, id],
  )

  const handleSave = useCallback(async () => {
    const { title, description } = useEditStore.getState()
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

    useEditStore.getState().setSaving(true)
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
      useEditStore.getState().setSaving(false)
    }
  }, [id, t, backToPattern])

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <PatternEditToolbar id={id} onSave={handleSave} />
      <div className="flex-1 min-h-0 flex gap-2">
        {showLeftPanel && <PatternEditFieldsPanel palette={palette} />}
        <PixiCanvas
          palette={palette}
          grid={pattern.gridData}
          activeTool={activeTool}
          activeColorIndex={activeColorIndex}
          label={showLabels}
          isDark={resolvedTheme === "dark"}
          apiRef={canvasApiRef}
          onZoomChange={setZoom}
          onGridChange={onGridChange}
          onHistoryChange={onHistoryChange}
          onColorPick={handleColorPick}
          className="flex-1 min-w-0 border"
        />
        {showBeadStats && <PatternEditBeadStatsPanel palette={palette} />}
      </div>
      <ExportDialog
        open={exportOpen}
        onClose={closeExport}
        onGetCellsData={onGetCellsData}
        palette={palette}
      />
    </div>
  )
}

/** Pattern-editor toolbar: back + title on the left, view toggles and actions on the right. */
function PatternEditToolbar({ id, onSave }: { id: string; onSave: () => void }) {
  const { locale, t } = useI18n()
  const showLabels = useEditStore((s) => s.showLabels)
  const toggleLabels = useEditStore((s) => s.toggleLabels)
  const showLeftPanel = useEditStore((s) => s.showLeftPanel)
  const toggleLeftPanel = useEditStore((s) => s.toggleLeftPanel)
  const showBeadStats = useEditStore((s) => s.showBeadStats)
  const toggleBeadStats = useEditStore((s) => s.toggleBeadStats)
  const zoom = useEditStore((s) => s.zoom)
  const api = useEditStore((s) => s.api)
  const openExport = useEditStore((s) => s.openExport)
  const saving = useEditStore((s) => s.saving)

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
            onClick={toggleLabels}
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
            onClick={toggleLeftPanel}
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
            onClick={toggleBeadStats}
          />
          <TooltipContent side="bottom">{t("editor.beadStats")}</TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ZoomControls
          zoom={zoom}
          onSetZoom={(z) => api?.setZoom(z)}
          onReset={() => api?.fitToCanvas()}
        />
        <Button variant="outline" size="sm" onClick={openExport}>
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

/** Collapsible left panel: drawing tools, title/description fields, and the colour palette. */
function PatternEditFieldsPanel({ palette }: { palette: Palette }) {
  const { t } = useI18n()
  const [clearOpen, setClearOpen] = useState(false)
  const activeTool = useEditStore((s) => s.activeTool)
  const setActiveTool = useEditStore((s) => s.setActiveTool)
  const canUndo = useEditStore((s) => s.canUndo)
  const canRedo = useEditStore((s) => s.canRedo)
  const api = useEditStore((s) => s.api)
  const title = useEditStore((s) => s.title)
  const setTitle = useEditStore((s) => s.setTitle)
  const description = useEditStore((s) => s.description)
  const setDescription = useEditStore((s) => s.setDescription)
  const activeColorIndex = useEditStore((s) => s.activeColorIndex)
  const setActiveColorIndex = useEditStore((s) => s.setActiveColorIndex)

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
      <div className="flex items-center gap-0.5 border px-2 py-1.5">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="icon-xs"
                disabled={!canUndo}
                aria-label={t("editor.undo")}
              >
                <Undo2 data-icon="inline-start" />
              </Button>
            }
            onClick={() => api?.undo()}
          />
          <TooltipContent side="bottom">{t("editor.undo")} (⌘Z)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="icon-xs"
                disabled={!canRedo}
                aria-label={t("editor.redo")}
              >
                <Redo2 data-icon="inline-start" />
              </Button>
            }
            onClick={() => api?.redo()}
          />
          <TooltipContent side="bottom">{t("editor.redo")} (⇧⌘Z)</TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" className="mx-1 h-5" />
        {TOOLS.map(({ value, icon: Icon, shortcut }) => {
          const label = t(`editor.${value}`)
          return (
            <Tooltip key={value}>
              <TooltipTrigger
                render={
                  <Button
                    variant={activeTool === value ? "secondary" : "outline"}
                    size="icon-xs"
                    aria-label={label}
                  >
                    <Icon data-icon="inline-start" />
                  </Button>
                }
                onClick={() => setActiveTool(value)}
              />
              <TooltipContent side="bottom">
                {label} ({shortcut})
              </TooltipContent>
            </Tooltip>
          )
        })}
        <Separator orientation="vertical" className="mx-1 h-5" />
        <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
          <Tooltip>
            <TooltipTrigger
              render={
                <AlertDialogTrigger
                  render={
                    <Button variant="outline" size="icon-xs" aria-label={t("editor.clearCanvasAria")}>
                      <Trash2 data-icon="inline-start" />
                    </Button>
                  }
                />
              }
            />
            <TooltipContent side="bottom">{t("editor.clearCanvas")}</TooltipContent>
          </Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("editor.clearCanvas")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("editor.clearCanvasDescription")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  api?.clearCanvas()
                  setClearOpen(false)
                }}
              >
                {t("editor.clear")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <div className="flex-1 min-h-0">
        <ColorPalette
          palette={palette}
          activeColorIndex={activeColorIndex}
          onColorPick={setActiveColorIndex}
        />
      </div>
    </div>
  )
}

/** Collapsible right panel: live bead-usage counts. */
function PatternEditBeadStatsPanel({ palette }: { palette: Palette }) {
  const beadStats = useEditStore((s) => s.beadStats)
  return (
    <div className="w-56 shrink-0 min-h-0 overflow-hidden">
      <BeadStatsPanel stats={beadStats} palette={palette} />
    </div>
  )
}
