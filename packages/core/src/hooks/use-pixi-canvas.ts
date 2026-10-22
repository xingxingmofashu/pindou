"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import type { Graphics } from "pixi.js"
import {
  CELL,
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_FACTOR,
  EDITOR_BG,
  EDITOR_BG_DARK,
} from "@pindou/shared/constants"
import type { GridRect, ViewRect } from "../grid/viewport"
import type { PixiContext } from "./use-pixi-app"
import { BeadRenderer } from "../grid/bead-renderer"
import { CodeGrid } from "../grid/code-grid"
import { EMPTY, Grid, type BeadStats } from "../grid/grid"
import { GridHistory } from "../grid/grid-history"
import { Viewport } from "../grid/viewport"
import { HexColor, Keyboard } from "../utils"
import type { Palette } from "@pindou/shared/palettes"

/** Fraction of the viewport kept as pan slack around a padded rebuild. */
const PAN_BUFFER = 0.5

/** Max undo snapshots kept in memory (each is a sparse Map copy). */
const UNDO_LIMIT = 50

/** Grid line colour and alpha — theme-dependent (dark grid on light canvas,
 *  light grid on dark canvas). */
const GRID_COLOR_LIGHT = 0x000000
const GRID_COLOR_DARK = 0xffffff
const GRID_ALPHA = 0.12

/** Identifies one of the drawing tools. */
export type ToolKind = "pen" | "eraser" | "fill" | "eyedropper"

/** The canvas snapshot contract shared by the editor, export, and publish. */
export interface CellsData {
  grid: string[][]
  brandCode: string
  beadStats: string
}

/**
 * Imperative canvas API surfaced to parent components (via a ref) by the
 * canvas wrapper. Declared alongside the hook that implements the underlying
 * behaviour so state hooks can import the type without depending on the UI
 * component — the `core → ui` dependency direction stays one-way.
 */
export interface PixiCanvasApi {
  setZoom: (z: number | ((prev: number) => number)) => void
  /** Fit the view to the painted grid's bounding box. */
  fitToCanvas: () => void
  /** Empty the canvas (undoable). */
  clearCanvas: () => void
  undo: () => void
  redo: () => void
  getCellsData: () => CellsData | null
  /** Live per-colour bead counts + painted dims (null when the grid is empty). */
  getBeadStats: () => BeadStats | null
  /** Replace the canvas contents with a serialized code grid. When `seed` is
   *  true (initial load of an existing pattern), the loaded grid becomes the
   *  history baseline instead of an undoable step. */
  loadGrid: (grid: string[][], seed?: boolean) => void
}

interface UsePixiCanvasOptions {
  initialZoom?: number
  activeTool?: ToolKind
  /** 0 = empty, 1..N = 1‑based index into `palette.colors` */
  activeColorIndex?: number
  /** Disable drawing — pan and zoom still work. */
  readonly?: boolean
  /** Fired whenever the painted cells change (stroke end, fill, clear, load). */
  onGridChange?: () => void
  /** Fired with the current undo/redo availability whenever history changes. */
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void
  /** Fired with the picked 1‑based palette index when the eyedropper samples a
   *  non-empty cell. Not fired for empty cells. */
  onColorPick?: (index: number) => void
  /** Fired with the colour under the cursor while the eyedropper is active and
   *  hovering a non-empty cell; `null` when hovering empty space or leaving
   *  the canvas. Only fired when the sampled colour actually changes. */
  onHoverCell?: (cell: { code: string; hex: string } | null) => void
  /** Dark-mode flag for theme-dependent grid/label colours. Injected by the
   *  host app (it owns the theme context) to keep this hook framework-agnostic. */
  isDark?: boolean
}

/** Mutable per-render options mirrored into refs for the event handlers. */
interface RuntimeOpts {
  activeTool: ToolKind
  activeColorIndex: number
  readonly: boolean
  onColorPick: ((index: number) => void) | null
  onHoverCell: ((cell: { code: string; hex: string } | null) => void) | null
}

/** Paint a batch of grid-line rectangles onto a Graphics and fill them. */
function paintGridLines(poly: Graphics, rects: GridRect[], color: number, alpha: number) {
  poly.clear()
  for (const r of rects) poly.rect(r.x, r.y, r.width, r.height)
  poly.fill({ color, alpha })
}

