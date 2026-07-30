"use client"

import { useRef, useState, useCallback } from "react"
import { usePixiCanvas } from "@/hooks/use-pixi-canvas"
import { ToolBar, type ToolKind } from "@/components/tool-bar"
import { ZoomControls } from "@/components/zoom-controls"
import { ColorPalette } from "@/components/color-palette"

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

  /**
   * Called by the eyedropper tool after picking a colour from the canvas.
   * Sets the active colour and switches back to the pen tool.
   */
  const handleColorPick = useCallback((index: number) => {
    setActiveColorIndex(index)
    setActiveTool("pen")
  }, [])

  const { zoom, setZoom, fitToCanvas, clearCanvas } = usePixiCanvas(canvasRef, {
    activeTool,
    activeColorIndex,
    onColorPick: handleColorPick,
  })

  return (
    <div className="flex h-full flex-col p-2 gap-2">
        <div className="flex items-center justify-between px-3 py-2 border">
          <ToolBar activeTool={activeTool} onSelectTool={setActiveTool} onClearCanvas={clearCanvas} />
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
    </div>
  )
}
