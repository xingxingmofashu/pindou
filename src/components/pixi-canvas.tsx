"use client"

import { useEffect, useRef, useState, useImperativeHandle, type RefObject } from "react"
import { Application, useApplication, type ApplicationRef } from "@pixi/react"
import { usePixiScene } from "@/hooks/use-pixi-scene"
import { usePixiCanvas } from "@/hooks/use-pixi-canvas"
import type { ToolKind } from "@/components/editor/tool-bar"
import type { BeadPalette } from "@/types/palette"

export interface PixiCanvasApi extends ApplicationRef {
  zoom: number
  setZoom: (z: number | ((prev: number) => number)) => void
  fitToCanvas: () => void
  clearCanvas: () => void
  getCellsData: () => { grid: number[][]; brandId: string } | null
}

export interface PixiCanvasProps {
  activeTool?: ToolKind
  activeColorIndex?: number
  onColorPick?: (colorIndex: number) => void
  showLabels?: boolean
  readonly?: boolean
  palette?: BeadPalette
  grid?: number[][]
  apiRef?: RefObject<PixiCanvasApi | null>
  onZoomChange?: (zoom: number) => void
  className?: string
}

function PixiCanvasInner({
  activeTool = "pen",
  activeColorIndex = 1,
  onColorPick,
  showLabels = false,
  readonly = false,
  palette,
  grid,
  apiRef,
  onZoomChange,
}: Omit<PixiCanvasProps, "className">) {
  const { app, isInitialised } = useApplication()
  const ctx = usePixiScene(app, isInitialised)

  const appRef = useRef(app)
  appRef.current = app

  useEffect(() => {
    return () => {
      try { appRef.current.destroy(true) } catch {}
    }
  }, [])

  const {
    zoom, setZoom, fitToCanvas, clearCanvas, getCellsData, loadGrid,
  } = usePixiCanvas(ctx, {
    activeTool,
    activeColorIndex,
    onColorPick,
    showLabels,
    readonly,
    palette,
  })

  useEffect(() => {
    onZoomChange?.(zoom)
  }, [zoom, onZoomChange])

  useEffect(() => {
    if (grid && grid.length > 0 && ctx) loadGrid(grid)
  }, [grid, ctx, loadGrid])

  useImperativeHandle(apiRef, () => ({
    getApplication: () => app,
    getCanvas: () => app.canvas as HTMLCanvasElement | null,
    zoom,
    setZoom,
    fitToCanvas,
    clearCanvas,
    getCellsData,
  }), [app, zoom, setZoom, fitToCanvas, clearCanvas, getCellsData])

  return null
}

export function PixiCanvas({ className, ...props }: PixiCanvasProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [resolution] = useState(() =>
    typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
  )

  return (
    <div ref={parentRef} className={className}>
      <Application
        resizeTo={parentRef}
        background="#fafafa"
        antialias
        resolution={resolution}
        autoDensity
      >
        <PixiCanvasInner {...props} />
      </Application>
    </div>
  )
}
