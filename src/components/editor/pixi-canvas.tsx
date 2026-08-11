"use client"

import { useEffect, useRef, useImperativeHandle, type RefObject } from "react"
import { usePixiApp } from "@/hooks/use-pixi-app"
import { usePixiCanvas } from "@/hooks/use-pixi-canvas"
import { usePalette } from "@/hooks/use-palette"
import type { ToolKind, BeadStats } from "@/lib/editor"
import type { Palette } from "@/types"

export interface PixiCanvasApi {
  setZoom: (z: number | ((prev: number) => number)) => void
  onReset: () => void
  onClear: () => void
  undo: () => void
  redo: () => void
  getCellsData: () => {
    grid: string[][]; brandCode: string; beadStats: string
  } | null
  /** Live per-colour bead counts + painted dims (null when the grid is empty). */
  getBeadStats: () => BeadStats | null
  /** Replace the canvas contents with a serialized code grid. */
  loadGrid: (grid: string[][]) => void
}

export interface PixiCanvasProps {
  activeTool?: ToolKind
  activeColorIndex?: number
  label?: boolean
  readonly?: boolean
  palette?: Palette
  /** Serialized code grid (`grid[row][col]`, "" = empty) to render. */
  grid?: string[][]
  apiRef?: RefObject<PixiCanvasApi | null>
  onZoomChange?: (zoom: number) => void
  /** Fired whenever the painted cells change (stroke end, fill, clear, load). */
  onGridChange?: () => void
  /** Fired with the current undo/redo availability whenever history changes. */
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void
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
  onGridChange,
  onHistoryChange,
}: InnerProps) {
  const ctx = usePixiApp(canvasRef, "#fafafa")
  const { zoom, setZoom, onReset, onClear, undo, redo, getCellsData, getBeadStats, loadGrid, resetModel } =
    usePixiCanvas(ctx, palette, { activeTool, activeColorIndex, showLabels: label, readonly, onGridChange, onHistoryChange })

  useEffect(() => {
    onZoomChange?.(zoom)
  }, [zoom, onZoomChange])

  useEffect(() => {
    if (grid && grid.length > 0 && ctx) loadGrid(grid)
  }, [grid, ctx, loadGrid])

  // Clear the canvas only when the palette code actually changes (brand switch
  // in the editor). On mount the canvas is already empty, so clearing there
  // would wipe a grid loaded by the pinned-grid effect. The detail page pins
  // its palette so this never fires there.
  const prevPaletteCodeRef = useRef(palette.code)
  useEffect(() => {
    if (prevPaletteCodeRef.current === palette.code) return
    prevPaletteCodeRef.current = palette.code
    resetModel(true)
  }, [palette.code, resetModel])

  useImperativeHandle(apiRef, () => ({
    setZoom,
    onReset,
    onClear,
    undo,
    redo,
    getCellsData,
    getBeadStats,
    loadGrid,
  }), [setZoom, onReset, onClear, undo, redo, getCellsData, getBeadStats, loadGrid])

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
      {/* The canvas parent must be padding-free: Pixi sizes itself from its
          parent's clientWidth/clientHeight, which include padding. */}
      <div className="h-full w-full">
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>
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