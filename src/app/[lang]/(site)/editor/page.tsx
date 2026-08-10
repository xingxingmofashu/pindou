"use client"

import { useCallback, useRef, useState } from "react"
import { PixiCanvas, type PixiCanvasApi } from "@/components/editor/pixi-canvas"
import { ToolBar } from "@/components/editor/toolbar"
import { ColorPalette } from "@/components/editor/color-palette"
import { BeadStatsPanel } from "@/components/editor/bead-stats"
import { PublishDialog } from "@/components/editor/publish-dialog"
import { ImportDialog } from "@/components/editor/import-dialog"
import { ExportDialog } from "@/components/editor/export-dialog"
import type { ToolKind, BeadStats } from "@/lib/editor"

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

  // Stable: both dialogs read the canvas grid through it, and the export dialog
  // memoizes on it, so an identity change per render would defeat the memo.
  const getCellsData = useCallback(() => canvasApiRef.current?.getCellsData() ?? null, [])
  const onGridChange = useCallback(() => {
    setBeadStats(canvasApiRef.current?.getBeadStats() ?? null)
  }, [])

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
        />
        {showBeadStats && (
          <div className="w-56 shrink-0 overflow-hidden">
            <BeadStatsPanel stats={beadStats} />
          </div>
        )}
      </div>

      <PublishDialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        getCellsData={getCellsData}
      />

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onApply={(grid) => canvasApiRef.current?.loadGrid(grid)}
      />

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        getCellsData={getCellsData}
      />
    </div>
  )
}
