"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { useShallow } from "zustand/react/shallow"
import { Pencil, Eraser, PaintBucket, Pipette, Trash2, CaseSensitive, ImagePlus, Download, List, Palette as PaletteIcon, Undo2, Redo2 } from "lucide-react"
import { PixiCanvas, type PixiCanvasApi } from "@/components/pixi-canvas"
import { ColorPalette } from "@/components/color-palette"
import { BeadStatsPanel } from "@/components/bead-stats"
import { ZoomControls } from "@/components/zoom-controls"
import { Button } from "@pindou/ui/components/ui/button"
import { Separator } from "@pindou/ui/components/ui/separator"
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
import { useShortcuts } from "@/hooks/use-shortcuts"
import { useEditorStore } from "@/hooks/use-editor"
import { usePalette } from "@/hooks/use-palette"
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard"
import { useI18n } from "@/i18n/client"
import type { ToolKind, CellsData } from "@/lib/editor"

// Dialogs are only opened on demand — load them (and their heavy deps like
// the export PNG canvas + image transform) lazily instead of blocking the
// editor's initial bundle.
const PublishDialog = dynamic(() =>
  import("@/components/dialogs/publish-dialog").then((m) => m.PublishDialog),
  { ssr: false },
)
const ImportDialog = dynamic(() =>
  import("@/components/dialogs/import-dialog").then((m) => m.ImportDialog),
  { ssr: false },
)
const ExportDialog = dynamic(() =>
  import("@/components/dialogs/export-dialog").then((m) => m.ExportDialog),
  { ssr: false },
)

const TOOLS: { value: ToolKind; icon: typeof Pencil; shortcut: string }[] = [
  { value: "pen", icon: Pencil, shortcut: "B" },
  { value: "eraser", icon: Eraser, shortcut: "E" },
  { value: "fill", icon: PaintBucket, shortcut: "G" },
  { value: "eyedropper", icon: Pipette, shortcut: "I" },
]

/**
 * Editor body: registers the canvas API into the shared store and composes the
 * toolbar, panels, canvas, and dialogs. Cross-cutting state lives in
 * {@link useEditorStore}; this component only wires the imperative canvas ref.
 */
