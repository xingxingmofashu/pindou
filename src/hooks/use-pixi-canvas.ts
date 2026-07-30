"use client"

import { useEffect, useRef, useState, useCallback, type RefObject } from "react"
import { Text } from "pixi.js"
import { EMPTY, paintBlock, serializeGrid, walkLine, lodParams, drawGrid, buildBeadEntries, type ViewRect, type BeadEntry, CELL } from "@/lib/editor"
import { usePixiApp } from "@/hooks/use-pixi-app"
import { useActivePalette } from "@/hooks/use-active-palette"
import { hexToRgb } from "@/lib/utils"
import type { ToolKind } from "@/components/editor/tool-bar"
import type { BeadPalette } from "@/types/palette"

const MIN_ZOOM = 0.5
const MAX_ZOOM = 20
const ZOOM_FACTOR = 1.15
const DEFAULT_ZOOM = 3

interface UsePixiCanvasOptions {
  gridColor?: number
  gridAlpha?: number
  backgroundColor?: string
  initialZoom?: number
  activeTool?: ToolKind
  /** 0 = empty, 1..N = 1‑based index into `palette.colors` */
  activeColorIndex?: number
  onColorPick?: (colorIndex: number) => void
  showLabels?: boolean
  /** Override the active palette for read-only views (e.g. detail page). */
  palette?: BeadPalette
  /** Disable drawing — pan and zoom still work. */
  readonly?: boolean
}

