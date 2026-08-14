"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Text, type Graphics } from "pixi.js"
import { useTheme } from "next-themes"
import {
  CELL,
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_FACTOR,
  EDITOR_BG,
  EDITOR_BG_DARK,
} from "@/lib/constants"
import {
  EMPTY,
  paintBlock,
  floodFill,
  serializeGrid,
  deserializeGrid,
  serializeBeadStats,
  countBeadStats,
  walkLine,
  lodParams,
  computeGridLines,
  buildBeadEntries,
  getGridBounds,
  boundsWorldSize,
  centerViewport,
  type ToolKind,
  type ViewRect,
  type BeadEntry,
  type CellsData,
  type PixiContext,
  type GridRect,
} from "@/lib/editor"
import { hexToRgb, isTypingTarget } from "@/lib/utils"
import type { Palette } from "@/types"

/** Fraction of the viewport kept as pan slack around a padded rebuild. */
const PAN_BUFFER = 0.5

/** Max undo snapshots kept in memory (each is a sparse Map copy). */
const UNDO_LIMIT = 50

/** Grid line colour and alpha — theme-dependent (dark grid on light canvas,
 *  light grid on dark canvas). */
const GRID_COLOR_LIGHT = 0x000000
const GRID_COLOR_DARK = 0xffffff
const GRID_ALPHA = 0.12

/** Bead label text colour — theme-dependent. */
const LABEL_FILL_LIGHT = "#111"
const LABEL_FILL_DARK = "#f5f5f5"

interface UsePixiCanvasOptions {
  initialZoom?: number
  activeTool?: ToolKind
  /** 0 = empty, 1..N = 1‑based index into `palette.colors` */
  activeColorIndex?: number
  showLabels?: boolean
  /** Disable drawing — pan and zoom still work. */
  readonly?: boolean
  /** Fired whenever the painted cells change (stroke end, fill, clear, load). */
  onGridChange?: () => void
  /** Fired with the current undo/redo availability whenever history changes. */
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void
}

/** Mutable per-render options mirrored into refs for the event handlers. */
interface RuntimeOpts {
  activeTool: ToolKind
  activeColorIndex: number
  readonly: boolean
}

/** Paint a batch of grid-line rectangles onto a Graphics and fill them. */
function paintGridLines(poly: Graphics, rects: GridRect[], color: number, alpha: number) {
  poly.clear()
  for (const r of rects) poly.rect(r.x, r.y, r.width, r.height)
  poly.fill({ color, alpha })
}