export default function EditorContent() {
  const canvasApiRef = useRef<PixiCanvasApi>(null)
  const setApi = useEditorStore((s) => s.setApi)
  const setZoom = useEditorStore((s) => s.setZoom)
  const setActiveTool = useEditorStore((s) => s.setActiveTool)
  const activeTool = useEditorStore((s) => s.activeTool)
  const activeColorIndex = useEditorStore((s) => s.activeColorIndex)
  const setActiveColorIndex = useEditorStore((s) => s.setActiveColorIndex)
  const showLabels = useEditorStore((s) => s.showLabels)
  const showColorPalette = useEditorStore((s) => s.showColorPalette)
  const showBeadStats = useEditorStore((s) => s.showBeadStats)
  const beadStats = useEditorStore((s) => s.beadStats)
  const { palette } = usePalette()

  // Registers the canvas's imperative API into the shared store so the toolbar
  // and dialogs can drive it. The canvas only mounts once the palette resolves
  // (EditablePaletteBridge returns null before that), so re-register on palette
  // change — otherwise the store keeps a null `api` from the first mount.
  useEffect(() => {
    setApi(canvasApiRef.current)
    return () => setApi(null)
  }, [setApi, palette])

  // Stable: both dialogs read the canvas grid through it, and the export dialog
  // memoizes on it, so an identity change per render would defeat the memo.
  const onGetCellsData = useCallback(() => canvasApiRef.current?.getCellsData() ?? null, [])
  // `loadGrid` closes over the palette, so it must read the live ref — the
  // store's `api` handle goes stale after a brand switch (the canvas rebuilds
  // its handle when the palette changes).
  const onLoadGrid = useCallback((grid: string[][]) => canvasApiRef.current?.loadGrid(grid), [])
  // Recomputed by the canvas whenever the grid changes, so the panel renders
  // live without the canvas pushing state per pointermove.
  const onGridChange = useCallback(() => {
    useEditorStore.getState().setBeadStats(canvasApiRef.current?.getBeadStats() ?? null)
  }, [])
  const onHistoryChange = useCallback((canUndo: boolean, canRedo: boolean) => {
    useEditorStore.getState().setHistory(canUndo, canRedo)
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

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <UnsavedChangesGuard dirty={beadStats !== null} />
      <EditorToolbar />
      <div className="flex-1 min-h-0 flex gap-2">
        {showColorPalette && <EditorColorPalettePanel />}
        <PixiCanvas
          className="flex-1 min-w-0 border p-2"
          activeTool={activeTool}
          activeColorIndex={activeColorIndex}
          label={showLabels}
          apiRef={canvasApiRef}
          onZoomChange={setZoom}
          onGridChange={onGridChange}
          onHistoryChange={onHistoryChange}
          onColorPick={handleColorPick}
        />
        {showBeadStats && <EditorBeadStatsPanel />}
      </div>
      <EditorDialogs onGetCellsData={onGetCellsData} onLoadGrid={onLoadGrid} />
    </div>
  )
}

/** Editor top bar: drawing tools, publish button, and zoom controls. */
function EditorToolbar() {
  const { t } = useI18n()
  const [clearOpen, setClearOpen] = useState(false)

  const {
    activeTool,
    setActiveTool,
    showLabels,
    toggleLabels,
    showBeadStats,
    toggleBeadStats,
    showColorPalette,
    toggleColorPalette,
    zoom,
    canUndo,
    canRedo,
    api,
    openImport,
    openExport,
    openPublish,
  } = useEditorStore(
    useShallow((s) => ({
      activeTool: s.activeTool,
      setActiveTool: s.setActiveTool,
      showLabels: s.showLabels,
      toggleLabels: s.toggleLabels,
      showBeadStats: s.showBeadStats,
      toggleBeadStats: s.toggleBeadStats,
      showColorPalette: s.showColorPalette,
      toggleColorPalette: s.toggleColorPalette,
      zoom: s.zoom,
      canUndo: s.canUndo,
      canRedo: s.canRedo,
      api: s.api,
      openImport: s.openImport,
      openExport: s.openExport,
      openPublish: s.openPublish,
    })),
  )

  return (
    <div className="flex items-center justify-between px-3 py-2 border">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5">
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
            <TooltipContent side="bottom">
              {t("editor.undo")} (⌘Z)
            </TooltipContent>
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
            <TooltipContent side="bottom">
              {t("editor.redo")} (⇧⌘Z)
            </TooltipContent>
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
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant={showLabels ? "secondary" : "outline"}
                  size="icon-xs"
                  aria-label={t("editor.showLabels")}
                >
                  <CaseSensitive data-icon="inline-start" />
                </Button>
              }
              onClick={toggleLabels}
            />
            <TooltipContent side="bottom">{t("editor.labels")}</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant={showColorPalette ? "secondary" : "outline"}
                  size="icon-xs"
                  aria-label={t("editor.showColorPaletteToggle")}
                >
                  <PaletteIcon data-icon="inline-start" />
                </Button>
              }
              onClick={toggleColorPalette}
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
                >
                  <List data-icon="inline-start" />
                </Button>
              }
              onClick={toggleBeadStats}
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
        <Button size="sm" onClick={openPublish}>
          {t("editor.publish")}
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

/** Left sidebar: the colour palette with brand switcher. */
function EditorColorPalettePanel() {
  const activeColorIndex = useEditorStore((s) => s.activeColorIndex)
  const setActiveColorIndex = useEditorStore((s) => s.setActiveColorIndex)
  return (
    <div className="w-56 shrink-0 overflow-hidden">
      <ColorPalette activeColorIndex={activeColorIndex} onColorPick={setActiveColorIndex} />
    </div>
  )
}

/** Right sidebar: live bead-usage counts. */
function EditorBeadStatsPanel() {
  const beadStats = useEditorStore((s) => s.beadStats)
  return (
    <div className="w-56 shrink-0 overflow-hidden">
      <BeadStatsPanel stats={beadStats} />
    </div>
  )
}

/** Publish / import / export dialogs, driven by the shared store. */
function EditorDialogs({
  onGetCellsData,
  onLoadGrid,
}: {
  onGetCellsData: () => CellsData | null
  onLoadGrid: (grid: string[][]) => void
}) {
  const publishOpen = useEditorStore((s) => s.publishOpen)
  const closePublish = useEditorStore((s) => s.closePublish)
  const importOpen = useEditorStore((s) => s.importOpen)
  const closeImport = useEditorStore((s) => s.closeImport)
  const exportOpen = useEditorStore((s) => s.exportOpen)
  const closeExport = useEditorStore((s) => s.closeExport)

  return (
    <>
      {publishOpen && (
        <PublishDialog
          open={publishOpen}
          onClose={closePublish}
          onGetCellsData={onGetCellsData}
        />
      )}
      {importOpen && (
        <ImportDialog
          open={importOpen}
          onClose={closeImport}
          onApply={onLoadGrid}
        />
      )}
      {exportOpen && (
        <ExportDialog
          open={exportOpen}
          onClose={closeExport}
          onGetCellsData={onGetCellsData}
        />
      )}
    </>
  )
}