/**
 * Create a ref whose value is built once, on first access.
 *
 * `useRef(new X())` would construct a throwaway instance on every render; the
 * grid and the history own maps, so they are worth deferring.
 *
 * @param create - Factory invoked once, before the first render reads the ref.
 * @returns A stable ref holding the created value.
 */
function useLazyRef<T>(create: () => T): { current: T } {
  const ref = useRef<T | null>(null)
  if (ref.current === null) ref.current = create()
  return ref as { current: T }
}

export function usePixiCanvas(
  pixiCtx: PixiContext | null,
  palette: Palette,
  options: UsePixiCanvasOptions = {}
) {
  const {
    initialZoom = DEFAULT_ZOOM,
    activeTool = "pen",
    activeColorIndex = 1,
    readonly = false,
    onGridChange,
    onHistoryChange,
    onColorPick,
    onHoverCell,
    isDark = false,
  } = options

  const [zoom, setZoomState] = useState(initialZoom)
  const zoomRef = useRef(initialZoom)
  const rafRef = useRef(0)

  const gridColor = isDark ? GRID_COLOR_DARK : GRID_COLOR_LIGHT

  /**
   * The live sparse grid. Its palette binding is part of the grid's identity:
   * a palette change must recreate the grid, which `PixiCanvas` does through
   * `clearCanvas(true)` on a brand switch. `usePalette` drops same-code
   * replacements, so the binding can't go stale without that rebuild.
   */
  const gridRef = useLazyRef(() => new Grid(palette))
  const rectRef = useRef<DOMRect | null>(null)
  /** World position of the last padded rebuild; null when nothing covers a slack region. */
  const builtWorldRef = useRef<{ x: number; y: number } | null>(null)

  /** Undo/redo history: whole-grid snapshots taken before each destructive op. */
  const historyRef = useLazyRef(() => new GridHistory(UNDO_LIMIT))

  const pixiRef = useRef(pixiCtx)
  const runtimeRef = useRef<RuntimeOpts>({ activeTool, activeColorIndex, readonly, onColorPick: null, onHoverCell: null })
  const onGridChangeRef = useRef(onGridChange)
  const onHistoryChangeRef = useRef(onHistoryChange)
  const panRef = useRef({ on: false, startX: 0, startY: 0, startWX: 0, startWY: 0 })
  const drawRef = useRef<{ on: boolean; vc: number; vr: number; before: Grid | null }>({
    on: false, vc: 0, vr: 0, before: null,
  })
  /** Last colour reported via `onHoverCell`, to skip unchanged samples. */
  const lastHoverRef = useRef<string | null>(null)
  /** Palette code the hover throttle was last primed for. */
  const lastHoverPaletteRef = useRef(palette.code)

  const canvas = pixiCtx?.app.canvas as HTMLCanvasElement | undefined

  const viewport = useCallback((): ViewRect | null => {
    const ctx = pixiRef.current
    if (!ctx?.app.screen) return null
    const z = zoomRef.current
    const w = ctx.app.screen.width
    const h = ctx.app.screen.height
    return {
      left: -ctx.world.x / z,
      top: -ctx.world.y / z,
      right: (-ctx.world.x + w) / z,
      bottom: (-ctx.world.y + h) / z,
    }
  }, [])

  const rebuild = useCallback(
    (opts?: { padded?: boolean }) => {
      const ctx = pixiRef.current
      const v = viewport()
      if (!ctx || !v) return

      const z = zoomRef.current

      // A padded build draws beads + grid lines for a slack region around the
      // viewport, so short pans can skip a full redraw (beads and grid lines
      // move with the world as children of `world`). Unpadded builds (zoom,
      // stroke, resize, load) only cover the exact viewport, so they drop the
      // slack and the next pan re-establishes it.
      let buildView = v
      if (opts?.padded) {
        const pw = ctx.app.screen.width * PAN_BUFFER
        const ph = ctx.app.screen.height * PAN_BUFFER
        buildView = {
          left: v.left - pw / z,
          top: v.top - ph / z,
          right: v.right + pw / z,
          bottom: v.bottom + ph / z,
        }
        builtWorldRef.current = { x: ctx.world.x, y: ctx.world.y }
      } else {
        builtWorldRef.current = null
      }

      // Grid lines and beads always render at data-cell resolution (CELL /
      // lodScale 1) so an imported pattern keeps its fixed cell count at any
      // zoom. LOD only controls the paint-brush block size, never the display.
      const { rects } = new Viewport(z).gridLines(buildView, CELL)
      paintGridLines(ctx.gridGfx, rects, gridColor, GRID_ALPHA)

      // The grid owns its palette binding, so index → hex resolution can never
      // disagree with the cells being drawn.
      const entries = BeadRenderer.entries(gridRef.current, buildView, 1, CELL)

      ctx.beadsGfx.clear()
      for (const e of entries) {
        ctx.beadsGfx.rect(e.worldX, e.worldY, e.size, e.size)
        ctx.beadsGfx.fill({ color: HexColor.toInt(e.hex) })
      }
    },
    [viewport, gridColor]
  )

  // Keep the latest pixiCtx, rebuild callback, and the runtime opts behind
  // refs so the long-lived event handlers read fresh values. Synced in a
  // no-deps effect (runs after every commit) — see lint rule react-hooks/refs.
  const rebuildRef = useRef(rebuild)
  useEffect(() => {
    pixiRef.current = pixiCtx
    rebuildRef.current = rebuild
    runtimeRef.current = { activeTool, activeColorIndex, readonly, onColorPick: onColorPick ?? null, onHoverCell: onHoverCell ?? null }
    onGridChangeRef.current = onGridChange
    onHistoryChangeRef.current = onHistoryChange
    // Reset the hover throttle when the eyedropper isn't active (or the palette
    // changes), so switching tools and back re-fires the preview even on the
    // same cell — the component clears its own `hovered` state on tool change,
    // but this ref lives here and would otherwise suppress the re-fire.
    if (activeTool !== "eyedropper" || palette.code !== lastHoverPaletteRef.current) {
      lastHoverPaletteRef.current = palette.code
      lastHoverRef.current = null
    }
  })

  /** Deep-copy the sparse grid so a snapshot survives later mutations. */
  function snapshot(): Grid {
    return gridRef.current.clone()
  }

  const pushHistory = useCallback((before: Grid) => {
    if (runtimeRef.current.readonly) return
    // `push` drops no-op snapshots (same colour on an already-painted cell,
    // empty clear, …) so undo/redo stay meaningful; it reports whether this
    // was a real change, which is exactly when the host must be notified.
    const history = historyRef.current
    if (!history.push(before, gridRef.current)) return
    onHistoryChangeRef.current?.(history.canUndo, history.canRedo)
  }, [])

  const undo = useCallback(() => {
    if (runtimeRef.current.readonly) return
    const prev = historyRef.current.undo(gridRef.current)
    if (!prev) return
    gridRef.current = prev
    rebuildRef.current()
    onGridChangeRef.current?.()
    onHistoryChangeRef.current?.(historyRef.current.canUndo, historyRef.current.canRedo)
  }, [])

  const redo = useCallback(() => {
    if (runtimeRef.current.readonly) return
    const next = historyRef.current.redo(gridRef.current)
    if (!next) return
    gridRef.current = next
    rebuildRef.current()
    onGridChangeRef.current?.()
    onHistoryChangeRef.current?.(historyRef.current.canUndo, historyRef.current.canRedo)
  }, [])

  /** Clear undo/redo history (used on brand switch, where cell indices change meaning). */
  const clearHistory = useCallback(() => {
    historyRef.current.clear()
    onHistoryChangeRef.current?.(false, false)
  }, [])

  /** Centre viewport and rebuild when pixiCtx becomes ready. */
  useEffect(() => {
    const ctx = pixiRef.current
    if (!ctx?.app.screen) return
    ctx.world.scale.set(zoomRef.current)

    const bounds = gridRef.current.bounds()
    if (bounds) {
      const { x, y } = Viewport.center(bounds, ctx.app.screen.width, ctx.app.screen.height, zoomRef.current)
      ctx.world.x = x
      ctx.world.y = y
    }

    rebuildRef.current()
  }, [pixiCtx])

  /** Resize listener. */
  useEffect(() => {
    const ctx = pixiRef.current
    if (!ctx?.app.renderer) return
    const onResize = () => rebuildRef.current()
    const renderer = ctx.app.renderer
    renderer.on("resize", onResize)
    return () => { renderer.off("resize", onResize) }
  }, [pixiCtx])

  /** Keep the Pixi renderer background in sync with the theme. The app is
   *  initialised with the theme-aware background (from `usePixiApp`), so this
   *  only recolours at runtime when the theme changes — never tearing down and
   *  rebuilding the WebGL context on toggle. Depends on `pixiCtx` too: on
   *  first load the theme resolves (and `isDark` settles) before the async
   *  WebGL init completes, so the assignment must run again once the renderer
   *  actually exists. */
  useEffect(() => {
    const ctx = pixiRef.current
    if (!ctx?.app.renderer) return
    ctx.app.renderer.background.color = isDark ? EDITOR_BG_DARK : EDITOR_BG
  }, [isDark, pixiCtx])

  /** Rebuild whenever the rebuild callback changes (covers zoom/palette/theme). */
  useEffect(() => {
    rebuildRef.current()
  }, [rebuild])

  const syncZoom = useCallback(() => {
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0
        setZoomState(zoomRef.current)
      })
    }
  }, [])

  const setZoom = useCallback(
    (z: number | ((prev: number) => number)) => {
      const resolved = typeof z === "function" ? z(zoomRef.current) : z
      const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, resolved))
      if (clamped === zoomRef.current) return
      zoomRef.current = clamped
      const ctx = pixiRef.current
      if (ctx) ctx.world.scale.set(clamped)
      rebuildRef.current()
      syncZoom()
    },
    [syncZoom]
  )

  /** Coordinate transforms between screen and world space. */

  const toWorld = useCallback(
    (clientX: number, clientY: number, rect?: DOMRect | null) => {
      const ctx = pixiRef.current
      const cvs = canvas
      if (!cvs || !ctx) return null
      const r = rect ?? cvs.getBoundingClientRect()
      const z = zoomRef.current
      return { wx: (clientX - r.left - ctx.world.x) / z, wy: (clientY - r.top - ctx.world.y) / z }
    },
    [canvas]
  )

  /** Convert screen coords to the visual cell + its data-cell block. */
  const toPaintTarget = useCallback(
    (clientX: number, clientY: number, rect?: DOMRect | null) => {
      const w = toWorld(clientX, clientY, rect)
      if (!w) return null
      const { scale, size } = new Viewport(zoomRef.current).lod()
      const vc = Math.floor(w.wx / size)
      const vr = Math.floor(w.wy / size)
      return { scale, size, vc, vr, c0: vc * scale, r0: vr * scale, c1: (vc + 1) * scale, r1: (vr + 1) * scale }
    },
    [toWorld]
  )

  /** Cursor-centred wheel zoom. */
  useEffect(() => {
    const cvs = canvas
    if (!cvs) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const ctx = pixiRef.current
      if (!ctx) return

      const r = cvs.getBoundingClientRect()
      const cx = e.clientX - r.left
      const cy = e.clientY - r.top
      const old = zoomRef.current
      const raw = old * (e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR)
      const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, raw))
      const ratio = clamped / old

      ctx.world.x = cx - ratio * (cx - ctx.world.x)
      ctx.world.y = cy - ratio * (cy - ctx.world.y)
      zoomRef.current = clamped
      ctx.world.scale.set(clamped)
      rebuildRef.current()
      syncZoom()
    }

    cvs.addEventListener("wheel", onWheel, { passive: false })
    return () => cvs.removeEventListener("wheel", onWheel)
  }, [canvas, syncZoom])

  /** Undo/redo keyboard shortcuts (Cmd/Ctrl+Z, +Shift+Z, Cmd/Ctrl+Y). Ignored
   *  in readonly views and while typing in a text field. */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod || Keyboard.isTypingTarget(e.target)) return
      // Undoing mid-stroke would swap the grid under the active drag and then
      // push a stale pre-stroke snapshot on release — ignore shortcuts while a
      // stroke is in progress.
      if (drawRef.current.on) return
      if (e.key.toLowerCase() === "z") {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
      } else if (e.key.toLowerCase() === "y") {
        e.preventDefault()
        redo()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [undo, redo])

  /** Pointer event handling: pan + pen / eraser. */
  useEffect(() => {
    const cvs = canvas
    if (!cvs) return

    const isDraw = (t: ToolKind) => t === "pen" || t === "eraser"
    const isPanButton = (b: number) => b === 1 || b === 2

    const onDown = (e: PointerEvent) => {
      rectRef.current = cvs.getBoundingClientRect()

      if (isPanButton(e.button)) {
        e.preventDefault()
        const ctx = pixiRef.current
        if (!ctx) return
        const p = panRef.current
        p.on = true; p.startX = e.clientX; p.startY = e.clientY
        p.startWX = ctx.world.x; p.startWY = ctx.world.y
        cvs.setPointerCapture(e.pointerId)
        return
      }
      if (e.button !== 0) return

      const rt = runtimeRef.current
      if (rt.readonly) return
      if (rt.activeTool === "fill") {
        e.preventDefault()
        const w = toWorld(e.clientX, e.clientY, rectRef.current)
        if (!w) return
        const before = snapshot()
        gridRef.current.floodFill(Math.floor(w.wx / CELL), Math.floor(w.wy / CELL), rt.activeColorIndex)
        pushHistory(before)
        rebuildRef.current()
        onGridChangeRef.current?.()
        return
      }
      if (rt.activeTool === "eyedropper") {
        // Sample the dominant colour across the visual-cell block under the
        // cursor (the same block a pen press would paint), so zoomed-out picks
        // match what the brush actually lays down. Empty cells are ignored.
        e.preventDefault()
        const t = toPaintTarget(e.clientX, e.clientY, rectRef.current)
        if (!t) return
        const best = gridRef.current.dominant(t.c0, t.r0, t.c1, t.r1)
        if (best !== undefined) rt.onColorPick?.(best)
        return
      }
      if (!isDraw(rt.activeTool)) return

      e.preventDefault()
      const t = toPaintTarget(e.clientX, e.clientY, rectRef.current)
      if (!t) return
      // Capture the pre-stroke state; it becomes an undo entry at stroke end.
      drawRef.current = { on: true, vc: t.vc, vr: t.vr, before: snapshot() }
      gridRef.current.paintBlock(t.c0, t.r0, t.c1, t.r1, rt.activeTool === "eraser" ? EMPTY : rt.activeColorIndex)
      rebuildRef.current()
      cvs.setPointerCapture(e.pointerId)
    }

    const onMove = (e: PointerEvent) => {
      const p = panRef.current
      if (p.on) {
        const ctx = pixiRef.current
        if (!ctx) return
        ctx.world.x = p.startWX + e.clientX - p.startX
        ctx.world.y = p.startWY + e.clientY - p.startY
        // Beads and grid lines move with the world, so a pan only needs a
        // redraw once it leaves the slack region covered by the last padded
        // rebuild (see `rebuild`).
        const built = builtWorldRef.current
        if (
          !built ||
          Math.abs(ctx.world.x - built.x) >= ctx.app.screen.width * PAN_BUFFER ||
          Math.abs(ctx.world.y - built.y) >= ctx.app.screen.height * PAN_BUFFER
        ) {
          rebuildRef.current({ padded: true })
        }
        return
      }

      const d = drawRef.current

      // Eyedropper hover preview: report the dominant colour under the cursor
      // (only when not mid-stroke). Throttled to colour changes so we don't
      // fire a React re-render on every pointermove.
      if (!d.on && runtimeRef.current.activeTool === "eyedropper") {
        const t = toPaintTarget(e.clientX, e.clientY, rectRef.current)
        if (!t) return
        const idx = gridRef.current.dominant(t.c0, t.r0, t.c1, t.r1)
        if (idx === undefined) {
          if (lastHoverRef.current !== null) {
            lastHoverRef.current = null
            runtimeRef.current.onHoverCell?.(null)
          }
          return
        }
        const color = palette.colors[idx - 1]
        if (!color) return
        if (lastHoverRef.current !== color.code) {
          lastHoverRef.current = color.code
          runtimeRef.current.onHoverCell?.({ code: color.code, hex: color.hex })
        }
        return
      }
      if (!d.on) return

      const t = toPaintTarget(e.clientX, e.clientY, rectRef.current)
      if (!t) return

      const colorIdx = runtimeRef.current.activeTool === "eraser" ? EMPTY : runtimeRef.current.activeColorIndex
      gridRef.current.paintLine(d.vc, d.vr, t.vc, t.vr, colorIdx, t.scale)

      d.vc = t.vc
      d.vr = t.vr
      rebuildRef.current()
    }

    /** Reset both interactions on release/cancel/leave. pointercancel and
     *  pointerleave fire with button === -1 (no button state), so we reset
     *  unconditionally rather than matching a specific button. */
    const onUp = () => {
      const d = drawRef.current
      panRef.current.on = false
      drawRef.current = { on: false, vc: 0, vr: 0, before: null }
      rectRef.current = null
      if (d.on) {
        if (d.before) pushHistory(d.before)
        onGridChangeRef.current?.()
      }
      // Hide the eyedropper hover preview when the pointer leaves the canvas.
      if (lastHoverRef.current !== null) {
        lastHoverRef.current = null
        runtimeRef.current.onHoverCell?.(null)
      }
    }

    const onContextMenu = (e: Event) => e.preventDefault()

    const events = [
      ["pointerdown", onDown],
      ["pointermove", onMove],
      ["pointerup", onUp],
      ["pointercancel", onUp],
      ["pointerleave", onUp],
      ["contextmenu", onContextMenu],
    ] as const
    for (const [ev, fn] of events) cvs.addEventListener(ev, fn)
    return () => {
      for (const [ev, fn] of events) cvs.removeEventListener(ev, fn)
    }
  }, [canvas, toWorld, toPaintTarget, pushHistory, palette.colors])

  /** Clear the canvas and redraw. With `clearHistoryFlag` (brand switch) the
   *  undo/redo stacks are wiped too — cell indices change meaning across
   *  palettes, so old snapshots would render wrong colours. */
  const clearCanvas = useCallback((clearHistoryFlag = false) => {
    const before = snapshot()
    if (clearHistoryFlag) {
      clearHistory()
    }
    gridRef.current = new Grid(palette)
    // Push *after* the swap so `equals` sees old vs new and records the clear
    // as an undoable step.
    if (!clearHistoryFlag) pushHistory(before)
    rebuildRef.current()
    onGridChangeRef.current?.()
  }, [clearHistory, pushHistory, palette])

  const fitToCanvas = useCallback(() => {
    const ctx = pixiRef.current
    if (!ctx?.app.screen) return
    const bounds = gridRef.current.bounds()
    if (!bounds) {
      ctx.world.x = ctx.app.screen.width / 2
      ctx.world.y = ctx.app.screen.height / 2
      return
    }
    const { ww, wh } = Viewport.boundsSize(bounds)
    const z = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, Math.min(ctx.app.screen.width / ww, ctx.app.screen.height / wh)),
    )
    zoomRef.current = z
    ctx.world.scale.set(z)
    const { x, y } = Viewport.center(bounds, ctx.app.screen.width, ctx.app.screen.height, z)
    ctx.world.x = x
    ctx.world.y = y
    rebuildRef.current()
    syncZoom()
  }, [syncZoom])

  const getCellsData = useCallback((): CellsData | null => {
    const codeGrid = gridRef.current.toCodeGrid()
    if (!codeGrid) return null
    return {
      grid: codeGrid.codes,
      // Read the code from the grid's own palette: `grid` and `brandCode` must
      // be resolved against the same colour order.
      brandCode: gridRef.current.palette.code,
      beadStats: codeGrid.beadStatsJson(),
    }
  }, [])

  const loadGrid = useCallback((grid: string[][], seed = false) => {
    const before = snapshot()
    const codeGrid = CodeGrid.from(grid)
    gridRef.current = codeGrid ? Grid.fromCodeGrid(codeGrid, palette) : new Grid(palette)
    if (seed) {
      // Initial load (edit page): the loaded grid is the baseline, not an undo
      // step — otherwise `canUndo` would be true on a pristine page and the
      // first undo would wipe the whole pattern back to a blank canvas.
      clearHistory()
    } else {
      // Push *after* the swap so `equals` sees old vs new and records the
      // load as an undoable step (undo returns to the previous canvas).
      pushHistory(before)
    }

    // Fit the loaded grid to the viewport instead of forcing a fixed zoom, so
    // detail/edit/import all open with the whole pattern visible.
    fitToCanvas()

    rebuildRef.current()
    onGridChangeRef.current?.()
  }, [fitToCanvas, palette, pushHistory, clearHistory])

  /** Live bead-usage stats computed straight from the sparse model — no dense
   *  grid allocation (cheap enough to call after every stroke). */
  const getBeadStats = useCallback(
    () => gridRef.current.stats(),
    [],
  )

  return {
    zoom,
    setZoom,
    fitToCanvas,
    clearCanvas,
    undo,
    redo,
    getCellsData,
    getBeadStats,
    loadGrid,
  }
}