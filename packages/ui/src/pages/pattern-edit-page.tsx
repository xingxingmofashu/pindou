"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  ArrowLeft,
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
import { PixiCanvas, type PixiCanvasApi } from "../components/pixi-canvas"
import { BeadStatsPanel } from "../components/bead-stats"
import { ZoomControls } from "../components/zoom-controls"
import { ColorPalette } from "../components/color-palette"
import { ExportDialog } from "../components/dialogs/export-dialog"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Label } from "../components/ui/label"
import { Separator } from "../components/ui/separator"
import { Spinner } from "../components/ui/spinner"
import { Textarea } from "../components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip"
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
} from "../components/ui/alert-dialog"
import { toast } from "../components/ui/toast"
import { useShortcuts } from "@pindou/core/hooks/use-shortcuts"
import { useEditStore } from "@pindou/core/hooks/use-edit"
import { useI18n } from "@pindou/core/i18n/client"
import type { ToolKind } from "@pindou/core/editor"
import type { Palette } from "@pindou/shared/types"

const TOOLS: { value: ToolKind; icon: typeof Pencil; shortcut: string }[] = [
  { value: "pen", icon: Pencil, shortcut: "B" },
  { value: "eraser", icon: Eraser, shortcut: "E" },
  { value: "fill", icon: PaintBucket, shortcut: "G" },
  { value: "eyedropper", icon: Pipette, shortcut: "I" },
]

/**
 * Shared pattern-edit page (web `/patterns/[id]/edit` + desktop
 * `/patterns/:id/edit`): collapsible left panel with title/description fields,
 * drawing tools and the colour palette, a canvas seeded with the saved grid,
 * and a save button. Framework-agnostic — navigation and persistence are
 * injected via `onBack`/`onSave` callbacks.
 */
export interface PatternEditPageProps {
  /** The pattern's brand palette (fixed for web; switchable on desktop). */
  palette: Palette
  /** Serialized code grid to seed the canvas with. */
  grid: string[][]
  /** Brands for the switcher; when empty the palette is fixed. */
  brands?: Palette[]
  /** Called when the user switches brand (desktop only); the parent updates
   *  the `palette` prop. Omit to fix the palette. */
  onPaletteChange?: (palette: Palette) => void
  /** Dark-mode flag; falls back to the shared theme context when omitted. */
  isDark?: boolean
  /** Navigate back to the pattern detail page. */
  onBack: () => void
  /**
   * Persist the edited pattern. The wrapper owns toasts and post-save
   * navigation. Throw to keep the saving spinner up (the shared page shows
   * the error toast).
   */
  onSave: (input: {
    title: string
    description: string
    beadStats: string
    grid: string[][]
  }) => Promise<void>
}

