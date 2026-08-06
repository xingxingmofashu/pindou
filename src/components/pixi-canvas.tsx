"use client"

import { useEffect, useRef, useImperativeHandle, type RefObject } from "react"
import { usePixiApp } from "@/hooks/use-pixi-app"
import { usePixiCanvas } from "@/hooks/use-pixi-canvas"
import { usePalette } from "@/hooks/use-palette"
import type { ToolKind } from "@/lib/editor"
import type { Palette } from "@/types"

export interface PixiCanvasApi {
  zoom: number
  setZoom: (z: number | ((prev: number) => number)) => void
  onReset: () => void
  onClear: () => void
  getCellsData: () => {
    grid: number[][]; brandCode: string; brandId: string; beadStats: string
  } | null
  /** Replace the canvas contents with a serialized grid. */
  loadGrid: (grid: number[][]) => void
}

export interface PixiCanvasProps {
  activeTool?: ToolKind
  activeColorIndex?: number
  label?: boolean
  readonly?: boolean
  palette?: Palette
  grid?: number[][]
  apiRef?: RefObject<PixiCanvasApi | null>
  onZoomChange?: (zoom: number) => void
  className?: string
}

/** Props for the resolved renderer: `PixiCanvasProps` minus presentation-only fields, plus a required canvas ref and resolved palette. */
type InnerProps = Omit<PixiCanvasProps, "className" | "palette"> & {
  canvasRef: RefObject<HTMLCanvasElement | null>
  palette: Palette
}

/**
 * Inner renderer that runs once the canvas element exists. Receives a
 * fully-resolved palette so read-only views stay decoupled from the global
 * active-palette store.
 */
function PixiCanvasInner({
  canvasRef,
  palette,
  activeTool = "pen",
  activeColorIndex = 1,
  label = false,
  readonly = false,
  grid,
  apiRef,
  onZoomChange,
}: InnerProps) {
  const ctx = usePixiApp(canvasRef, "#fafafa")
  const { zoom, setZoom, onReset, onClear, getCellsData, loadGrid, resetModel } =
    usePixiCanvas(ctx, palette, { activeTool, activeColorIndex, showLabels: label, readonly })

  useEffect(() => {
    onZoomChange?.(zoom)
  }, [zoom, onZoomChange])

  useEffect(() => {
    if (grid && grid.length > 0 && ctx) loadGrid(grid)
  }, [grid, ctx, loadGrid])

  // Clear the canvas when the palette identity changes (brand switch in the
  // editor); the detail page pins its palette so this never fires there.
  useEffect(() => {
    resetModel()
  }, [palette.code, resetModel])

  useImperativeHandle(apiRef, () => ({
    zoom,
    setZoom,
    onReset,
    onClear,
    getCellsData,
    loadGrid,
  }), [zoom, setZoom, onReset, onClear, getCellsData, loadGrid])

  return null
}

export function PixiCanvas({ className, palette, readonly, ...props }: PixiCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // When a palette is pinned (read-only detail page, or the pattern editor),
  // render a bare branch that never subscribes to the active-palette store.
  // Otherwise, resolve the store eagerly so the editor re-renders on brand
  // switch. Two sibling subtrees keep the hook count stable per branch (rules
  // of hooks).
  return (
    <div className={className}>
      <canvas ref={canvasRef} className="block h-full w-full" />
      {palette ? (
        <PixiCanvasInner canvasRef={canvasRef} palette={palette} readonly={readonly} {...props} />
      ) : (
        <EditablePaletteBridge canvasRef={canvasRef} readonly={readonly ?? false} {...props} />
      )}
    </div>
  )
}

/** For the editor (no pinned palette): subscribe to the active-brand store. */
function EditablePaletteBridge({
  canvasRef,
  ...props
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>
} & Omit<InnerProps, "canvasRef" | "palette">) {
  const { palette } = usePalette()
  if (!palette) return null
  return <PixiCanvasInner canvasRef={canvasRef} palette={palette} {...props} />
}