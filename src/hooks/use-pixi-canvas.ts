"use client"

import { useEffect, useRef, useState, useCallback, type RefObject } from "react"
import { Application, Container, Graphics } from "pixi.js"

const MIN_ZOOM = 0.5
const MAX_ZOOM = 20
const ZOOM_FACTOR = 1.15
const DEFAULT_ZOOM = 3

interface UsePixiCanvasOptions {
  cellSize?: number
  gridColor?: number
  gridAlpha?: number
  backgroundColor?: string
  initialZoom?: number
}

export function usePixiCanvas(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  options: UsePixiCanvasOptions = {}
) {
  const {
    cellSize = 10,
    gridColor = 0x000000,
    gridAlpha = 0.12,
    backgroundColor = "#fafafa",
    initialZoom = DEFAULT_ZOOM,
  } = options

  const appRef = useRef<Application | null>(null)
  const worldRef = useRef<Container | null>(null)
  const gridRef = useRef<Graphics | null>(null)
  const [zoom, setZoomState] = useState(initialZoom)
  const zoomRef = useRef(initialZoom)

  // Use refs to avoid cascading effect re-runs
  const panRef = useRef({ panning: false, sx: 0, sy: 0, swx: 0, swy: 0 })
  const syncZoomRAF = useRef(0)

  // ---- Redraw grid ----
  const redrawGrid = useCallback(() => {
    const g = gridRef.current
    const app = appRef.current
    const world = worldRef.current
    if (!g || !app || !world) return

    const z = zoomRef.current
    const w = app.screen.width
    const h = app.screen.height
    const ox = -world.x / z
    const oy = -world.y / z

    g.clear()

    const step = cellSize
    const lineWidth = 1 / z
    const margin = step * 4

    const startX = Math.floor((ox - margin) / step) * step
    const startY = Math.floor((oy - margin) / step) * step
    const endX = ox + w / z + margin
    const endY = oy + h / z + margin

    // At low zoom, grid lines overlap into a solid block — fall back to single rect
    if (lineWidth >= step) {
      g.rect(startX, startY, endX - startX, endY - startY)
      g.fill({ color: gridColor, alpha: gridAlpha })
      return
    }

    for (let x = startX; x <= endX; x += step) {
      g.rect(x, startY, lineWidth, endY - startY)
    }
    for (let y = startY; y <= endY; y += step) {
      g.rect(startX, y, endX - startX, lineWidth)
    }
    g.fill({ color: gridColor, alpha: gridAlpha })
  }, [cellSize, gridColor, gridAlpha])

  const redrawGridRef = useRef(redrawGrid)
  redrawGridRef.current = redrawGrid

  // ---- Set zoom ----
  const setZoom = useCallback(
    (z: number | ((prev: number) => number)) => {
      const resolved = typeof z === "function" ? z(zoomRef.current) : z
      const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, resolved))
      zoomRef.current = clamped
      if (worldRef.current) worldRef.current.scale.set(clamped)
      redrawGrid()
      if (!syncZoomRAF.current) {
        syncZoomRAF.current = requestAnimationFrame(() => {
          syncZoomRAF.current = 0
          setZoomState(zoomRef.current)
        })
      }
    },
    [redrawGrid]
  )

  // ---- Initialize PixiJS ----
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const parent = canvas.parentElement
    if (!parent) return

    let destroyed = false

    const init = async () => {
      try {
        const app = new Application()
        await app.init({
          canvas,
          resizeTo: parent,
          background: backgroundColor,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        })

        if (destroyed) {
          app.destroy(true)
          return
        }

        const world = new Container()
        world.label = "world"
        world.scale.set(zoomRef.current)
        app.stage.addChild(world)

        const grid = new Graphics()
        grid.label = "grid"
        world.addChild(grid)

        appRef.current = app
        worldRef.current = world
        gridRef.current = grid

        redrawGridRef.current()

        // Redraw grid after resize
        app.renderer.on("resize", () => {
          redrawGridRef.current()
        })
      } catch (err) {
        console.error("PixiJS init failed:", err)
      }
    }

    init()

    return () => {
      destroyed = true
      if (syncZoomRAF.current) {
        cancelAnimationFrame(syncZoomRAF.current)
        syncZoomRAF.current = 0
      }
      appRef.current?.destroy(true)
      appRef.current = null
      worldRef.current = null
      gridRef.current = null
    }
  }, [canvasRef, backgroundColor])

  // ---- Wheel zoom (cursor-centered) ----
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const app = appRef.current
      const world = worldRef.current
      if (!app || !world) return

      const rect = canvas.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top

      const oldZoom = zoomRef.current
      const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR
      const newZoom = oldZoom * factor
      const ratio = newZoom / oldZoom

      world.x = cx - ratio * (cx - world.x)
      world.y = cy - ratio * (cy - world.y)
      setZoom(newZoom)
    }

    canvas.addEventListener("wheel", onWheel, { passive: false })
    return () => canvas.removeEventListener("wheel", onWheel)
  }, [canvasRef, setZoom])

  // ---- Middle-button pan ----
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onDown = (e: PointerEvent) => {
      // Middle mouse button
      if (e.button === 1) {
        e.preventDefault()
        const world = worldRef.current
        if (!world) return
        const p = panRef.current
        p.panning = true
        p.sx = e.clientX
        p.sy = e.clientY
        p.swx = world.x
        p.swy = world.y
        canvas.setPointerCapture(e.pointerId)
      }
    }

    const onMove = (e: PointerEvent) => {
      const p = panRef.current
      if (!p.panning) return
      const world = worldRef.current
      if (!world) return
      world.x = p.swx + e.clientX - p.sx
      world.y = p.swy + e.clientY - p.sy
      redrawGridRef.current()
    }

    const onUp = () => {
      panRef.current.panning = false
    }

    canvas.addEventListener("pointerdown", onDown)
    canvas.addEventListener("pointermove", onMove)
    canvas.addEventListener("pointerup", onUp)
    return () => {
      canvas.removeEventListener("pointerdown", onDown)
      canvas.removeEventListener("pointermove", onMove)
      canvas.removeEventListener("pointerup", onUp)
    }
  }, [canvasRef])

  // ---- Fit to canvas ----
  const fitToCanvas = useCallback(() => {
    const app = appRef.current
    const world = worldRef.current
    if (!app || !world) return
    world.x = app.screen.width / 2
    world.y = app.screen.height / 2
    setZoom(initialZoom)
  }, [setZoom, initialZoom])

  return { zoom, setZoom, fitToCanvas }
}
