"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import {
  Pencil,
  Eraser,
  PaintBucket,
  Pipette,
  Trash2,
  ImagePlus,
  Download,
  List,
  Palette as PaletteIcon,
  Undo2,
  Redo2,
} from "lucide-react"
import { PixiCanvas, type PixiCanvasApi } from "../components/pixi-canvas"
import { BeadStatsPanel } from "../components/bead-stats"
import { ZoomControls } from "../components/zoom-controls"
import { ColorPalette } from "../components/color-palette"
import { ImportDialog } from "../components/dialogs/import-dialog"
import { ExportDialog } from "../components/dialogs/export-dialog"
import { Button } from "../components/ui/button"
import { Separator } from "../components/ui/separator"
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
import { useShortcuts } from "@pindou/core/hooks/use-shortcuts"
import { useEditorStore } from "@pindou/core/hooks/use-editor"
import { usePalette } from "@pindou/core/hooks/use-palette"
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
 * Shared new-pattern editor (web `/editor` + desktop `/editor`). The active
 * palette lives in the shared `usePalette` store — the host passes the brand
 * catalog (`brands`) and the shared page seeds/switches the store. The primary
 * action (web: publish, desktop: save) is injected via `primaryLabel` +
 * `onPrimary`, and the host renders its own dialog (Publish/Save) as children.
 */
export interface EditorPageProps {
  /** All brands for the switcher (web: fetched catalog; desktop: PALETTES). */
  brands: Palette[]
  /** Dark-mode flag; falls back to the shared theme context when omitted. */
  isDark?: boolean
  /** Primary action button label (web: "Publish", desktop: "Save"). */
  primaryLabel: string
  /** Opens the host's publish/save dialog. */
  onPrimary: () => void
  /** Disables the primary button (e.g. empty canvas on desktop). */
  primaryDisabled?: boolean
  /** Creates the image→grid conversion worker (worker URL differs per host). */
  createWorker: () => Worker
  /** Host-rendered dialogs (publish/save). */
  children?: ReactNode
}

export function EditorPage({
  brands,
  isDark,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  createWorker,
  children,
}: EditorPageProps) {
  const { t } = useI18n()
  const canvasApiRef = useRef<PixiCanvasApi>(null)
  const { palette, setActivePalette } = usePalette()
  const resolvedPalette = palette ?? brands[0]

  const setApi = useEditorStore((s) => s.setApi)
  const setZoom = useEditorStore((s) => s.setZoom)
  const setActiveTool = useEditorStore((s) => s.setActiveTool)
  const activeTool = useEditorStore((s) => s.activeTool)
  const activeColorIndex = useEditorStore((s) => s.activeColorIndex)
  const setActiveColorIndex = useEditorStore((s) => s.setActiveColorIndex)
  const showColorPalette = useEditorStore((s) => s.showColorPalette)
  const showBeadStats = useEditorStore((s) => s.showBeadStats)
  const beadStats = useEditorStore((s) => s.beadStats)
  const closeImport = useEditorStore((s) => s.closeImport)
  const closeExport = useEditorStore((s) => s.closeExport)
  const importOpen = useEditorStore((s) => s.importOpen)
  const exportOpen = useEditorStore((s) => s.exportOpen)

  // Registers the canvas's imperative API into the shared store so the toolbar
  // and dialogs can drive it. Re-register on palette change — the canvas
  // rebuilds its handle when the palette changes.
  useEffect(() => {
    setApi(canvasApiRef.current)
    return () => setApi(null)
  }, [setApi, palette])

  // Seed the active palette from the catalog once it arrives (the canvas only
  // mounts after the palette resolves).
  useEffect(() => {
    const first = brands[0]
    if (first && !palette) setActivePalette(first)
  }, [brands, palette, setActivePalette])

  // Stable callbacks for the dialogs.
  const onGetCellsData = useCallback(() => canvasApiRef.current?.getCellsData() ?? null, [])
  const onLoadGrid = useCallback((grid: string[][]) => canvasApiRef.current?.loadGrid(grid), [])
  const onGridChange = useCallback(() => {
    useEditorStore.getState().setBeadStats(canvasApiRef.current?.getBeadStats() ?? null)
  }, [])
  const onHistoryChange = useCallback((u: boolean, r: boolean) => {
    useEditorStore.getState().setHistory(u, r)
  }, [])

  useShortcuts(setActiveTool)

  const handleColorPick = useCallback(
    (index: number) => {
      setActiveColorIndex(index)
      setActiveTool("pen")
    },
    [setActiveColorIndex, setActiveTool],
  )

  const handleBrandChange = useCallback(
    (code: string) => {
      const brand = brands.find((b) => b.code === code)
      if (!brand) return
      setActivePalette(brand)
      setActiveColorIndex(1)
    },
    [brands, setActivePalette, setActiveColorIndex],
  )

  if (!resolvedPalette) {
    return (
      <div className="flex h-full flex-col gap-2 overflow-hidden">
        <div className="h-12 shrink-0 border px-3 py-2" />
        <div className="min-h-0 flex-1 animate-pulse bg-muted/30" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <EditorToolbar
        onPrimary={onPrimary}
        primaryLabel={primaryLabel}
        primaryDisabled={primaryDisabled}
      />
      <div className="flex min-h-0 flex-1 gap-2">
        {showColorPalette && (
          <div className="w-56 shrink-0 overflow-hidden">
            <ColorPalette
              activeColorIndex={activeColorIndex}
              onColorPick={handleColorPick}
              brands={brands}
              palette={resolvedPalette}
              onBrandChange={handleBrandChange}
            />
          </div>
        )}
        <PixiCanvas
          className="min-h-0 min-w-0 flex-1 border p-2"
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
            <BeadStatsPanel stats={beadStats} palette={resolvedPalette} />
          </div>
        )}
      </div>
      {importOpen && (
        <ImportDialog
          open={importOpen}
          onClose={closeImport}
          onApply={onLoadGrid}
          createWorker={createWorker}
          palette={resolvedPalette}
        />
      )}
      {exportOpen && (
        <ExportDialog
          open={exportOpen}
          onClose={closeExport}
          onGetCellsData={onGetCellsData}
          palette={resolvedPalette}
        />
      )}
      {children}
    </div>
  )
}

