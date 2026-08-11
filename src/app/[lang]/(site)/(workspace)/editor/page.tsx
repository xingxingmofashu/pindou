"use client"

import { useCallback, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { PixiCanvas, type PixiCanvasApi } from "@/components/editor/pixi-canvas"
import { ToolBar } from "@/components/editor/toolbar"
import { ColorPalette } from "@/components/editor/color-palette"
import { BeadStatsPanel } from "@/components/editor/bead-stats"
import { useToolShortcuts } from "@/hooks/use-tool-shortcuts"
import type { ToolKind, BeadStats } from "@/lib/editor"

// Dialogs are only opened on demand — load them (and their heavy deps like
// the export PNG canvas + image transform) lazily instead of blocking the
// editor's initial bundle.
const PublishDialog = dynamic(() =>
  import("@/components/editor/publish-dialog").then((m) => m.PublishDialog),
  { ssr: false },
)
const ImportDialog = dynamic(() =>
  import("@/components/editor/import-dialog").then((m) => m.ImportDialog),
  { ssr: false },
)
const ExportDialog = dynamic(() =>
  import("@/components/editor/export-dialog").then((m) => m.ExportDialog),
  { ssr: false },
)

const DEFAULT_ZOOM = 3

export default function EditorPage() {
  const canvasApiRef = useRef<PixiCanvasApi>(null)
  const [activeTool, setActiveTool] = useState<ToolKind>("pen")
  const [activeColorIndex, setActiveColorIndex] = useState(1)
  const [toggleLabels, setToggleLabels] = useState(false)
  const [showBeadStats, setShowBeadStats] = useState(true)
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

  // Tool shortcuts (B/E/G) advertised in the ToolBar tooltips.
  useToolShortcuts(setActiveTool)

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <ToolBar
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        onClearCanvas={() => {
          canvasApiRef.current?.onClear()
        }}
        onImportImage={() => setImportOpen(true)}
        onExportImage={() => setExportOpen(true)}
        showLabels={toggleLabels}
        onToggleLabels={() => setToggleLabels((v) => !v)}
        showBeadStats={showBeadStats}
        onToggleBeadStats={() => setShowBeadStats((v) => !v)}
        onPublish={() => setPublishOpen(true)}
        zoom={zoom}
        onSetZoom={(z) => canvasApiRef.current?.setZoom(z)}
        onReset={() => canvasApiRef.current?.onReset()}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => canvasApiRef.current?.undo()}
        onRedo={() => canvasApiRef.current?.redo()}
      />
      <div className="flex-1 min-h-0 flex gap-2">
        <div className="w-56 shrink-0 overflow-hidden">
          <ColorPalette
            activeColorIndex={activeColorIndex}
            onColorPick={setActiveColorIndex}
          />
        </div>
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
        {showBeadStats && (
          <div className="w-56 shrink-0 overflow-hidden">
            <BeadStatsPanel stats={beadStats} />
          </div>
        )}
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
