"use client"

import { useEffect, useRef, useImperativeHandle, useState, type RefObject } from "react"
import { useTheme } from "next-themes"
import { EDITOR_BG, EDITOR_BG_DARK } from "@pindou/shared/constants"
import { usePixiApp } from "@pindou/core/hooks/use-pixi-app"
import { usePixiCanvas } from "@pindou/core/hooks/use-pixi-canvas"
import { usePalette } from "@pindou/core/hooks/use-palette"
import { Tooltip, TooltipTrigger, TooltipContent } from "@pindou/ui/components/ui/tooltip"
import { toast } from "@pindou/ui/components/ui/toast"
import { useI18n } from "@pindou/core/i18n/client.tsx"
import type { PixiCanvasApi, ToolKind } from "@pindou/core/editor"
import type { Palette } from "@pindou/shared/types"


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
  /** Fired with the sampled 1‑based palette index when the eyedropper tool
   *  clicks a non-empty cell (never for empty cells). */
  onColorPick?: (index: number) => void
  className?: string
}

/** Props for the resolved renderer: `PixiCanvasProps` minus presentation-only fields, plus a required canvas ref and resolved palette. */
type InnerProps = Omit<PixiCanvasProps, "className" | "palette"> & {
  canvasRef: RefObject<HTMLCanvasElement | null>
  palette: Palette
  /** Internal: drives the eyedropper hover preview tooltip. */
  onHoverCell?: (cell: { code: string; hex: string } | null) => void
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
  onColorPick,
  onHoverCell,
}: InnerProps) {
  const { resolvedTheme } = useTheme()
  const { t } = useI18n()
  const isDark = resolvedTheme === "dark"
  const ctx = usePixiApp(canvasRef, isDark ? EDITOR_BG_DARK : EDITOR_BG, {
    onError: (kind) => {
      toast.add({
        id: kind === "context-lost" ? "webgl-context-lost" : "webgl-unavailable",
        type: "error",
        title: t("editor.canvasUnavailable"),
        description:
          kind === "context-lost"
            ? t("editor.canvasUnavailableDescription")
            : t("editor.webglUnavailableDescription"),
      })
    },
  })
  const { zoom, setZoom, fitToCanvas, clearCanvas, undo, redo, getCellsData, getBeadStats, loadGrid } =
    usePixiCanvas(ctx, palette, { activeTool, activeColorIndex, showLabels: label, readonly, isDark, onGridChange, onHistoryChange, onColorPick, onHoverCell })

  useEffect(() => {
    onZoomChange?.(zoom)
  }, [zoom, onZoomChange])

  useEffect(() => {
    if (grid && grid.length > 0 && ctx) loadGrid(grid, true)
  }, [grid, ctx, loadGrid])

  // Clear the canvas only when the palette code actually changes (brand switch
  // in the editor). On mount the canvas is already empty, so clearing there
  // would wipe a grid loaded by the pinned-grid effect. The detail page pins
  // its palette so this never fires there.
  const prevPaletteCodeRef = useRef(palette.code)
  useEffect(() => {
    if (prevPaletteCodeRef.current === palette.code) return
    prevPaletteCodeRef.current = palette.code
    clearCanvas(true)
  }, [palette.code, clearCanvas])

  useImperativeHandle(apiRef, () => ({
    setZoom,
    fitToCanvas,
    clearCanvas,
    undo,
    redo,
    getCellsData,
    getBeadStats,
    loadGrid,
  }), [setZoom, fitToCanvas, clearCanvas, undo, redo, getCellsData, getBeadStats, loadGrid])

  return null
}

export function PixiCanvas({ className, palette, readonly, activeTool, ...props }: PixiCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Colour under the cursor while the eyedropper is active, driving the
  // cursor-following hover preview tooltip. Reset when the tool or read-only
  // state changes (adjusted during render — the React-recommended way to reset
  // state from a prop change) so a stale preview doesn't linger.
  const [hovered, setHovered] = useState<{ code: string; hex: string } | null>(null)
  const [prevPreviewKey, setPrevPreviewKey] = useState<string>("")
  const previewKey = `${activeTool ?? ""}:${readonly ? "ro" : "rw"}`
  if (prevPreviewKey !== previewKey) {
    setPrevPreviewKey(previewKey)
    setHovered(null)
  }

  const showHover = !readonly && activeTool === "eyedropper" && hovered !== null

  // When a palette is pinned (read-only detail page, or the pattern editor),
  // render a bare branch that never subscribes to the active-palette store.
  // Otherwise, resolve the store eagerly so the editor re-renders on brand
  // switch. Two sibling subtrees keep the hook count stable per branch (rules
  // of hooks).
  return (
    <div className={className}>
      {/* The canvas parent must be padding-free: Pixi sizes itself from its
          parent's clientWidth/clientHeight, which include padding. */}
      <Tooltip trackCursorAxis="both" open={showHover}>
        <TooltipTrigger render={
          <div className="h-full w-full">
            <canvas ref={canvasRef} className="block h-full w-full" />
          </div>
        } />
        {hovered && (
          <TooltipContent sideOffset={10}>
            <span
              aria-hidden="true"
              className="size-3 rounded-[4px] border border-white/30"
              style={{ backgroundColor: hovered.hex }}
            />
            <span>{hovered.code}</span>
          </TooltipContent>
        )}
      </Tooltip>
      {palette ? (
        <PixiCanvasInner canvasRef={canvasRef} palette={palette} readonly={readonly} activeTool={activeTool} onHoverCell={setHovered} {...props} />
      ) : (
        <EditablePaletteBridge canvasRef={canvasRef} readonly={readonly ?? false} activeTool={activeTool} onHoverCell={setHovered} {...props} />
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
export type { PixiCanvasApi } from "@pindou/core/editor"
