"use client"

import { useEffect, useRef, useState, useCallback, type RefObject } from "react"
import { Application, Container, Graphics } from "pixi.js"
import { PALETTES, DEFAULT_PALETTE_ID } from "@/lib/palette/registry"
import type { ToolKind } from "@/components/tool-bar"

// Constants

/** Minimum zoom factor (50%) */
const MIN_ZOOM = 0.5
/** Maximum zoom factor (2000%) */
const MAX_ZOOM = 20
/** Multiplicative zoom step per wheel tick */
const ZOOM_FACTOR = 1.15
/** Default zoom factor (300%) */
const DEFAULT_ZOOM = 3

/** World units per data cell */
const BASE_CELL_SIZE = 10
/** Minimum screen pixels per visual cell — drives the LOD threshold */
const MIN_VISUAL_PX = 10
/** Maximum number of cells a flood-fill operation may touch before aborting */
const MAX_FILL_CELLS = 100_000
/** Maximum Chebyshev distance from seed when filling empty space */
const MAX_EMPTY_FILL_RADIUS = 500

/** Sentinel value for an unpainted cell */
const EMPTY_CELL = 0

// Types

interface UsePixiCanvasOptions {
  /** Grid-line colour (0xRRGGBB) */
  gridColor?: number
  /** Grid-line alpha (0–1) */
  gridAlpha?: number
  /** Canvas background colour (CSS string) */
  backgroundColor?: string
  /** Initial zoom level */
  initialZoom?: number
  /** Currently active tool */
  activeTool?: ToolKind
  /**
   * Currently selected palette colour.
   * 0 = empty / eraser, 1..N = 1‑based index into `palette.colors`.
   */
  activeColorIndex?: number
  /**
   * Called when the eyedropper tool picks a colour from the canvas.
   * @param colorIndex - The picked colour index (0 = empty).
   */
  onColorPick?: (colorIndex: number) => void
}

/** Descriptor for one visual bead rectangle to be drawn */
interface BeadEntry {
  /** World-space x of the top-left corner */
  worldX: number
  /** World-space y of the top-left corner */
  worldY: number
  /** Width and height in world units */
  size: number
  /** CSS hex colour string (e.g. "#FF0000") */
  hex: string
}

// Pure helpers

/**
 * Compute the level-of-detail parameters for a given zoom level.
 *
 * The visual cell size is chosen so that each visual cell is at least
 * {@link MIN_VISUAL_PX} screen pixels wide, ensuring the grid remains
 * legible and beads are large enough to interact with at any zoom.
 *
 * @param zoom - Current zoom factor (screen px per world unit).
 * @returns LOD parameters for the current zoom.
 */
function computeLOD(zoom: number) {
  const pxPerDataCell = zoom * BASE_CELL_SIZE
  const lodScale = Math.max(1, Math.ceil(MIN_VISUAL_PX / pxPerDataCell))
  const visualCellSize = lodScale * BASE_CELL_SIZE
  return { lodScale, visualCellSize }
}

/**
 * Encode a data-cell coordinate pair as a string key.
 *
 * @param col - Data-cell column (may be negative).
 * @param row - Data-cell row (may be negative).
 * @returns Stable string key suitable for use in a {@link Map}.
 */
function cellKey(col: number, row: number): string {
  return `${col},${row}`
}

/**
 * Parse a string key produced by {@link cellKey} back to a coordinate pair.
 *
 * @param key - String in the form `"col,row"`.
 * @returns Tuple `[col, row]` as numbers.
 * @throws If the key is malformed, both coordinates will be `NaN` — callers
 *         should guard with {@link Number.isFinite} when using untrusted data.
 */
function parseKey(key: string): [number, number] {
  const [c, r] = key.split(",")
  return [Number(c), Number(r)]
}

/**
 * Return the colour with the highest frequency in a colour→count map,
 * skipping {@link EMPTY_CELL}.
 */
function dominantColor(counts: Map<number, number>): number {
  let best = 0
  let bestCnt = 0
  for (const [color, cnt] of counts) {
    if (cnt > bestCnt) {
      bestCnt = cnt
      best = color
    }
  }
  return best
}

/**
 * Convert a data-cell column and LOD scale to a visual-cell column.
 * Both data-cell and visual-cell coordinates use the same sign convention
 * (negative values stay negative after division — Math.floor rounds toward -∞).
 */
