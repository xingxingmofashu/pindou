"use client"

import { useRef, useState, useCallback } from "react"
import { PixiCanvas, type PixiCanvasApi } from "@/components/pixi-canvas"
import { ToolBar, type ToolKind } from "@/components/editor/toolbar"
import { ColorPalette } from "@/components/editor/color-palette"
import { PublishDialog } from "@/components/editor/publish-dialog"

const DEFAULT_ZOOM = 3

export default function EditorPage() {
  const canvasApiRef = useRef<PixiCanvasApi>(null)
  const [activeTool, setActiveTool] = useState<ToolKind>("pen")
  const [activeColorIndex, setActiveColorIndex] = useState(1)
  const [showLabels, setShowLabels] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)

  const handleSetZoom = useCallback(
    (z: number | ((prev: number) => number)) => {
      canvasApiRef.current?.setZoom(z)
    },
    [],
  )

  const handleColorPick = useCallback((index: number) => {
    setActiveColorIndex(index)
    setActiveTool("pen")
  }, [])

  return (
    <div className="flex h-full flex-col p-2 gap-2 overflow-hidden">
      <ToolBar
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        onClearCanvas={() => canvasApiRef.current?.clearCanvas()}
        showLabels={showLabels}
        onToggleLabels={() => setShowLabels((v) => !v)}
        onPublish={() => setPublishOpen(true)}
        zoom={zoom}
        onSetZoom={handleSetZoom}
        onFit={() => canvasApiRef.current?.fitToCanvas()}
      />
      <div className="flex-1 min-h-0 flex gap-2">
        <div className="w-56 shrink-0 overflow-hidden">
          <ColorPalette
            activeColorIndex={activeColorIndex}
            onSelectColor={setActiveColorIndex}
          />
        </div>
        <PixiCanvas
          className="flex-1 min-w-0 border p-2"
          activeTool={activeTool}
          activeColorIndex={activeColorIndex}
          onColorPick={handleColorPick}
          showLabels={showLabels}
          apiRef={canvasApiRef}
          onZoomChange={setZoom}
        />
      </div>

      <PublishDialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        getCellsData={() => canvasApiRef.current?.getCellsData() ?? null}
      />
    </div>
  )
}