export function usePixiCanvas(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  options: UsePixiCanvasOptions = {}
) {
  const {
    gridColor = 0x000000,
    gridAlpha = 0.12,
    backgroundColor = "#fafafa",
    initialZoom = DEFAULT_ZOOM,
    activeTool = "pen",
    activeColorIndex = 1,
    showLabels = false,
    palette: paletteOverride,
    readonly = false,
  } = options

  const { palette: activePalette } = useActivePalette()
  const palette = paletteOverride ?? activePalette

  const pixiCtx = usePixiApp(canvasRef, backgroundColor)

  const [zoom, setZoomState] = useState(initialZoom)
  const zoomRef = useRef(initialZoom)
  const rafRef = useRef(0)

  const cellsRef = useRef<Map<string, number>>(new Map())
  const lastEntriesRef = useRef<BeadEntry[]>([])
  const rectRef = useRef<DOMRect | null>(null)

  const pixiRef = useRef(pixiCtx)
  pixiRef.current = pixiCtx

  const panRef = useRef({ on: false, startX: 0, startY: 0, startWX: 0, startWY: 0 })
  const drawRef = useRef({ on: false, worldX: 0, worldY: 0 })

  /** Helpers that read mutable refs (stable, never re-created). */

  const getPixi = () => pixiCtx

  const viewport = useCallback((): ViewRect | null => {
    const ctx = getPixi()
    if (!ctx) return null
    const z = zoomRef.current
    const w = ctx.app.screen.width
    const h = ctx.app.screen.height
    return {
      left: -ctx.world.x / z,
      top: -ctx.world.y / z,
      right: (-ctx.world.x + w) / z,
      bottom: (-ctx.world.y + h) / z,
    }
  }, [pixiCtx])

  const redrawLabels = useCallback(() => {
    const ctx = getPixi()
    if (!ctx) return
    const z = zoomRef.current
    const entries = lastEntriesRef.current
    const children = ctx.labels.children
    for (let i = 0; i < Math.min(entries.length, children.length); i++) {
      const e = entries[i]
      const t = children[i] as Text
      t.x = ctx.world.x + (e.worldX + e.size / 2) * z
      t.y = ctx.world.y + (e.worldY + e.size / 2) * z
    }
  }, [pixiCtx])

  const redrawGrid = useCallback(() => {
    const v = viewport()
    if (!v) return
    const { size } = lodParams(zoomRef.current)
    drawGrid(getPixi()!.gridGfx, v, size, zoomRef.current, gridColor, gridAlpha)
    redrawLabels()
  }, [gridColor, gridAlpha, viewport, redrawLabels])

  const rebuild = useCallback(() => {
    const ctx = getPixi()
    const v = viewport()
    if (!ctx || !v) return

    const z = zoomRef.current
    const { scale, size } = lodParams(z)

    drawGrid(ctx.gridGfx, v, size, z, gridColor, gridAlpha)

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
        const text = new Text({
          text: e.code,
          style: {
            fontSize: Math.max(7, Math.round(e.size * z * 0.35)),
            fill: "#111",
            fontFamily: "monospace",
            fontWeight: "bold",
          },
        })
        text.anchor.set(0.5)
        text.x = ctx.world.x + (e.worldX + e.size / 2) * z
        text.y = ctx.world.y + (e.worldY + e.size / 2) * z
        ctx.labels.addChild(text)
      }
    }
  }, [gridColor, gridAlpha, viewport, palette, showLabels])

  /** Keep refs current during render. */
  const rebuildRef = useRef(rebuild)
  const redrawGridRef = useRef(redrawGrid)
  rebuildRef.current = rebuild
  redrawGridRef.current = redrawGrid

  const toolRef = useRef(activeTool)
  const colorRef = useRef(activeColorIndex)
  const readonlyRef = useRef(readonly)
  toolRef.current = activeTool
  colorRef.current = activeColorIndex
  readonlyRef.current = readonly

  /** Sync pixiCtx to rebuild when it becomes ready. */
  useEffect(() => {
    if (pixiCtx) {
      pixiCtx.world.scale.set(zoomRef.current)
      rebuildRef.current()
    }
  }, [pixiCtx])

  /** Resize listener. */
  useEffect(() => {
    if (!pixiCtx) return
    const onResize = () => rebuildRef.current()
    const renderer = pixiCtx.app.renderer
    renderer.on("resize", onResize)
    return () => { renderer.off("resize", onResize) }
  }, [pixiCtx])

  /** Rebuild after showLabels toggles. */
  useEffect(() => {
    rebuildRef.current()
  }, [showLabels])

  /** Zoom state management. */

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
      const ctx = getPixi()
      if (ctx) ctx.world.scale.set(clamped)
      rebuildRef.current()
      syncZoom()
    },
    [syncZoom]
  )

  /** Coordinate transforms between screen and world space. */

  const toWorld = useCallback(
    (clientX: number, clientY: number, rect?: DOMRect | null) => {
      const canvas = canvasRef.current
      const ctx = getPixi()
      if (!canvas || !ctx) return null
      const r = rect ?? canvas.getBoundingClientRect()
      const z = zoomRef.current
      return { wx: (clientX - r.left - ctx.world.x) / z, wy: (clientY - r.top - ctx.world.y) / z }
    },
    [canvasRef, pixiCtx]
  )

  const toPaintTarget = useCallback(
    (clientX: number, clientY: number) => {
      const w = toWorld(clientX, clientY)
      if (!w) return null
      const { scale, size } = lodParams(zoomRef.current)
      const vc = Math.floor(w.wx / size)
      const vr = Math.floor(w.wy / size)
      return { c0: vc * scale, r0: vr * scale, c1: (vc + 1) * scale, r1: (vr + 1) * scale, vc, vr }
    },
    [toWorld]
  )

  /** Cursor-centred wheel zoom. */

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const ctx = getPixi()
      if (!ctx) return

      const r = canvas.getBoundingClientRect()
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

    canvas.addEventListener("wheel", onWheel, { passive: false })
    return () => canvas.removeEventListener("wheel", onWheel)
  }, [canvasRef, syncZoom, pixiCtx])

  /** Pointer event handling: pan + pen / eraser. */

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const isDraw = (t: ToolKind) => t === "pen" || t === "eraser"

    const isPanButton = (b: number) => b === 1 || b === 2

    const onDown = (e: PointerEvent) => {
      rectRef.current = canvas.getBoundingClientRect()

      if (isPanButton(e.button)) {
        e.preventDefault()
        const ctx = getPixi()
        if (!ctx) return
        const p = panRef.current
        p.on = true; p.startX = e.clientX; p.startY = e.clientY
        p.startWX = ctx.world.x; p.startWY = ctx.world.y
        canvas.setPointerCapture(e.pointerId)
        return
      }
      if (e.button !== 0) return

      if (readonlyRef.current) return

      const tool = toolRef.current
      if (!isDraw(tool)) return

      e.preventDefault()
      const t = toPaintTarget(e.clientX, e.clientY)
      if (!t) return
      paintBlock(cellsRef.current, t.c0, t.r0, t.c1, t.r1, tool === "eraser" ? EMPTY : colorRef.current)
      const w = toWorld(e.clientX, e.clientY, rectRef.current)
      if (w) drawRef.current = { on: true, worldX: w.wx, worldY: w.wy }
      rebuildRef.current()
      canvas.setPointerCapture(e.pointerId)
    }

    const onMove = (e: PointerEvent) => {
      const p = panRef.current
      if (p.on) {
        const ctx = getPixi()
        if (!ctx) return
        ctx.world.x = p.startWX + e.clientX - p.startX
        ctx.world.y = p.startWY + e.clientY - p.startY
        redrawGridRef.current()
        return
      }

      const d = drawRef.current
      if (!d.on) return

      const { scale: ls, size: vs } = lodParams(zoomRef.current)
      const w = toWorld(e.clientX, e.clientY, rectRef.current)
      if (!w) return

      const vc = Math.floor(w.wx / vs)
      const vr = Math.floor(w.wy / vs)
      const lastVC = Math.floor(d.worldX / vs)
      const lastVR = Math.floor(d.worldY / vs)
      const colorIdx = toolRef.current === "eraser" ? EMPTY : colorRef.current

      walkLine(lastVC, lastVR, vc, vr, (bc, br) => {
        paintBlock(cellsRef.current, bc * ls, br * ls, (bc + 1) * ls, (br + 1) * ls, colorIdx)
      })

      d.worldX = w.wx
      d.worldY = w.wy
      rebuildRef.current()
    }

    const onUp = (e: PointerEvent) => {
      if (isPanButton(e.button)) panRef.current.on = false
      if (e.button === 0) drawRef.current = { on: false, worldX: 0, worldY: 0 }
      rectRef.current = null
    }

    const onContextMenu = (e: Event) => e.preventDefault()

    for (const [ev, fn] of [["pointerdown", onDown], ["pointermove", onMove], ["pointerup", onUp], ["pointercancel", onUp], ["pointerleave", onUp], ["contextmenu", onContextMenu]] as const) {
      canvas.addEventListener(ev, fn)
    }

    return () => {
      canvas.removeEventListener("pointerdown", onDown)
      canvas.removeEventListener("pointermove", onMove)
      canvas.removeEventListener("pointerup", onUp)
      canvas.removeEventListener("pointercancel", onUp)
      canvas.removeEventListener("pointerleave", onUp)
      canvas.removeEventListener("contextmenu", onContextMenu)
    }
  }, [canvasRef, toWorld, toPaintTarget, pixiCtx])

  /** Clear canvas and re-render after a brand switch. */

  useEffect(() => {
    cellsRef.current = new Map()
    rebuildRef.current()
  }, [palette])

  /** Public API returned by the hook. */

  const fitToCanvas = useCallback(() => {
    const ctx = getPixi()
    if (!ctx) return
    ctx.world.x = ctx.app.screen.width / 2
    ctx.world.y = ctx.app.screen.height / 2
    setZoom(initialZoom)
  }, [setZoom, initialZoom, pixiCtx])

  const clearCanvas = useCallback(() => {
    cellsRef.current = new Map()
    rebuildRef.current()
  }, [])

  const getCellsData = useCallback((): {
    grid: number[][]; brandId: string
  } | null => {
    const grid = serializeGrid(cellsRef.current)
    if (!grid) return null
    return { grid, brandId: palette.id }
  }, [palette])

  const loadGrid = useCallback((grid: number[][]) => {
    const map = new Map<string, number>()
    let minC = Infinity, maxC = -Infinity, minR = Infinity, maxR = -Infinity
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r]
      for (let c = 0; c < row.length; c++) {
        if (row[c] !== EMPTY) {
          map.set(`${c},${r}`, row[c])
          if (c < minC) minC = c
          if (c > maxC) maxC = c
          if (r < minR) minR = r
          if (r > maxR) maxR = r
        }
      }
    }
    cellsRef.current = map

    if (map.size > 0) {
      const ctx = pixiRef.current
      if (ctx) {
        const ww = (maxC + 1) * CELL
        const wh = (maxR + 1) * CELL
        ctx.world.x = (ctx.app.screen.width - ww * zoomRef.current) / 2
        ctx.world.y = (ctx.app.screen.height - wh * zoomRef.current) / 2
      }
    }

    rebuildRef.current()
  }, [])

  return { zoom, setZoom, fitToCanvas, clearCanvas, getCellsData, loadGrid }
}
