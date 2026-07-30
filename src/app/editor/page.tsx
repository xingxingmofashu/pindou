"use client"

import { useRef, useState, useCallback } from "react"
import { usePixiCanvas } from "@/hooks/use-pixi-canvas"
import { ToolBar, type ToolKind } from "@/components/editor/tool-bar"
import { ZoomControls } from "@/components/editor/zoom-controls"
import { ColorPalette } from "@/components/editor/color-palette"
import { PublishDialog } from "@/components/editor/publish-dialog"
import { Button } from "@/components/ui/button"

/**
 * The fuse-bead pattern editor page.
 *
 * Composes the PixiJS canvas (via {@link usePixiCanvas}) with a toolbar,
 * zoom controls, and a colour palette sidebar.
 */
export default function EditorPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [activeTool, setActiveTool] = useState<ToolKind>("pen")
  /** 1‑based palette index (0 = eraser / empty cell). */
  const [activeColorIndex, setActiveColorIndex] = useState(1)
  const [showLabels, setShowLabels] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)

  /**
   * Called by the eyedropper tool after picking a colour from the canvas.
   * Sets the active colour and switches back to the pen tool.
   */
  const handleColorPick = useCallback((index: number) => {
    setActiveColorIndex(index)
    setActiveTool("pen")
  }, [])

  const { zoom, setZoom, fitToCanvas, clearCanvas, getCellsData } = usePixiCanvas(canvasRef, {
    activeTool,
    activeColorIndex,
    onColorPick: handleColorPick,
    showLabels,
  })

  return (
    <div className="flex h-full flex-col p-2 gap-2 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border">
          <div className="flex items-center gap-2">
            <ToolBar
              activeTool={activeTool}
              onSelectTool={setActiveTool}
              onClearCanvas={clearCanvas}
              showLabels={showLabels}
              onToggleLabels={() => setShowLabels((v) => !v)}
            />
            <Button size="sm" variant="outline" onClick={() => setPublishOpen(true)}>
              Publish
            </Button>
          </div>
          <ZoomControls zoom={zoom} onSetZoom={setZoom} onFit={fitToCanvas} />
        </div>
        <div className="flex-1 min-h-0 flex gap-2">
          <div className="w-56 shrink-0 overflow-hidden">
            <ColorPalette
              activeColorIndex={activeColorIndex}
              onSelectColor={setActiveColorIndex}
            />
          </div>
          <div className="flex-1 min-w-0 border">
            <canvas ref={canvasRef} className="w-full h-full p-2" />
          </div>
        </div>

        <PublishDialog
          open={publishOpen}
          onClose={() => setPublishOpen(false)}
          getCellsData={getCellsData}
        />
    </div>
  )
}
