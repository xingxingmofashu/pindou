"use client"

import { useEffect, useRef, useImperativeHandle, type RefObject } from "react"
import { usePixiApp } from "@/hooks/use-pixi-app"
import { usePixiCanvas } from "@/hooks/use-pixi-canvas"
import { useActivePalette } from "@/hooks/use-active-palette"
import type { ToolKind } from "@/components/editor/toolbar"
import type { BeadPalette } from "@/types/palette"

export interface PixiCanvasApi {
  zoom: number
  setZoom: (z: number | ((prev: number) => number)) => void
  onReset: () => void
  onClear: () => void
  getCellsData: () => { grid: number[][]; brandId: string; beadStats: string } | null
}

export interface PixiCanvasProps {
  activeTool?: ToolKind
  activeColorIndex?: number
  /**
   * Dead prop, kept only for type compatibility with the user-controlled
   * EditorPage which still passes it (`onColorPick={handleColorPick}`). Nothing
   * inside PixiCanvas fires it — the eyedropper/fill tools were removed.
   */
  onColorPick?: (colorIndex: number) => void
  label?: boolean
  readonly?: boolean
  palette?: BeadPalette
  grid?: number[][]
  apiRef?: RefObject<PixiCanvasApi | null>
  onZoomChange?: (zoom: number) => void
  className?: string
}

interface InnerProps {
  canvasRef: RefObject<HTMLCanvasElement | null>
  palette: BeadPalette
  activeTool?: ToolKind
  activeColorIndex?: number
  onColorPick?: (colorIndex: number) => void
  label?: boolean
  readonly?: boolean
  grid?: number[][]
  apiRef?: RefObject<PixiCanvasApi | null>
  onZoomChange?: (zoom: number) => void
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
  }, [palette.id, resetModel])

  useImperativeHandle(apiRef, () => ({
    zoom,
    setZoom,
    onReset,
    onClear,
    getCellsData,
  }), [zoom, setZoom, onReset, onClear, getCellsData])

  return null
}

export function PixiCanvas({ className, palette, readonly, ...props }: PixiCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // When a palette is pinned (read-only detail page), render a bare branch
  // that never subscribes to the active-palette store. Otherwise, resolve the
  // store eagerly so the editor re-renders on brand switch. Two sibling
  // subtrees keep the hook count stable per branch (rules of hooks).
  return (
    <div className={className}>
      <canvas ref={canvasRef} className="block h-full w-full" />
      {readonly && palette ? (
        <PixiCanvasInner canvasRef={canvasRef} palette={palette} readonly {...props} />
      ) : (
        <EditablePaletteBridge
          canvasRef={canvasRef}
          pinnedPalette={palette}
          readonly={readonly ?? false}
          {...props}
        />
      )}
    </div>
  )
}

/** For the editor (no pinned palette): subscribe to the active-brand store. */
function EditablePaletteBridge({
  canvasRef,
  pinnedPalette,
  ...props
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>
  pinnedPalette?: BeadPalette
} & Omit<InnerProps, "canvasRef" | "palette">) {
  const { palette: activePalette } = useActivePalette()
  return (
    <PixiCanvasInner canvasRef={canvasRef} palette={pinnedPalette ?? activePalette} {...props} />
  )
}