/** Top bar: drawing tools, panels toggles, and the primary action. */
function EditorToolbar({
  onPrimary,
  primaryLabel,
  primaryDisabled,
}: {
  onPrimary: () => void
  primaryLabel: string
  primaryDisabled: boolean
}) {
  const { t } = useI18n()
  const [clearOpen, setClearOpen] = useState(false)
  const activeTool = useEditorStore((s) => s.activeTool)
  const setActiveTool = useEditorStore((s) => s.setActiveTool)
  const canUndo = useEditorStore((s) => s.canUndo)
  const canRedo = useEditorStore((s) => s.canRedo)
  const api = useEditorStore((s) => s.api)
  const showColorPalette = useEditorStore((s) => s.showColorPalette)
  const toggleColorPalette = useEditorStore((s) => s.toggleColorPalette)
  const showBeadStats = useEditorStore((s) => s.showBeadStats)
  const toggleBeadStats = useEditorStore((s) => s.toggleBeadStats)
  const openImport = useEditorStore((s) => s.openImport)
  const openExport = useEditorStore((s) => s.openExport)
  const zoom = useEditorStore((s) => s.zoom)
  const setZoom = useEditorStore((s) => s.setZoom)

  return (
    <div className="flex items-center justify-between border px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="outline" size="icon-xs" disabled={!canUndo} aria-label={t("editor.undo")} onClick={() => api?.undo()}>
                  <Undo2 data-icon="inline-start" />
                </Button>
              }
            />
            <TooltipContent side="bottom">{t("editor.undo")} (⌘Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button variant="outline" size="icon-xs" disabled={!canRedo} aria-label={t("editor.redo")} onClick={() => api?.redo()}>
                  <Redo2 data-icon="inline-start" />
                </Button>
              }
            />
            <TooltipContent side="bottom">{t("editor.redo")} (⇧⌘Z)</TooltipContent>
          </Tooltip>
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
                      onClick={() => setActiveTool(value)}
                    >
                      <Icon data-icon="inline-start" />
                    </Button>
                  }
                />
                <TooltipContent side="bottom">
                  {label} ({shortcut})
                </TooltipContent>
              </Tooltip>
            )
          })}
          <Separator orientation="vertical" className="mx-1 h-5" />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant={showColorPalette ? "secondary" : "outline"}
                  size="icon-xs"
                  aria-label={t("editor.showColorPaletteToggle")}
                  onClick={toggleColorPalette}
                >
                  <PaletteIcon data-icon="inline-start" />
                </Button>
              }
            />
            <TooltipContent side="bottom">{t("editor.colorPalette")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant={showBeadStats ? "secondary" : "outline"}
                  size="icon-xs"
                  aria-label={t("editor.showBeadStatsToggle")}
                  onClick={toggleBeadStats}
                >
                  <List data-icon="inline-start" />
                </Button>
              }
            />
            <TooltipContent side="bottom">{t("editor.beadStats")}</TooltipContent>
          </Tooltip>
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
      </div>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button size="sm" variant="outline" onClick={openImport}>
                <ImagePlus data-icon="inline-start" />
                {t("editor.import")}
              </Button>
            }
          />
          <TooltipContent side="bottom">{t("editor.importFromImage")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button size="sm" variant="outline" onClick={openExport}>
                <Download data-icon="inline-start" />
                {t("editor.export")}
              </Button>
            }
          />
          <TooltipContent side="bottom">{t("editor.exportAsPng")}</TooltipContent>
        </Tooltip>
        <Button size="sm" onClick={onPrimary} disabled={primaryDisabled}>
          {primaryLabel}
        </Button>
        <ZoomControls
          zoom={zoom}
          onSetZoom={(z) => api?.setZoom(z)}
          onReset={() => api?.fitToCanvas()}
        />
      </div>
    </div>
  )
}
