"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import useSWR from "swr"
import { Pencil, Eraser, PaintBucket, Trash2, CaseSensitive, ImagePlus, Download, List, Palette as PaletteIcon, Undo2, Redo2 } from "lucide-react"
import { PixiCanvas, type PixiCanvasApi } from "@/components/pixi-canvas"
import { ColorPalette } from "@/components/color-palette"
import { BeadStatsPanel } from "@/components/bead-stats"
import { ZoomControls } from "@/components/zoom-controls"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
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
} from "@/components/ui/alert-dialog"
import { useToolShortcuts } from "@/hooks/use-tool-shortcuts"
import { usePalette } from "@/hooks/use-palette"
import { useI18n } from "@/i18n/client"
import { fetcher } from "@/lib/utils"
import { DEFAULT_ZOOM } from "@/lib/constants"
import type { ToolKind, BeadStats } from "@/lib/editor"
import type { Palette } from "@/types"

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
]

/**
 * Editor entry: resolves the active palette (seeding it from the catalog on
 * first load) and renders the editor once it's ready.
 */
export default function EditorPage() {
  const { palette, setActivePalette } = usePalette()

  // Seed the active palette once the catalog arrives — same flow ColorPalette
  // uses, hoisted so the canvas only mounts after a palette exists.
  const { data: brands } = useSWR<Array<Palette>>("/api/brands", fetcher)
  useEffect(() => {
    if (!palette && brands?.[0]) setActivePalette(brands[0])
  }, [brands, palette, setActivePalette])

  if (!palette) return <EditorLoading />

  return <EditorContent />
}

/** Editor body: owns the editor state and composes the toolbar, panels, and canvas. */
function EditorContent() {
  const canvasApiRef = useRef<PixiCanvasApi>(null)
  const [activeTool, setActiveTool] = useState<ToolKind>("pen")
  const [activeColorIndex, setActiveColorIndex] = useState(1)
  const [toggleLabels, setToggleLabels] = useState(false)
  const [showBeadStats, setShowBeadStats] = useState(true)
  const [showColorPalette, setShowColorPalette] = useState(true)
  // Recomputed by the canvas whenever the grid changes, so the panel renders
  // live without the canvas pushing state per pointermove.
  const [beadStats, setBeadStats] = useState<BeadStats | null>(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // Stable: both dialogs read the canvas grid through it, and the export dialog
  // memoizes on it, so an identity change per render would defeat the memo.
  const onGetCellsData = useCallback(() => canvasApiRef.current?.getCellsData() ?? null, [])
  const onGridChange = useCallback(() => {
    setBeadStats(canvasApiRef.current?.getBeadStats() ?? null)
  }, [])
  const onHistoryChange = useCallback((canUndo: boolean, canRedo: boolean) => {
    setCanUndo(canUndo)
    setCanRedo(canRedo)
  }, [])

  // Tool shortcuts (B/E/G) advertised in the toolbar tooltips.
  useToolShortcuts(setActiveTool)

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <EditorToolbar
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        onClearCanvas={() => {
          canvasApiRef.current?.clearCanvas()
        }}
        onImportImage={() => setImportOpen(true)}
        onExportImage={() => setExportOpen(true)}
        showLabels={toggleLabels}
        onToggleLabels={() => setToggleLabels((v) => !v)}
        showBeadStats={showBeadStats}
        onToggleBeadStats={() => setShowBeadStats((v) => !v)}
        showColorPalette={showColorPalette}
        onToggleColorPalette={() => setShowColorPalette((v) => !v)}
        onPublish={() => setPublishOpen(true)}
        zoom={zoom}
        onSetZoom={(z) => canvasApiRef.current?.setZoom(z)}
        onReset={() => canvasApiRef.current?.fitToCanvas()}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => canvasApiRef.current?.undo()}
        onRedo={() => canvasApiRef.current?.redo()}
      />
      <div className="flex-1 min-h-0 flex gap-2">
        {showColorPalette && (
          <EditorColorPalettePanel
            activeColorIndex={activeColorIndex}
            onColorPick={setActiveColorIndex}
          />
        )}
        <PixiCanvas
          className="flex-1 min-w-0 border p-2"
          activeTool={activeTool}
          activeColorIndex={activeColorIndex}
          label={toggleLabels}
          apiRef={canvasApiRef}
          onZoomChange={setZoom}
          onGridChange={onGridChange}
          onHistoryChange={onHistoryChange}
        />
        {showBeadStats && <EditorBeadStatsPanel stats={beadStats} />}
      </div>

      {publishOpen && (
        <PublishDialog
          open={publishOpen}
          onClose={() => setPublishOpen(false)}
          onGetCellsData={onGetCellsData}
        />
      )}

      {importOpen && (
        <ImportDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onApply={(grid) => canvasApiRef.current?.loadGrid(grid)}
        />
      )}

      {exportOpen && (
        <ExportDialog
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          onGetCellsData={onGetCellsData}
        />
      )}
    </div>
  )
}

