"use client"

import { useEffect, useRef } from "react"
import { PixiCanvas, type PixiCanvasApi } from "@/components/editor/pixi-canvas"
import { usePatternViewerStore } from "@/hooks/use-pattern-viewer"
import type { Palette } from "@/types"

/**
 * Read-only pattern canvas. Registers its imperative API and reports zoom into
 * the shared {@link usePatternViewerStore} store, so the page can place the
 * zoom controls in the top bar while they drive this canvas.
 */
export function PatternViewer({
  grid,
  palette,
  className,
}: {
  grid: string[][]
  palette: Palette
  className?: string
}) {
  const canvasApiRef = useRef<PixiCanvasApi>(null)
  const setApi = usePatternViewerStore((s) => s.setApi)
  const setZoom = usePatternViewerStore((s) => s.setZoom)

  useEffect(() => {
    setApi(canvasApiRef.current)
    return () => setApi(null)
  }, [setApi])

  return (
    <PixiCanvas
      grid={grid}
      palette={palette}
      readonly
      apiRef={canvasApiRef}
      onZoomChange={setZoom}
      className={className}
    />
  )
}