/** Whether two sparse grids hold identical cells (same keys + values). */
function mapsEqual(a: Map<string, number>, b: Map<string, number>): boolean {
  if (a.size !== b.size) return false
  for (const [key, value] of a) {
    if (b.get(key) !== value) return false
  }
  return true
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
    showLabels = false,
    readonly = false,
    onGridChange,
    onHistoryChange,
  } = options

  const [zoom, setZoomState] = useState(initialZoom)
  const zoomRef = useRef(initialZoom)
  const rafRef = useRef(0)

  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const gridColor = isDark ? GRID_COLOR_DARK : GRID_COLOR_LIGHT
  const labelFill = isDark ? LABEL_FILL_DARK : LABEL_FILL_LIGHT

  const cellsRef = useRef<Map<string, number>>(new Map())
  const rectRef = useRef<DOMRect | null>(null)
  /** World position of the last padded rebuild; null when nothing covers a slack region. */
  const builtWorldRef = useRef<{ x: number; y: number } | null>(null)

  /** Undo/redo history: sparse-map snapshots taken before each destructive op. */
  const undoStackRef = useRef<Map<string, number>[]>([])
  const redoStackRef = useRef<Map<string, number>[]>([])

  const pixiRef = useRef(pixiCtx)
  const runtimeRef = useRef<RuntimeOpts>({ activeTool, activeColorIndex, readonly })
  const onGridChangeRef = useRef(onGridChange)
  const onHistoryChangeRef = useRef(onHistoryChange)
  const panRef = useRef({ on: false, startX: 0, startY: 0, startWX: 0, startWY: 0 })
  const drawRef = useRef<{ on: boolean; vc: number; vr: number; before: Map<string, number> | null }>({
    on: false, vc: 0, vr: 0, before: null,
  })

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

  /** Place a label child in world-local coords (labels live inside `world`). */
  function placeLabel(e: BeadEntry): { x: number; y: number; fontSize: number } {
    return {
      x: e.worldX + e.size / 2,
      y: e.worldY + e.size / 2,
      // `world` is already scaled by zoom, so don't multiply by it again here —
      // doing so makes the text grow with zoom² and overflow the bead.
      fontSize: Math.round(e.size * 0.35),
    }
  }

  const rebuild = useCallback(
    (opts?: { skipLabels?: boolean; padded?: boolean }) => {
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
      const { rects } = computeGridLines(buildView, CELL, z)
      paintGridLines(ctx.gridGfx, rects, gridColor, GRID_ALPHA)

      const entries = buildBeadEntries(cellsRef.current, buildView, 1, CELL, palette)

      ctx.beadsGfx.clear()
      for (const e of entries) {
        ctx.beadsGfx.rect(e.worldX, e.worldY, e.size, e.size)
        ctx.beadsGfx.fill({ color: hexToRgb(e.hex) })
      }

      // Labels are children of `world`, so they pan with the container and
      // don't need recreating on every pan frame.
      if (opts?.skipLabels) return
      ctx.labels.removeChildren()
      if (showLabels) {
        // `world` scales these labels by `zoom`, so without `resolution` the
        // texture is rasterized at the tiny world-unit font size and upscaled —
        // blurry. resolution = zoom makes texture pixels equal screen pixels.
        const labelResolution = Math.max(1, z)
        for (const e of entries) {
          const pos = placeLabel(e)
          const text = new Text({
            text: e.code,
            style: {
              fontSize: pos.fontSize,
              fill: labelFill,
              fontFamily: "monospace",
              fontWeight: "bold",
            },
            resolution: labelResolution,
            roundPixels: true,
          })
          text.anchor.set(0.5)
          text.x = pos.x
          text.y = pos.y
          ctx.labels.addChild(text)
        }
      }
    },
    [viewport, palette, showLabels, gridColor, labelFill]
  )

  // Keep the latest pixiCtx, rebuild callback, and the runtime opts behind
  // refs so the long-lived event handlers read fresh values. Synced in a
  // no-deps effect (runs after every commit) — see lint rule react-hooks/refs.
  const rebuildRef = useRef(rebuild)
  useEffect(() => {
    pixiRef.current = pixiCtx
    rebuildRef.current = rebuild
    runtimeRef.current = { activeTool, activeColorIndex, readonly }
    onGridChangeRef.current = onGridChange
    onHistoryChangeRef.current = onHistoryChange
  })

  /** Deep-copy the sparse grid so a snapshot survives later mutations. */
  function snapshot(): Map<string, number> {
    return new Map(cellsRef.current)
  }

  const pushHistory = useCallback((before: Map<string, number>) => {
    if (runtimeRef.current.readonly) return
    // No-op ops (same colour on an already-painted cell, empty clear, …) would
    // push a snapshot identical to the current state — drop them so undo/redo
    // stay meaningful.
    if (mapsEqual(before, cellsRef.current)) return
    undoStackRef.current.push(before)
    if (undoStackRef.current.length > UNDO_LIMIT) undoStackRef.current.shift()
    redoStackRef.current = []
    onHistoryChangeRef.current?.(true, false)
  }, [])

  const undo = useCallback(() => {
    if (runtimeRef.current.readonly) return
    const prev = undoStackRef.current.pop()
    if (!prev) return
    redoStackRef.current.push(cellsRef.current)
    cellsRef.current = prev
    rebuildRef.current()
    onGridChangeRef.current?.()
    onHistoryChangeRef.current?.(undoStackRef.current.length > 0, true)
  }, [])

  const redo = useCallback(() => {
    if (runtimeRef.current.readonly) return
    const next = redoStackRef.current.pop()
    if (!next) return
    undoStackRef.current.push(cellsRef.current)
    if (undoStackRef.current.length > UNDO_LIMIT) undoStackRef.current.shift()
    cellsRef.current = next
    rebuildRef.current()
    onGridChangeRef.current?.()
    onHistoryChangeRef.current?.(true, redoStackRef.current.length > 0)
  }, [])

  /** Clear undo/redo history (used on brand switch, where cell indices change meaning). */
  const clearHistory = useCallback(() => {
    undoStackRef.current = []
    redoStackRef.current = []
    onHistoryChangeRef.current?.(false, false)
  }, [])

  /** Centre viewport and rebuild when pixiCtx becomes ready. */
  useEffect(() => {
    const ctx = pixiRef.current
    if (!ctx?.app.screen) return
    ctx.world.scale.set(zoomRef.current)

    const bounds = getGridBounds(cellsRef.current)
    if (bounds) {
      centerViewport(ctx.world, bounds, ctx.app.screen.width, ctx.app.screen.height, zoomRef.current)
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

  /** Rebuild whenever the rebuild callback changes (covers zoom/palette/showLabels). */
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
      const { scale, size } = lodParams(zoomRef.current)
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
      if (!mod || isTypingTarget(e.target)) return
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
        floodFill(cellsRef.current, Math.floor(w.wx / CELL), Math.floor(w.wy / CELL), rt.activeColorIndex)
        pushHistory(before)
        rebuildRef.current()
        onGridChangeRef.current?.()
        return
      }
      if (!isDraw(rt.activeTool)) return

      e.preventDefault()
      const t = toPaintTarget(e.clientX, e.clientY, rectRef.current)
      if (!t) return
      // Capture the pre-stroke state; it becomes an undo entry at stroke end.
      drawRef.current = { on: true, vc: t.vc, vr: t.vr, before: snapshot() }
      paintBlock(cellsRef.current, t.c0, t.r0, t.c1, t.r1, rt.activeTool === "eraser" ? EMPTY : rt.activeColorIndex)
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
          rebuildRef.current({ skipLabels: true, padded: true })
        }
        return
      }

      const d = drawRef.current
      if (!d.on) return

      const t = toPaintTarget(e.clientX, e.clientY, rectRef.current)
      if (!t) return

      const colorIdx = runtimeRef.current.activeTool === "eraser" ? EMPTY : runtimeRef.current.activeColorIndex
      walkLine(d.vc, d.vr, t.vc, t.vr, (bc, br) => {
        paintBlock(cellsRef.current, bc * t.scale, br * t.scale, (bc + 1) * t.scale, (br + 1) * t.scale, colorIdx)
      })

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
  }, [canvas, toWorld, toPaintTarget, pushHistory])

  /** Clear the canvas and redraw. With `clearHistoryFlag` (brand switch) the
   *  undo/redo stacks are wiped too — cell indices change meaning across
   *  palettes, so old snapshots would render wrong colours. */
  const clearCanvas = useCallback((clearHistoryFlag = false) => {
    const before = snapshot()
    if (clearHistoryFlag) {
      clearHistory()
    }
    cellsRef.current = new Map()
    // Push *after* the swap so `mapsEqual` sees old vs new and records the
    // clear as an undoable step.
    if (!clearHistoryFlag) pushHistory(before)
    rebuildRef.current()
    onGridChangeRef.current?.()
  }, [clearHistory, pushHistory])

  const fitToCanvas = useCallback(() => {
    const ctx = pixiRef.current
    if (!ctx?.app.screen) return
    const bounds = getGridBounds(cellsRef.current)
    if (!bounds) {
      ctx.world.x = ctx.app.screen.width / 2
      ctx.world.y = ctx.app.screen.height / 2
      return
    }
    const { ww, wh } = boundsWorldSize(bounds)
    const z = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, Math.min(ctx.app.screen.width / ww, ctx.app.screen.height / wh)),
    )
    zoomRef.current = z
    ctx.world.scale.set(z)
    centerViewport(ctx.world, bounds, ctx.app.screen.width, ctx.app.screen.height, z)
    rebuildRef.current()
    syncZoom()
  }, [syncZoom])

  const getCellsData = useCallback((): CellsData | null => {
    const grid = serializeGrid(cellsRef.current, palette)
    if (!grid) return null
    return {
      grid,
      brandCode: palette.code,
      beadStats: serializeBeadStats(grid),
    }
  }, [palette])

  const loadGrid = useCallback((grid: string[][]) => {
    const before = snapshot()
    cellsRef.current = deserializeGrid(grid, palette)
    // Push *after* the swap so `mapsEqual` sees old vs new and records the
    // load as an undoable step (undo returns to the previous canvas).
    pushHistory(before)

    // Fit the loaded grid to the viewport instead of forcing a fixed zoom, so
    // detail/edit/import all open with the whole pattern visible.
    fitToCanvas()

    rebuildRef.current()
    onGridChangeRef.current?.()
  }, [fitToCanvas, palette, pushHistory])

  /** Live bead-usage stats computed straight from the sparse model — no dense
   *  grid allocation (cheap enough to call after every stroke). */
  const getBeadStats = useCallback(
    () => countBeadStats(cellsRef.current, palette),
    [palette],
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