export function PatternEditPage({
  palette,
  grid,
  brands = [],
  isDark,
  onPaletteChange,
  onBack,
  onSave,
}: PatternEditPageProps) {
  const { t } = useI18n()
  const canvasApiRef = useRef<PixiCanvasApi>(null)

  const setApi = useEditStore((s) => s.setApi)
  const setZoom = useEditStore((s) => s.setZoom)
  const setActiveTool = useEditStore((s) => s.setActiveTool)
  const activeTool = useEditStore((s) => s.activeTool)
  const activeColorIndex = useEditStore((s) => s.activeColorIndex)
  const setActiveColorIndex = useEditStore((s) => s.setActiveColorIndex)
  const showLeftPanel = useEditStore((s) => s.showLeftPanel)
  const showBeadStats = useEditStore((s) => s.showBeadStats)
  const beadStats = useEditStore((s) => s.beadStats)
  const exportOpen = useEditStore((s) => s.exportOpen)
  const closeExport = useEditStore((s) => s.closeExport)
  const title = useEditStore((s) => s.title)
  const setTitle = useEditStore((s) => s.setTitle)
  const description = useEditStore((s) => s.description)
  const setDescription = useEditStore((s) => s.setDescription)
  const saving = useEditStore((s) => s.saving)

  // Registers the canvas's imperative API into the shared store so the
  // toolbar and panel controls can drive it.
  useEffect(() => {
    setApi(canvasApiRef.current)
    return () => setApi(null)
  }, [setApi])

  // Stable so the export dialog's memoized grid snapshot stays valid.
  const onGetCellsData = useCallback(() => canvasApiRef.current?.getCellsData() ?? null, [])

  // Recomputed by the canvas whenever the grid changes so the bead panel stays live.
  const onGridChange = useCallback(() => {
    useEditStore.getState().setBeadStats(canvasApiRef.current?.getBeadStats() ?? null)
  }, [])

  // Keeps the toolbar's undo/redo buttons in sync with the canvas history.
  const onHistoryChange = useCallback((canUndo: boolean, canRedo: boolean) => {
    useEditStore.getState().setHistory(canUndo, canRedo)
  }, [])

  useShortcuts(setActiveTool)

  const handleColorPick = useCallback(
    (index: number) => {
      setActiveColorIndex(index)
      setActiveTool("pen")
    },
    [setActiveColorIndex, setActiveTool],
  )

  // Brand switch: swap the canvas palette and reset to the first colour.
  // The parent owns the palette state (desktop); web fixes the palette.
  const handleBrandChange = useCallback(
    (code: string) => {
      if (!onPaletteChange) return
      const brand = brands.find((b) => b.code === code)
      if (!brand) return
      onPaletteChange(brand)
      setActiveColorIndex(1)
    },
    [brands, onPaletteChange, setActiveColorIndex],
  )

  const handleSave = useCallback(async () => {
    const { title: t2, description: d2 } = useEditStore.getState()
    if (!t2.trim()) {
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
    useEditStore.getState().setSaving(true)
    try {
      await onSave({
        title: t2.trim(),
        description: d2.trim(),
        beadStats: cells.beadStats,
        grid: cells.grid,
      })
      useEditStore.getState().setSaving(false)
    } catch (e) {
      useEditStore.getState().setSaving(false)
      toast.add({
        type: "error",
        title: t("desktop.saveFailed"),
        description: e instanceof globalThis.Error ? e.message : t("editor.networkError"),
      })
    }
  }, [onSave, t])

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <EditToolbar onSave={handleSave} onBack={onBack} />
      <div className="flex min-h-0 flex-1 gap-2">
        {showLeftPanel && (
          <EditFieldsPanel
            palette={palette}
            brands={brands}
            onBrandChange={handleBrandChange}
            activeColorIndex={activeColorIndex}
            onColorPick={handleColorPick}
          />
        )}
        <PixiCanvas
          className="min-h-0 min-w-0 flex-1 border p-2"
          palette={palette}
          grid={grid}
          activeTool={activeTool}
          activeColorIndex={activeColorIndex}
          isDark={isDark}
          apiRef={canvasApiRef}
          onZoomChange={setZoom}
          onGridChange={onGridChange}
          onHistoryChange={onHistoryChange}
          onColorPick={handleColorPick}
        />
        {showBeadStats && (
          <div className="w-56 shrink-0 overflow-hidden">
            <BeadStatsPanel stats={beadStats} palette={palette} />
          </div>
        )}
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

/** Top bar: back + title on the left, view toggles and actions on the right. */
function EditToolbar({
  onSave,
  onBack,
}: {
  onSave: () => void
  onBack: () => void
}) {
  const { t } = useI18n()
  const showLeftPanel = useEditStore((s) => s.showLeftPanel)
  const toggleLeftPanel = useEditStore((s) => s.toggleLeftPanel)
  const showBeadStats = useEditStore((s) => s.showBeadStats)
  const toggleBeadStats = useEditStore((s) => s.toggleBeadStats)
  const zoom = useEditStore((s) => s.zoom)
  const api = useEditStore((s) => s.api)
  const saving = useEditStore((s) => s.saving)
  const openExport = useEditStore((s) => s.openExport)

  return (
    <div className="flex items-center justify-between gap-2 border px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <Button variant="outline" size="sm" onClick={onBack}>
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

/** Collapsible left panel: drawing tools, title/description fields, palette. */
function EditFieldsPanel({
  palette,
  brands,
  onBrandChange,
  activeColorIndex,
  onColorPick,
}: {
  palette: Palette
  brands: Palette[]
  onBrandChange: (code: string) => void
  activeColorIndex: number
  onColorPick: (index: number) => void
}) {
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

  return (
    <div className="flex w-56 shrink-0 flex-col gap-3 overflow-hidden">
      <div className="space-y-1.5 border p-3">
        <div className="grid gap-1.5">
          <Label htmlFor="edit-title">
            {t("editor.title")} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="edit-title"
            type="text"
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="edit-description">{t("editor.description")}</Label>
          <Textarea
            id="edit-description"
            maxLength={2000}
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
              <AlertDialogDescription>{t("editor.clearCanvasDescription")}</AlertDialogDescription>
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
      <div className="min-h-0 flex-1">
        <ColorPalette
          brands={brands}
          palette={palette}
          activeColorIndex={activeColorIndex}
          onColorPick={onColorPick}
          onBrandChange={onBrandChange}
        />
      </div>
    </div>
  )
}
