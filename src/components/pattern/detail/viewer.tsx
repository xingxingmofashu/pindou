"use client"

import { useRef, useState } from "react"
import { PixiCanvas, type PixiCanvasApi } from "@/components/editor/pixi-canvas"
import { ZoomControls } from "@/components/editor/zoom-controls"
import type { Palette } from "@/types"

const DEFAULT_ZOOM = 3

/** Interactive read-only pattern viewer: canvas + zoom controls. */
export function PatternViewer({ grid, palette }: { grid: string[][]; palette: Palette }) {
  const canvasApiRef = useRef<PixiCanvasApi>(null)
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)

  return (
    <>
      <ZoomControls
        zoom={zoom}
        onSetZoom={(z) => canvasApiRef.current?.setZoom(z)}
        onReset={() => canvasApiRef.current?.onReset()}
      />
      <PixiCanvas
        grid={grid}
        palette={palette}
        readonly
        apiRef={canvasApiRef}
        onZoomChange={setZoom}
        className="flex-1 min-w-0 border"
      />
    </>
  )
}
