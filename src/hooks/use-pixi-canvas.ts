"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Text, type Graphics } from "pixi.js"
import {
  EMPTY,
  CELL,
  paintBlock,
  floodFill,
  serializeGrid,
  deserializeGrid,
  computeBeadStats,
  countBeadStats,
  walkLine,
  lodParams,
  computeGridLines,
  buildBeadEntries,
  getGridBounds,
  centerViewport,
  type ToolKind,
  type ViewRect,
  type BeadEntry,
  type PixiContext,
  type GridRect,
} from "@/lib/editor"
import { hexToRgb } from "@/lib/utils"
import type { Palette } from "@/types"

const MIN_ZOOM = 0.5
const MAX_ZOOM = 20
const ZOOM_FACTOR = 1.15
const DEFAULT_ZOOM = 3

/** Fraction of the viewport kept as pan slack around a padded rebuild. */
const PAN_BUFFER = 0.5

/** Grid line colour and alpha — fixed for all views. */
const GRID_COLOR = 0x000000
const GRID_ALPHA = 0.12

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
  } = options

  const [zoom, setZoomState] = useState(initialZoom)
  const zoomRef = useRef(initialZoom)
  const rafRef = useRef(0)

  const cellsRef = useRef<Map<string, number>>(new Map())
  const rectRef = useRef<DOMRect | null>(null)
  /** World position of the last padded rebuild; null when nothing covers a slack region. */
  const builtWorldRef = useRef<{ x: number; y: number } | null>(null)

  const pixiRef = useRef(pixiCtx)
  const runtimeRef = useRef<RuntimeOpts>({ activeTool, activeColorIndex, readonly })
  const onGridChangeRef = useRef(onGridChange)
  const panRef = useRef({ on: false, startX: 0, startY: 0, startWX: 0, startWY: 0 })
  const drawRef = useRef<{ on: boolean; vc: number; vr: number }>({ on: false, vc: 0, vr: 0 })

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
      paintGridLines(ctx.gridGfx, rects, GRID_COLOR, GRID_ALPHA)

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
              fill: "#111",
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
    [viewport, palette, showLabels]
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
  })

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
        floodFill(cellsRef.current, Math.floor(w.wx / CELL), Math.floor(w.wy / CELL), rt.activeColorIndex)
        rebuildRef.current()
        onGridChangeRef.current?.()
        return
      }
      if (!isDraw(rt.activeTool)) return

      e.preventDefault()
      const t = toPaintTarget(e.clientX, e.clientY, rectRef.current)
      if (!t) return
      paintBlock(cellsRef.current, t.c0, t.r0, t.c1, t.r1, rt.activeTool === "eraser" ? EMPTY : rt.activeColorIndex)
      drawRef.current = { on: true, vc: t.vc, vr: t.vr }
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
      const wasDrawing = drawRef.current.on
      panRef.current.on = false
      drawRef.current = { on: false, vc: 0, vr: 0 }
      rectRef.current = null
      if (wasDrawing) onGridChangeRef.current?.()
    }

    const onContextMenu = (e: Event) => e.preventDefault()

    for (const [ev, fn] of [["pointerdown", onDown], ["pointermove", onMove], ["pointerup", onUp], ["pointercancel", onUp], ["pointerleave", onUp], ["contextmenu", onContextMenu]] as const) {
      cvs.addEventListener(ev, fn)
    }

    return () => {
      cvs.removeEventListener("pointerdown", onDown)
      cvs.removeEventListener("pointermove", onMove)
      cvs.removeEventListener("pointerup", onUp)
      cvs.removeEventListener("pointercancel", onUp)
      cvs.removeEventListener("pointerleave", onUp)
      cvs.removeEventListener("contextmenu", onContextMenu)
    }
  }, [canvas, toWorld, toPaintTarget])

  /** Reset the sparse model and redraw (used by clear + brand switch). */
  const resetModel = useCallback(() => {
    cellsRef.current = new Map()
    rebuildRef.current()
    onGridChangeRef.current?.()
  }, [])

  const fitToCanvas = useCallback(() => {
    const ctx = pixiRef.current
    if (!ctx?.app.screen) return
    ctx.world.x = ctx.app.screen.width / 2
    ctx.world.y = ctx.app.screen.height / 2
    setZoom(initialZoom)
  }, [setZoom, initialZoom])

  const clearCanvas = useCallback(() => {
    resetModel()
  }, [resetModel])

  const getCellsData = useCallback((): {
    grid: string[][]; brandCode: string; brandId: string; beadStats: string
  } | null => {
    const grid = serializeGrid(cellsRef.current, palette)
    if (!grid) return null
    return {
      grid,
      brandCode: palette.code,
      brandId: palette.id,
      beadStats: computeBeadStats(grid),
    }
  }, [palette])

  const loadGrid = useCallback((grid: string[][]) => {
    cellsRef.current = deserializeGrid(grid, palette)

    const ctx = pixiRef.current
    if (ctx?.app.screen) {
      zoomRef.current = initialZoom
      ctx.world.scale.set(initialZoom)
      const bounds = getGridBounds(cellsRef.current)
      if (bounds) {
        centerViewport(ctx.world, bounds, ctx.app.screen.width, ctx.app.screen.height, initialZoom)
      } else {
        ctx.world.x = ctx.app.screen.width / 2
        ctx.world.y = ctx.app.screen.height / 2
      }
      syncZoom()
    }

    rebuildRef.current()
    onGridChangeRef.current?.()
  }, [initialZoom, syncZoom, palette])

  /** Live bead-usage stats computed straight from the sparse model — no dense
   *  grid allocation (cheap enough to call after every stroke). */
  const getBeadStats = useCallback(
    () => countBeadStats(cellsRef.current, palette),
    [palette],
  )

  return { zoom, setZoom, onReset: fitToCanvas, onClear: clearCanvas, getCellsData, getBeadStats, loadGrid, resetModel }
}