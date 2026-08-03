"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Text } from "pixi.js"
import {
  EMPTY,
  paintBlock,
  serializeGrid,
  deserializeGrid,
  walkLine,
  lodParams,
  computeGridLines,
  buildBeadEntries,
  getGridBounds,
  centerViewport,
  type ViewRect,
  type BeadEntry,
  type PixiContext,
  type GridRect,
} from "@/lib/editor"
import { hexToRgb } from "@/lib/utils"
import type { ToolKind } from "@/components/editor/toolbar"
import type { BeadPalette } from "@/types/palette"

const MIN_ZOOM = 0.5
const MAX_ZOOM = 20
const ZOOM_FACTOR = 1.15
const DEFAULT_ZOOM = 3

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
}

/** Mutable per-render options mirrored into refs for the event handlers. */
interface RuntimeOpts {
  activeTool: ToolKind
  activeColorIndex: number
  readonly: boolean
}

/** Paint a batch of grid-line rectangles onto a Graphics and fill them. */
function paintGridLines(poly: import("pixi.js").Graphics, rects: GridRect[], color: number, alpha: number) {
  poly.clear()
  for (const r of rects) poly.rect(r.x, r.y, r.width, r.height)
  poly.fill({ color, alpha })
}

export function usePixiCanvas(
  pixiCtx: PixiContext | null,
  palette: BeadPalette,
  options: UsePixiCanvasOptions = {}
) {
  const {
    initialZoom = DEFAULT_ZOOM,
    activeTool = "pen",
    activeColorIndex = 1,
    showLabels = false,
    readonly = false,
  } = options

  const [zoom, setZoomState] = useState(initialZoom)
  const zoomRef = useRef(initialZoom)
  const rafRef = useRef(0)

  const cellsRef = useRef<Map<string, number>>(new Map())
  const lastEntriesRef = useRef<BeadEntry[]>([])
  const rectRef = useRef<DOMRect | null>(null)

  const pixiRef = useRef(pixiCtx)
  const runtimeRef = useRef<RuntimeOpts>({ activeTool, activeColorIndex, readonly })
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

  const redrawGrid = useCallback(() => {
    const v = viewport()
    if (!v) return
    const ctx = pixiRef.current
    if (!ctx) return
    const { size } = lodParams(zoomRef.current)
    const { rects } = computeGridLines(v, size, zoomRef.current)
    paintGridLines(ctx.gridGfx, rects, GRID_COLOR, GRID_ALPHA)
  }, [viewport])

  /** Place a label child in world-local coords (labels live inside `world`). */
  function placeLabel(e: BeadEntry): { x: number; y: number; fontSize: number } {
    return {
      x: e.worldX + e.size / 2,
      y: e.worldY + e.size / 2,
      fontSize: Math.max(7, Math.round(e.size * zoomRef.current * 0.35)),
    }
  }

  const rebuild = useCallback(() => {
    const ctx = pixiRef.current
    const v = viewport()
    if (!ctx || !v) return

    const z = zoomRef.current
    const { scale, size } = lodParams(z)

    const { rects } = computeGridLines(v, size, z)
    paintGridLines(ctx.gridGfx, rects, GRID_COLOR, GRID_ALPHA)

    const entries = buildBeadEntries(cellsRef.current, v, scale, size, palette)
    lastEntriesRef.current = entries

    ctx.beadsGfx.clear()
    for (const e of entries) {
      ctx.beadsGfx.rect(e.worldX, e.worldY, e.size, e.size)
      ctx.beadsGfx.fill({ color: hexToRgb(e.hex) })
    }

    ctx.labels.removeChildren()
    if (showLabels) {
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
        })
        text.anchor.set(0.5)
        text.x = pos.x
        text.y = pos.y
        ctx.labels.addChild(text)
      }
    }
  }, [viewport, palette, showLabels])

  // Keep the latest pixiCtx, rebuild/redraw callbacks, and the runtime opts
// behind refs so the long-lived event handlers read fresh values. Synced in a
// no-deps effect (runs after every commit) — see lint rule react-hooks/refs.
const rebuildRef = useRef(rebuild)
  const redrawGridRef = useRef(redrawGrid)
  useEffect(() => {
    pixiRef.current = pixiCtx
    rebuildRef.current = rebuild
    redrawGridRef.current = redrawGrid
    runtimeRef.current = { activeTool, activeColorIndex, readonly }
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
        redrawGridRef.current()
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
      panRef.current.on = false
      drawRef.current = { on: false, vc: 0, vr: 0 }
      rectRef.current = null
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
    grid: number[][]; brandId: string
  } | null => {
    const grid = serializeGrid(cellsRef.current)
    if (!grid) return null
    return { grid, brandId: palette.id }
  }, [palette])

  const loadGrid = useCallback((grid: number[][]) => {
    cellsRef.current = deserializeGrid(grid)

    const bounds = getGridBounds(cellsRef.current)
    if (bounds) {
      const ctx = pixiRef.current
      if (ctx?.app.screen) {
        centerViewport(ctx.world, bounds, ctx.app.screen.width, ctx.app.screen.height, zoomRef.current)
      }
    }

    rebuildRef.current()
  }, [])

  return { zoom, setZoom, fitToCanvas, clearCanvas, getCellsData, loadGrid, resetModel }
}