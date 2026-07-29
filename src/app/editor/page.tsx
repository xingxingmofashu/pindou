"use client"

import { useRef, useState } from "react"
import { usePixiCanvas } from "@/hooks/use-pixi-canvas"
import { ToolBar, type ToolKind } from "@/components/tool-bar"
import { ZoomControls } from "@/components/zoom-controls"
import { TooltipProvider } from "@/components/ui/tooltip"

export default function EditorPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { zoom, setZoom, fitToCanvas } = usePixiCanvas(canvasRef)
  const [activeTool, setActiveTool] = useState<ToolKind>("pen")

  return (
    <TooltipProvider delay={300}>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-3 py-2">
          <ToolBar activeTool={activeTool} onSelectTool={setActiveTool} />
          <ZoomControls zoom={zoom} onSetZoom={setZoom} onFit={fitToCanvas} />
        </div>
        <div className="flex-1 min-h-0">
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>
      </div>
    </TooltipProvider>
  )
}