interface EditorToolbarProps {
  /** Currently active tool. */
  activeTool: ToolKind
  /** Called when the user switches tools. */
  onSelectTool: (tool: ToolKind) => void
  /** Called when the user clicks the clear-canvas button. */
  onClearCanvas: () => void
  /** Called when the user clicks the import-from-image button. */
  onImportImage: () => void
  /** Called when the user clicks the export button (opens the export dialog). */
  onExportImage: () => void
  /** Whether colour codes are shown on the canvas. */
  showLabels: boolean
  /** Called when the user toggles colour-code labels. */
  onToggleLabels: () => void
  /** Whether the bead-usage panel is shown. */
  showBeadStats: boolean
  /** Called when the user toggles the bead-usage panel. */
  onToggleBeadStats: () => void
  /** Whether the colour palette panel is shown. */
  showColorPalette: boolean
  /** Called when the user toggles the colour palette panel. */
  onToggleColorPalette: () => void
  /** Called when the user clicks the publish button. */
  onPublish: () => void
  /** Current zoom factor (screen pixels per world unit). */
  zoom: number
  /**
   * Set or adjust the zoom level.
   * Accepts an absolute value or an updater function `(prev: number) => number`.
   */
  onSetZoom: (z: number | ((prev: number) => number)) => void
  /** Reset zoom to default and centre the view. */
  onReset: () => void
  /** Whether the user can undo/redo the last canvas edit. */
  canUndo: boolean
  /** Whether the user can redo a previously undone canvas edit. */
  canRedo: boolean
  /** Called when the user clicks the undo button. */
  onUndo: () => void
  /** Called when the user clicks the redo button. */
  onRedo: () => void
}

/** Editor top bar: drawing tools, publish button, and zoom controls. */
function EditorToolbar({
  activeTool,
  onSelectTool,
  onClearCanvas,
  onImportImage,
  onExportImage,
  showLabels,
  onToggleLabels,
  showBeadStats,
  onToggleBeadStats,
  showColorPalette,
  onToggleColorPalette,
  onPublish,
  zoom,
  onSetZoom,
  onReset,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: EditorToolbarProps) {
  const { t } = useI18n()
  const [clearOpen, setClearOpen] = useState(false)

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
              onClick={onUndo}
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
              onClick={onRedo}
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
                  onClick={() => onSelectTool(value)}
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
              onClick={onToggleLabels}
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
              onClick={onToggleColorPalette}
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
              onClick={onToggleBeadStats}
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
                    onClearCanvas()
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
              <Button size="sm" variant="outline" onClick={onImportImage}>
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
              <Button size="sm" variant="outline" onClick={onExportImage}>
                <Download data-icon="inline-start" />
                {t("editor.export")}
              </Button>
            }
          />
          <TooltipContent side="bottom">{t("editor.exportAsPng")}</TooltipContent>
        </Tooltip>
        <Button size="sm" onClick={onPublish}>
          {t("editor.publish")}
        </Button>
        <ZoomControls zoom={zoom} onSetZoom={onSetZoom} onReset={onReset} />
      </div>
    </div>
  )
}

/** Left sidebar: the colour palette with brand switcher. */
function EditorColorPalettePanel({
  activeColorIndex,
  onColorPick,
}: {
  activeColorIndex: number
  onColorPick: (index: number) => void
}) {
  return (
    <div className="w-56 shrink-0 overflow-hidden">
      <ColorPalette activeColorIndex={activeColorIndex} onColorPick={onColorPick} />
    </div>
  )
}

/** Right sidebar: live bead-usage counts. */
function EditorBeadStatsPanel({ stats }: { stats: BeadStats | null }) {
  return (
    <div className="w-56 shrink-0 overflow-hidden">
      <BeadStatsPanel stats={stats} />
    </div>
  )
}

/** Skeleton shown while the palette loads. */
function EditorLoading() {
  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <div className="flex items-center justify-between gap-2 border px-3 py-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-28" />
        </div>
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="flex min-h-0 flex-1 gap-2">
        <Skeleton className="w-56 shrink-0" />
        <Skeleton className="min-h-0 flex-1" />
        <Skeleton className="w-56 shrink-0" />
      </div>
    </div>
  )
}