function dataToVisualCell(dc: number, lodScale: number): number {
  return Math.floor(dc / lodScale)
}

/** Convert visual-cell coords + LOD scale to the data-cell range origin. */
function visualToDataOrigin(vc: number, lodScale: number): number {
  return vc * lodScale
}

// Hook

/**
 * Manages the full PixiJS editor canvas lifecycle.
 *
 * @param canvasRef - React ref pointing to the `<canvas>` element to bind to.
 * @param options - Configuration and interaction callbacks.
 * @returns Zoom state, controls, and grid-management helpers.
 */
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
    onColorPick,
  } = options


  const appRef = useRef<Application | null>(null)
  const worldRef = useRef<Container | null>(null)
  const gridGfxRef = useRef<Graphics | null>(null)
  const beadsGfxRef = useRef<Graphics | null>(null)

  const [zoom, setZoomState] = useState(initialZoom)
  const zoomRef = useRef(initialZoom)
  const syncZoomRAF = useRef(0)

  /** Sparse data grid — only stores painted cells (infinite extent). */
  const dataMapRef = useRef<Map<string, number>>(new Map())

  const panRef = useRef({ panning: false, sx: 0, sy: 0, swx: 0, swy: 0 })
  /** Stores world-space coords of the last draw point to survive LOD changes. */
  const drawRef = useRef({ drawing: false, lastWX: 0, lastWY: 0 })

  // Synced option refs (kept current on every render)
  const activeToolRef = useRef<ToolKind>(activeTool)
  activeToolRef.current = activeTool
  const activeColorIdxRef = useRef<number>(activeColorIndex)
  activeColorIdxRef.current = activeColorIndex
  const onColorPickRef = useRef(onColorPick)
  onColorPickRef.current = onColorPick

  /** Active bead palette (resolved once from the registry). */
  const paletteRef = useRef(PALETTES.get(DEFAULT_PALETTE_ID) ?? null)

  // Cached bounding rect to avoid getBoundingClientRect on every pointermove
  const cachedRectRef = useRef<DOMRect | null>(null)

  // Paint helpers

  /**
   * Write a rectangular block of data cells to the sparse grid.
   *
   * Passing {@link EMPTY_CELL} as `colorIdx` removes the cells from the map.
   *
   * @param colStart - Left column (inclusive).
   * @param rowStart - Top row (inclusive).
   * @param colEnd - Right column (exclusive).
   * @param rowEnd - Bottom row (exclusive).
   * @param colorIdx - Palette colour index to write.
   */
  const paintDataCells = useCallback(
    (
      colStart: number,
      rowStart: number,
      colEnd: number,
      rowEnd: number,
      colorIdx: number
    ) => {
      const map = dataMapRef.current
      for (let r = rowStart; r < rowEnd; r++) {
        for (let c = colStart; c < colEnd; c++) {
          const k = cellKey(c, r)
          if (colorIdx === EMPTY_CELL) {
            map.delete(k)
          } else {
            map.set(k, colorIdx)
          }
        }
      }
    },
    []
  )

  /**
   * Flood-fill connected cells starting from a seed coordinate.
   *
   * Uses iterative BFS so it cannot overflow the call stack.  All
   * modifications are applied atomically — if the fill exceeds
   * {@link MAX_FILL_CELLS} the operation is aborted without touching
   * any cell.
   *
   * When the seed cell is empty a bounding box of
   * {@link MAX_EMPTY_FILL_RADIUS} cells from the seed is enforced to
   * prevent runaway expansion.
   *
   * @param startCol - Seed column in data-cell space.
   * @param startRow - Seed row in data-cell space.
   * @param replacementColor - Palette colour index to fill with.
   */
  const fillArea = useCallback(
    (startCol: number, startRow: number, replacementColor: number) => {
      const map = dataMapRef.current
      const startKey = cellKey(startCol, startRow)
      const targetVal = map.get(startKey) ?? EMPTY_CELL
      if (targetVal === replacementColor) return

      const fillingEmpty = targetVal === EMPTY_CELL

      const queue: [number, number][] = [[startCol, startRow]]
      const visited = new Set<string>()
      visited.add(startKey)
      const cells: [number, number][] = []
      let head = 0

      while (head < queue.length) {
        const [c, r] = queue[head++]
        cells.push([c, r])

        if (cells.length > MAX_FILL_CELLS) {
          console.warn("Flood fill aborted: exceeded max cells")
          return
        }

        for (const [nc, nr] of [
          [c - 1, r],
          [c + 1, r],
          [c, r - 1],
          [c, r + 1],
        ]) {
          // Bounding-box clamp when filling empty space
          if (
            fillingEmpty &&
            (Math.abs(nc - startCol) > MAX_EMPTY_FILL_RADIUS ||
              Math.abs(nr - startRow) > MAX_EMPTY_FILL_RADIUS)
          ) {
            continue
          }

          const nk = cellKey(nc, nr)
          if (visited.has(nk)) continue
          const nv = map.get(nk) ?? EMPTY_CELL
          if (nv !== targetVal) continue
          visited.add(nk)
          queue.push([nc, nr])
        }
      }

      // Apply all modifications atomically
      for (const [c, r] of cells) {
        if (replacementColor === EMPTY_CELL) {
          map.delete(cellKey(c, r))
        } else {
          map.set(cellKey(c, r), replacementColor)
        }
      }
    },
    []
  )

  /**
   * Walk along a line segment between two visual-cell coordinates and invoke
   * a callback for every cell on the path (Bresenham's algorithm).
   *
   * @param x0 - Start visual column.
   * @param y0 - Start visual row.
   * @param x1 - End visual column.
   * @param y1 - End visual row.
   * @param fn - Callback receiving each `(vCol, vRow)` on the line.
   */
  const forLineBetween = useCallback(
    (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      fn: (vCol: number, vRow: number) => void
    ) => {
      const dx = Math.abs(x1 - x0)
      const dy = Math.abs(y1 - y0)
      const sx = x0 < x1 ? 1 : -1
      const sy = y0 < y1 ? 1 : -1
      let err = dx - dy
      let x = x0
      let y = y0

      fn(x, y)

      while (x !== x1 || y !== y1) {
        const e2 = err * 2
        if (e2 > -dy) {
          err -= dy
          x += sx
        }
        if (e2 < dx) {
          err += dx
          y += sy
        }
        fn(x, y)
      }
    },
    []
  )

  /** Clear all painted cells from the grid. */
  const clearGrid = useCallback(() => {
    dataMapRef.current.clear()
    rebuildRef.current()
  }, [])

  // Render

  /**
   * Draw only the grid lines (skipping bead aggregation).
   * Used during panning since beads move with the world container.
   */
  const redrawGridOnly = useCallback(() => {
    const app = appRef.current
    const world = worldRef.current
    const gridGfx = gridGfxRef.current
    if (!app || !world || !gridGfx) return

    const z = zoomRef.current
    const vs = computeLOD(z).visualCellSize

    const screenW = app.screen.width
    const screenH = app.screen.height

    const wLeft = -world.x / z
    const wTop = -world.y / z
    const wRight = wLeft + screenW / z
    const wBottom = wTop + screenH / z
    const margin = vs * 2

    const gx0 = Math.floor((wLeft - margin) / vs) * vs
    const gy0 = Math.floor((wTop - margin) / vs) * vs
    const gx1 = wRight + margin
    const gy1 = wBottom + margin

    gridGfx.clear()

    const lw = 1 / z
    for (let x = gx0; x <= gx1; x += vs) {
      gridGfx.rect(x, wTop - margin, lw, wBottom - wTop + margin * 2)
    }
    for (let y = gy0; y <= gy1; y += vs) {
      gridGfx.rect(wLeft - margin, y, wRight - wLeft + margin * 2, lw)
    }
    gridGfx.fill({ color: gridColor, alpha: gridAlpha })
  }, [gridColor, gridAlpha])

  /**
   * Rebuild the bead-entry list and grid-line data from the current zoom,
   * pan, and sparse data map, then draw everything to the two Graphics layers.
   */
  const rebuildAndDraw = useCallback(() => {
    const app = appRef.current
    const world = worldRef.current
    const beadsGfx = beadsGfxRef.current
    const gridGfx = gridGfxRef.current
    if (!app || !world || !beadsGfx || !gridGfx) return

    const z = zoomRef.current
    const lod = computeLOD(z)
    const vs = lod.visualCellSize
    const ls = lod.lodScale

    const screenW = app.screen.width
    const screenH = app.screen.height

    const wLeft = -world.x / z
    const wTop = -world.y / z
    const wRight = wLeft + screenW / z
    const wBottom = wTop + screenH / z
    const margin = vs * 2

    const gx0 = Math.floor((wLeft - margin) / vs) * vs
    const gy0 = Math.floor((wTop - margin) / vs) * vs
    const gx1 = wRight + margin
    const gy1 = wBottom + margin

    const lw = 1 / z
    gridGfx.clear()
    for (let x = gx0; x <= gx1; x += vs) {
      gridGfx.rect(x, wTop - margin, lw, wBottom - wTop + margin * 2)
    }
    for (let y = gy0; y <= gy1; y += vs) {
      gridGfx.rect(wLeft - margin, y, wRight - wLeft + margin * 2, lw)
    }
    gridGfx.fill({ color: gridColor, alpha: gridAlpha })

    const palette = paletteRef.current
    if (!palette) return

    const dcMin = Math.floor((wLeft - margin) / BASE_CELL_SIZE)
    const dcMax = Math.ceil((wRight + margin) / BASE_CELL_SIZE)
    const drMin = Math.floor((wTop - margin) / BASE_CELL_SIZE)
    const drMax = Math.ceil((wBottom + margin) / BASE_CELL_SIZE)

    const accum = new Map<
      string,
      { vc: number; vr: number; counts: Map<number, number> }
    >()

    for (const [key, color] of dataMapRef.current) {
      const [dc, dr] = parseKey(key)
      if (!Number.isFinite(dc) || !Number.isFinite(dr)) continue
      if (dc < dcMin || dc >= dcMax || dr < drMin || dr >= drMax) continue

      const vc = dataToVisualCell(dc, ls)
      const vr = dataToVisualCell(dr, ls)

      const wx = vc * vs
      const wy = vr * vs
      if (wx + vs < wLeft - margin || wx > wRight + margin) continue
      if (wy + vs < wTop - margin || wy > wBottom + margin) continue

      const vKey = `${vc},${vr}`
      let slot = accum.get(vKey)
      if (!slot) {
        slot = { vc, vr, counts: new Map() }
        accum.set(vKey, slot)
      }
      slot.counts.set(color, (slot.counts.get(color) ?? 0) + 1)
    }

    const entries: BeadEntry[] = []
    for (const [, slot] of accum) {
      const best = dominantColor(slot.counts)
      if (best === EMPTY_CELL) continue
      const c = palette.colors[best - 1]
      if (!c) continue

      entries.push({
        worldX: slot.vc * vs,
        worldY: slot.vr * vs,
        size: vs,
        hex: c.hex,
      })
    }

    beadsGfx.clear()
    for (const e of entries) {
      const hex = e.hex.replace("#", "")
      beadsGfx.rect(e.worldX, e.worldY, e.size, e.size)
      beadsGfx.fill({ color: parseInt(hex, 16) })
    }
  }, [gridColor, gridAlpha])

  const rebuildRef = useRef(rebuildAndDraw)
  rebuildRef.current = rebuildAndDraw

  const redrawGridRef = useRef(redrawGridOnly)
  redrawGridRef.current = redrawGridOnly

  // Zoom

  /**
   * Set or adjust the current zoom level.
   *
   * Accepts either an absolute value or an updater function receiving the
   * previous zoom. The value is clamped to [{@link MIN_ZOOM}, {@link MAX_ZOOM}]
   * and the React state is synced via rAF.
   *
   * @param z - Absolute zoom level or `(prev: number) => number` updater.
   */
  const setZoom = useCallback(
    (z: number | ((prev: number) => number)) => {
      const resolved = typeof z === "function" ? z(zoomRef.current) : z
      const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, resolved))
      zoomRef.current = clamped
      if (worldRef.current) worldRef.current.scale.set(clamped)
      rebuildRef.current()
      if (!syncZoomRAF.current) {
        syncZoomRAF.current = requestAnimationFrame(() => {
          syncZoomRAF.current = 0
          setZoomState(zoomRef.current)
        })
      }
    },
    []
  )

  // Coordinate conversion

  /**
   * Convert a mouse / pointer event's client coordinates to world space.
   *
   * @param clientX - `clientX` from the pointer event.
   * @param clientY - `clientY` from the pointer event.
   * @returns World-space coordinates, or `null` if PixiJS is not yet ready.
   */
  const screenToWorld = useCallback(
    (
      clientX: number,
      clientY: number,
      rect?: DOMRect | null
    ): { wx: number; wy: number } | null => {
      const canvas = canvasRef.current
      const world = worldRef.current
      if (!canvas || !world) return null
      const r = rect ?? canvas.getBoundingClientRect()
      const sx = clientX - r.left
      const sy = clientY - r.top
      const z = zoomRef.current
      return {
        wx: (sx - world.x) / z,
        wy: (sy - world.y) / z,
      }
    },
    [canvasRef]
  )

  /**
   * Convert screen coordinates to a paint-target descriptor.
   *
   * The returned range covers the full visual-cell block at the current LOD
   * level, so painting always fills the entire visible cell regardless of
   * zoom. Returns `null` only when PixiJS has not yet initialised.
   *
   * @param clientX - `clientX` from the pointer event.
   * @param clientY - `clientY` from the pointer event.
   * @returns A block descriptor with data-cell bounds and visual-cell coords.
   */
  const screenToPaintTarget = useCallback(
    (clientX: number, clientY: number) => {
      const w = screenToWorld(clientX, clientY)
      if (!w) return null

      const lod = computeLOD(zoomRef.current)
      const vc = dataToVisualCell(w.wx, lod.visualCellSize)
      const vr = dataToVisualCell(w.wy, lod.visualCellSize)

      const dc0 = visualToDataOrigin(vc, lod.lodScale)
      const dr0 = visualToDataOrigin(vr, lod.lodScale)
      const dc1 = dc0 + lod.lodScale
      const dr1 = dr0 + lod.lodScale

      return { colStart: dc0, rowStart: dr0, colEnd: dc1, rowEnd: dr1, vCol: vc, vRow: vr }
    },
    [screenToWorld]
  )

  // PixiJS initialisation

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

        const beadsGfx = new Graphics()
        beadsGfx.label = "beads"
        world.addChild(beadsGfx)

        const gridGfx = new Graphics()
        gridGfx.label = "grid"
        world.addChild(gridGfx)

        appRef.current = app
        worldRef.current = world
        beadsGfxRef.current = beadsGfx
        gridGfxRef.current = gridGfx

        rebuildRef.current()

        app.renderer.on("resize", () => rebuildRef.current())
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
      beadsGfxRef.current = null
      gridGfxRef.current = null
    }
  }, [canvasRef, backgroundColor])

  // Wheel zoom (cursor-centred)

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
      const raw = oldZoom * factor
      const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, raw))
      const ratio = clamped / oldZoom

      world.x = cx - ratio * (cx - world.x)
      world.y = cy - ratio * (cy - world.y)
      zoomRef.current = clamped
      world.scale.set(clamped)
      rebuildRef.current()

      if (!syncZoomRAF.current) {
        syncZoomRAF.current = requestAnimationFrame(() => {
          syncZoomRAF.current = 0
          setZoomState(zoomRef.current)
        })
      }
    }

    canvas.addEventListener("wheel", onWheel, { passive: false })
    return () => canvas.removeEventListener("wheel", onWheel)
  }, [canvasRef])

  // Pointer interaction (pan + draw)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const isDrawTool = (t: ToolKind) => t === "pen" || t === "eraser"

    const onDown = (e: PointerEvent) => {
      // Cache the bounding rect so we don't call getBoundingClientRect
      // on every pointermove during the stroke.
      cachedRectRef.current = canvas.getBoundingClientRect()

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
        return
      }

      if (e.button !== 0) return

      const tool = activeToolRef.current

      if (tool === "fill") {
        const target = screenToPaintTarget(e.clientX, e.clientY)
        if (!target) return
        const dc = Math.floor((target.colStart + target.colEnd - 1) / 2)
        const dr = Math.floor((target.rowStart + target.rowEnd - 1) / 2)
        fillArea(dc, dr, activeColorIdxRef.current)
        rebuildRef.current()
        return
      }

      if (tool === "eyedropper") {
        const target = screenToPaintTarget(e.clientX, e.clientY)
        if (!target) return
        const map = dataMapRef.current
        const counts = new Map<number, number>()
        for (let r = target.rowStart; r < target.rowEnd; r++) {
          for (let c = target.colStart; c < target.colEnd; c++) {
            const v = map.get(cellKey(c, r)) ?? EMPTY_CELL
            if (v === EMPTY_CELL) continue
            counts.set(v, (counts.get(v) ?? 0) + 1)
          }
        }
        const picked = dominantColor(counts)
        onColorPickRef.current?.(picked)
        return
      }

      if (isDrawTool(tool)) {
        e.preventDefault()
        const target = screenToPaintTarget(e.clientX, e.clientY)
        if (!target) return

        const colorIdx =
          tool === "eraser" ? EMPTY_CELL : activeColorIdxRef.current
        paintDataCells(
          target.colStart,
          target.rowStart,
          target.colEnd,
          target.rowEnd,
          colorIdx
        )

        // Store world-space coords so LOD changes mid-stroke don't corrupt
        // the draw position.
        const w = screenToWorld(e.clientX, e.clientY, cachedRectRef.current)
        if (w) {
          drawRef.current = { drawing: true, lastWX: w.wx, lastWY: w.wy }
        }
        rebuildRef.current()
        canvas.setPointerCapture(e.pointerId)
      }
    }

    const onMove = (e: PointerEvent) => {
      const p = panRef.current
      if (p.panning) {
        const world = worldRef.current
        if (!world) return
        world.x = p.swx + e.clientX - p.sx
        world.y = p.swy + e.clientY - p.sy
        // Grid-only redraw — beads move with the world container
        redrawGridRef.current()
        return
      }

      const d = drawRef.current
      if (!d.drawing) return

      const lod = computeLOD(zoomRef.current)
      const vs = lod.visualCellSize
      const ls = lod.lodScale

      const w = screenToWorld(e.clientX, e.clientY, cachedRectRef.current)
      if (!w) return

      // Convert both the new AND the stored world coords to visual-cell
      // space using the CURRENT LOD, so Bresenham always operates in a
      // consistent coordinate system.
      const vc = dataToVisualCell(w.wx, vs)
      const vr = dataToVisualCell(w.wy, vs)
      const lastVC = dataToVisualCell(d.lastWX, vs)
      const lastVR = dataToVisualCell(d.lastWY, vs)

      const tool = activeToolRef.current
      const colorIdx =
        tool === "eraser" ? EMPTY_CELL : activeColorIdxRef.current

      forLineBetween(lastVC, lastVR, vc, vr, (bc, br) => {
        const dc0 = visualToDataOrigin(bc, ls)
        const dr0 = visualToDataOrigin(br, ls)
        paintDataCells(dc0, dr0, dc0 + ls, dr0 + ls, colorIdx)
      })

      d.lastWX = w.wx
      d.lastWY = w.wy
      rebuildRef.current()
    }

    const onUp = (e: PointerEvent) => {
      if (e.button === 1) panRef.current.panning = false
      if (e.button === 0) drawRef.current = { drawing: false, lastWX: 0, lastWY: 0 }
      cachedRectRef.current = null
    }

    canvas.addEventListener("pointerdown", onDown)
    canvas.addEventListener("pointermove", onMove)
    canvas.addEventListener("pointerup", onUp)
    canvas.addEventListener("pointercancel", onUp)
    canvas.addEventListener("pointerleave", onUp)
    return () => {
      canvas.removeEventListener("pointerdown", onDown)
      canvas.removeEventListener("pointermove", onMove)
      canvas.removeEventListener("pointerup", onUp)
      canvas.removeEventListener("pointercancel", onUp)
      canvas.removeEventListener("pointerleave", onUp)
    }
  }, [
    canvasRef,
    screenToWorld,
    screenToPaintTarget,
    paintDataCells,
    fillArea,
    forLineBetween,
  ])

  // Fit to canvas

  /** Reset zoom to default and centre the world origin in the viewport. */
  const fitToCanvas = useCallback(() => {
    const app = appRef.current
    const world = worldRef.current
    if (!app || !world) return
    world.x = app.screen.width / 2
    world.y = app.screen.height / 2
    setZoom(initialZoom)
  }, [setZoom, initialZoom])

  // Public API

  return {
    /** Current zoom factor (screen pixels per world unit). */
    zoom,
    /** Set or adjust the zoom level. Accepts absolute value or updater function. */
    setZoom,
    /** Reset zoom to default and centre the view. */
    fitToCanvas,
    /** Remove all painted cells. */
    clearGrid,
    /** Total number of non-empty data cells. */
    getCellCount: () => dataMapRef.current.size,
    /** Force a full rebuild and redraw (useful after external data changes). */
    rebuild: () => rebuildRef.current(),
  }
}
