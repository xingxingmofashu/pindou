"use client"

import { useEffect, useRef, useState, useCallback, type RefObject } from "react"
import { Application, Container, Graphics, Text } from "pixi.js"
import { EMPTY, paintBlock, serializeGrid } from "@/lib/editor/data"
import { walkLine } from "@/lib/editor/geometry"
import { lodParams, drawGrid, buildBeadEntries, type ViewRect, type BeadEntry } from "@/lib/editor/render"
import { useActivePalette } from "@/hooks/use-active-palette"
import type { ToolKind } from "@/components/editor/tool-bar"

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
  /** When true, colour codes are overlaid on each bead. */
  showLabels?: boolean
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
  } = options

  const appRef = useRef<Application | null>(null)
  const worldRef = useRef<Container | null>(null)
  const beadsGfxRef = useRef<Graphics | null>(null)
  const gridGfxRef = useRef<Graphics | null>(null)
  const labelsRef = useRef<Container | null>(null)

  const [zoom, setZoomState] = useState(initialZoom)
  const zoomRef = useRef(initialZoom)
  const rafRef = useRef(0)

  /** Sparse infinite bead grid. */
  const cellsRef = useRef<Map<string, number>>(new Map())
  /** Last built bead entries, kept for label repositioning during pan. */
  const lastEntriesRef = useRef<BeadEntry[]>([])
  /** Cached bounding rect reused across a pointer stroke. */
  const rectRef = useRef<DOMRect | null>(null)

  const panRef = useRef({ on: false, startX: 0, startY: 0, startWX: 0, startWY: 0 })
  const drawRef = useRef({ on: false, worldX: 0, worldY: 0 })

  const toolRef = useRef(activeTool)
  const colorRef = useRef(activeColorIndex)
  const showLabelsRef = useRef(showLabels)

  /** Active bead brand, shared with ColorPalette via the palette store. */
  const { palette } = useActivePalette()
  const paletteRef = useRef(palette ?? null)

  /** Compute the visible world rectangle from the current pan and zoom. */
  const viewport = useCallback((): ViewRect | null => {
    const app = appRef.current
    const world = worldRef.current
    if (!app || !world) return null
    const z = zoomRef.current
    const w = app.screen.width
    const h = app.screen.height
    return {
      left: -world.x / z,
      top: -world.y / z,
      right: (-world.x + w) / z,
      bottom: (-world.y + h) / z,
    }
  }, [])

  /** Reposition label texts during pan to track world-space bead centers in screen space. */
  const redrawLabels = useCallback(() => {
    const labels = labelsRef.current
    const world = worldRef.current
    if (!labels || !world) return
    const z = zoomRef.current
    const entries = lastEntriesRef.current
    const children = labels.children
    for (let i = 0; i < Math.min(entries.length, children.length); i++) {
      const e = entries[i]
      const t = children[i] as Text
      t.x = world.x + (e.worldX + e.size / 2) * z
      t.y = world.y + (e.worldY + e.size / 2) * z
    }
  }, [])

  const redrawGrid = useCallback(() => {
    const v = viewport()
    if (!v) return
    const { size } = lodParams(zoomRef.current)
    drawGrid(gridGfxRef.current!, v, size, zoomRef.current, gridColor, gridAlpha)
    redrawLabels()
  }, [gridColor, gridAlpha, viewport, redrawLabels])

  const rebuild = useCallback(() => {
    const beadsGfx = beadsGfxRef.current
    const labels = labelsRef.current
    const world = worldRef.current
    const v = viewport()
    if (!v || !beadsGfx) return

    const z = zoomRef.current
    const { scale, size } = lodParams(z)

    drawGrid(gridGfxRef.current!, v, size, z, gridColor, gridAlpha)

    const palette = paletteRef.current
    if (!palette) return

    const entries = buildBeadEntries(cellsRef.current, v, scale, size, palette)
    lastEntriesRef.current = entries
    const hexToNum = (h: string) => parseInt(h.replace("#", ""), 16)

    beadsGfx.clear()
    for (const e of entries) {
      beadsGfx.rect(e.worldX, e.worldY, e.size, e.size)
      beadsGfx.fill({ color: hexToNum(e.hex) })
    }

    if (labels) {
      labels.removeChildren()
      if (showLabelsRef.current && world) {
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
          text.x = world.x + (e.worldX + e.size / 2) * z
          text.y = world.y + (e.worldY + e.size / 2) * z
          labels.addChild(text)
        }
      }
    }
  }, [gridColor, gridAlpha, viewport])

  const rebuildRef = useRef(rebuild)
  const redrawGridRef = useRef(redrawGrid)

  /** Keep mutable refs in sync with the latest render values. */
  useEffect(() => {
    toolRef.current = activeTool
    colorRef.current = activeColorIndex
    showLabelsRef.current = showLabels
    rebuildRef.current = rebuild
    redrawGridRef.current = redrawGrid
  })

  /** Rebuild when showLabels toggles. */
  useEffect(() => {
    rebuildRef.current()
  }, [showLabels])

  /** Sync zoom state via rAF. */
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
      if (worldRef.current) worldRef.current.scale.set(clamped)
      rebuildRef.current()
      syncZoom()
    },
    [syncZoom]
  )

  const toWorld = useCallback(
    (clientX: number, clientY: number, rect?: DOMRect | null) => {
      const canvas = canvasRef.current
      const world = worldRef.current
      if (!canvas || !world) return null
      const r = rect ?? canvas.getBoundingClientRect()
      const z = zoomRef.current
      return { wx: (clientX - r.left - world.x) / z, wy: (clientY - r.top - world.y) / z }
    },
    [canvasRef]
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

  /** PixiJS init / destroy. */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return

    let dead = false

    ;(async () => {
      try {
        const app = new Application()
        await app.init({
          canvas, resizeTo: parent, background: backgroundColor,
          antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true,
        })
        if (dead) { app.destroy(true); return }

        const world = new Container()
        world.label = "world"
        world.scale.set(zoomRef.current)

        const beadsGfx = new Graphics(); beadsGfx.label = "beads"
        const gridGfx = new Graphics(); gridGfx.label = "grid"
        const labels = new Container(); labels.label = "labels"
        world.addChild(beadsGfx)
        world.addChild(gridGfx)

        app.stage.addChild(world)
        app.stage.addChild(labels)
        appRef.current = app
        worldRef.current = world
        beadsGfxRef.current = beadsGfx
        labelsRef.current = labels
        gridGfxRef.current = gridGfx

        rebuildRef.current()
        app.renderer.on("resize", () => rebuildRef.current())
      } catch (err) {
        console.error("PixiJS init failed:", err)
      }
    })()

    return () => {
      dead = true
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0 }
      appRef.current?.destroy(true)
      appRef.current = null
      worldRef.current = null
      beadsGfxRef.current = null
      labelsRef.current = null
      gridGfxRef.current = null
    }
  }, [canvasRef, backgroundColor])

  /** Wheel zoom. */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const app = appRef.current
      const world = worldRef.current
      if (!app || !world) return

      const r = canvas.getBoundingClientRect()
      const cx = e.clientX - r.left
      const cy = e.clientY - r.top
      const old = zoomRef.current
      const raw = old * (e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR)
      const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, raw))
      const ratio = clamped / old

      world.x = cx - ratio * (cx - world.x)
      world.y = cy - ratio * (cy - world.y)
      zoomRef.current = clamped
      world.scale.set(clamped)
      rebuildRef.current()
      syncZoom()
    }

    canvas.addEventListener("wheel", onWheel, { passive: false })
    return () => canvas.removeEventListener("wheel", onWheel)
  }, [canvasRef, syncZoom])

  /** Pointer: pan + pen / eraser. */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const isDraw = (t: ToolKind) => t === "pen" || t === "eraser"

    const onDown = (e: PointerEvent) => {
      rectRef.current = canvas.getBoundingClientRect()

      if (e.button === 1 || e.button === 2) {
        e.preventDefault()
        const w = worldRef.current
        if (!w) return
        const p = panRef.current
        p.on = true; p.startX = e.clientX; p.startY = e.clientY; p.startWX = w.x; p.startWY = w.y
        canvas.setPointerCapture(e.pointerId)
        return
      }
      if (e.button !== 0) return

      const tool = toolRef.current

      if (isDraw(tool)) {
        e.preventDefault()
        const t = toPaintTarget(e.clientX, e.clientY)
        if (!t) return
        paintBlock(cellsRef.current, t.c0, t.r0, t.c1, t.r1, tool === "eraser" ? EMPTY : colorRef.current)
        const w = toWorld(e.clientX, e.clientY, rectRef.current)
        if (w) drawRef.current = { on: true, worldX: w.wx, worldY: w.wy }
        rebuildRef.current()
        canvas.setPointerCapture(e.pointerId)
      }
    }

    const onMove = (e: PointerEvent) => {
      const p = panRef.current
      if (p.on) {
        const w = worldRef.current
        if (!w) return
        w.x = p.startWX + e.clientX - p.startX
        w.y = p.startWY + e.clientY - p.startY
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
      if (e.button === 1 || e.button === 2) panRef.current.on = false
      if (e.button === 0) drawRef.current = { on: false, worldX: 0, worldY: 0 }
      rectRef.current = null
    }

    const onContextMenu = (e: Event) => e.preventDefault()

    canvas.addEventListener("pointerdown", onDown)
    canvas.addEventListener("pointermove", onMove)
    canvas.addEventListener("pointerup", onUp)
    canvas.addEventListener("pointercancel", onUp)
    canvas.addEventListener("pointerleave", onUp)
    canvas.addEventListener("contextmenu", onContextMenu)
    return () => {
      canvas.removeEventListener("pointerdown", onDown)
      canvas.removeEventListener("pointermove", onMove)
      canvas.removeEventListener("pointerup", onUp)
      canvas.removeEventListener("pointercancel", onUp)
      canvas.removeEventListener("pointerleave", onUp)
      canvas.removeEventListener("contextmenu", onContextMenu)
    }
  }, [canvasRef, toWorld, toPaintTarget])

  /** Clear canvas and re-render with the new brand's colours after a palette switch. */
  useEffect(() => {
    paletteRef.current = palette ?? null
    cellsRef.current = new Map()
    rebuildRef.current()
  }, [palette])

  const fitToCanvas = useCallback(() => {
    const app = appRef.current
    const world = worldRef.current
    if (!app || !world) return
    world.x = app.screen.width / 2
    world.y = app.screen.height / 2
    setZoom(initialZoom)
  }, [setZoom, initialZoom])

  const clearCanvas = useCallback(() => {
    cellsRef.current = new Map()
    rebuildRef.current()
  }, [])

  /** Export the sparse grid for publishing. */
  const getCellsData = useCallback((): {
    grid: number[][]; brandId: string
  } | null => {
    const grid = serializeGrid(cellsRef.current)
    if (!grid) return null
    return { grid, brandId: paletteRef.current?.id ?? "mard" }
  }, [])

  return { zoom, setZoom, fitToCanvas, clearCanvas, getCellsData }
}
