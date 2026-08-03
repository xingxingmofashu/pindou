"use client"

import { useRef, useState } from "react"
import { PixiCanvas, type PixiCanvasApi } from "@/components/pixi-canvas"
import { ToolBar, type ToolKind } from "@/components/editor/toolbar"
import { ColorPalette } from "@/components/editor/color-palette"
import { PublishDialog } from "@/components/editor/publish-dialog"
import { ImportImageDialog } from "@/components/editor/import-image-dialog"

const DEFAULT_ZOOM = 3

export default function EditorPage() {
  const canvasApiRef = useRef<PixiCanvasApi>(null)
  const [activeTool, setActiveTool] = useState<ToolKind>("pen")
  const [activeColorIndex, setActiveColorIndex] = useState(1)
  const [toggleLabels, setToggleLabels] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)

  return (
    <div className="flex h-full flex-col p-2 gap-2 overflow-hidden">
      <ToolBar
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        onClearCanvas={() => canvasApiRef.current?.onClear()}
        onImportImage={() => setImportOpen(true)}
        showLabels={toggleLabels}
        onToggleLabels={() => setToggleLabels((v) => !v)}
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
          onColorPick={setActiveColorIndex}
          label={toggleLabels}
          apiRef={canvasApiRef}
          onZoomChange={setZoom}
        />
      </div>

      <PublishDialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        getCellsData={() => canvasApiRef.current?.getCellsData() ?? null}
      />

      <ImportImageDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onApply={(grid) => canvasApiRef.current?.loadGrid(grid)}
      />
    </div>
  )
}
