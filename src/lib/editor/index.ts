import type { Application, Container, Graphics } from "pixi.js"
import type { Palette } from "@/types"

/** Sentinel for an unpainted cell. */
export const EMPTY = 0

/** Grid dimensions are limited only to prevent memory abuse. */
export const MAX_GRID_DIMENSION = 4096

/** World units per data cell. */
export const CELL = 10

/** Minimum screen pixels per visual cell — drives the LOD threshold. */
export const MIN_PX = 10

/** PixiJS scene-graph objects passed between {@link usePixiApp} and {@link usePixiCanvas}. */
export interface PixiContext {
  app: Application
  world: Container
  beadsGfx: Graphics
  gridGfx: Graphics
  labels: Container
}

/** Axis-aligned viewport rectangle in world space. */
export interface ViewRect {
  left: number
  top: number
  right: number
  bottom: number
}

/**
 * Parse a sparse-grid key (`"c,r"`) into its cell coordinates.
 *
 * Faster than `key.split(",").map(Number)` on the editor's hot path (every
 * rebuild iterates all painted cells): no intermediate arrays are allocated.
 *
 * @param key - The sparse-map key.
 * @returns The `[column, row]` pair.
 */
function parseCellKey(key: string): [number, number] {
  const i = key.indexOf(",")
  return [Number(key.slice(0, i)), Number(key.slice(i + 1))]
}

/** Descriptor for one visual bead rectangle to be drawn. */
export interface BeadEntry {
  worldX: number
  worldY: number
  size: number
  hex: string
  code: string
}

/** Bounding box of painted cells in data-cell coordinates. */
export interface GridBounds {
  minC: number
  maxC: number
  minR: number
  maxR: number
}

/**
 * Compute the bounding box of all painted cells in a sparse grid.
 *
 * @param cells - The sparse cell map.
 * @returns The bounding box, or `null` if the map is empty.
 */
export function getGridBounds(cells: Map<string, number>): GridBounds | null {
  if (cells.size === 0) return null
  let minC = Infinity, maxC = -Infinity, minR = Infinity, maxR = -Infinity
  for (const key of cells.keys()) {
    const [c, r] = parseCellKey(key)
    if (c < minC) minC = c
    if (c > maxC) maxC = c
    if (r < minR) minR = r
    if (r > maxR) maxR = r
  }
  return { minC, maxC, minR, maxR }
}

/**
 * Position the world container so painted cells are centred in the viewport.
 *
 * @param world - The PixiJS world Container (mutated in place).
 * @param bounds - The bounding box of painted cells.
 * @param screenW - Viewport width in screen pixels.
 * @param screenH - Viewport height in screen pixels.
 * @param zoom - Current zoom level.
 */
export function centerViewport(
  world: { x: number; y: number },
  bounds: GridBounds,
  screenW: number,
  screenH: number,
  zoom: number,
): void {
  const ww = (bounds.maxC - bounds.minC + 1) * CELL
  const wh = (bounds.maxR - bounds.minR + 1) * CELL
  const ox = bounds.minC * CELL
  const oy = bounds.minR * CELL
  world.x = (screenW - ww * zoom) / 2 - ox * zoom
  world.y = (screenH - wh * zoom) / 2 - oy * zoom
}

/**
 * Write a rectangular block of data cells to the sparse grid.
 *
 * Passing {@link EMPTY} as `colorIdx` removes the cells from the map.
 *
 * @param map - The sparse cell map to write into.
 * @param c0  - Left column (inclusive).
 * @param r0  - Top row (inclusive).
 * @param c1  - Right column (exclusive).
 * @param r1  - Bottom row (exclusive).
 * @param colorIdx - 1‑based palette index, or {@link EMPTY} to erase.
 */
export function paintBlock(
  map: Map<string, number>,
  c0: number,
  r0: number,
  c1: number,
  r1: number,
  colorIdx: number
): void {
  for (let r = r0; r < r1; r++) {
    for (let c = c0; c < c1; c++) {
      const k = `${c},${r}`
      if (colorIdx === EMPTY) map.delete(k)
      else map.set(k, colorIdx)
    }
  }
}

/**
 * Convert the sparse cell map into a compact 2D array suitable for storage.
 *
 * Iterates the painted cells once, tracking the bounding box inline, and
 * produces a `number[][]` where 0 = empty.
 *
 * @param cells - The sparse cell map.
 * @returns A rectangular `number[][]`, or `null` if the canvas is empty or
 *          the bounding box exceeds {@link MAX_GRID_DIMENSION} in either axis.
 */
export function serializeGrid(cells: Map<string, number>): number[][] | null {
  if (cells.size === 0) return null

  let minC = Infinity, maxC = -Infinity, minR = Infinity, maxR = -Infinity
  for (const key of cells.keys()) {
    const [c, r] = parseCellKey(key)
    if (c < minC) minC = c
    if (c > maxC) maxC = c
    if (r < minR) minR = r
    if (r > maxR) maxR = r
  }

  const w = maxC - minC + 1
  const h = maxR - minR + 1
  if (w > MAX_GRID_DIMENSION || h > MAX_GRID_DIMENSION) return null

  const grid: number[][] = Array.from({ length: h }, () => Array(w).fill(EMPTY))
  for (const [key, color] of cells) {
    const [c, r] = parseCellKey(key)
    grid[r - minR][c - minC] = color
  }

  return grid
}

/**
 * Count beads per colour code for a serialized grid.
 *
 * Grid values are 1‑based indices into `palette.colors` (0 = empty); cells
 * with an out-of-range index are skipped.
 *
 * @param grid    - The rectangular `number[][]` to count.
 * @param palette - Palette used to resolve index → colour code.
 * @returns A JSON string mapping colour code → bead count, e.g. `{"A1":12}`.
 */
export function computeBeadStats(grid: number[][], palette: Palette): string {
  const counts = new Map<string, number>()
  for (const row of grid) {
    for (const val of row) {
      if (val <= 0 || val > palette.colors.length) continue
      const code = palette.colors[val - 1].code
      counts.set(code, (counts.get(code) ?? 0) + 1)
    }
  }
  return JSON.stringify(Object.fromEntries(counts))
}

/**
 * The inverse of {@link serializeGrid} — rebuild a sparse cell map from a
 * compact 2D array. Co-located with {@link serializeGrid} so the sparse-grid
 * key format (`"c,r"`) is owned in one place.
 *
 * @param grid - The rectangular `number[][]` (0 = empty) to load.
 * @returns A new sparse cell map.
 */
export function deserializeGrid(grid: number[][]): Map<string, number> {
  const map = new Map<string, number>()
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r]
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== EMPTY) map.set(`${c},${r}`, row[c])
    }
  }
  return map
}

/**
 * Walk along a line segment between two integer grid points, invoking a
 * callback for every point on the path (Bresenham's algorithm).
 *
 * @param x0 - Start column.
 * @param y0 - Start row.
 * @param x1 - End column.
 * @param y1 - End row.
 * @param fn - Callback invoked for each grid point on the line.
 */
export function walkLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  fn: (x: number, y: number) => void
): void {
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
    if (e2 > -dy) { err -= dy; x += sx }
    if (e2 < dx) { err += dx; y += sy }
    fn(x, y)
  }
}

/**
 * Compute LOD parameters for a given zoom level.
 *
 * The visual cell size is chosen so that each visual cell is at least
 * {@link MIN_PX} screen pixels wide.
 *
 * @param zoom - Current zoom level.
 * @returns `{ scale, size }` where `scale` is the LOD factor and `size` is
 *          the world-unit size of a visual cell.
 */
export function lodParams(zoom: number): { scale: number; size: number } {
  const px = zoom * CELL
  const scale = Math.max(1, Math.ceil(MIN_PX / px))
  return { scale, size: scale * CELL }
}

/**
 * Return the colour with the highest frequency in a colour→count map,
 * skipping {@link EMPTY}.
 *
 * @param counts - Map from colour index to occurrence count.
 * @returns The dominant colour index, or 0 if the map is empty.
 */
function dominant(counts: Map<number, number>): number {
  let best = 0
  let bestN = 0
  for (const [c, n] of counts) {
    if (c === EMPTY) continue
    if (n > bestN) { bestN = n; best = c }
  }
  return best
}

/** One axis-aligned rectangle describing a grid line, in world units. */
export interface GridRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Compute the grid-line rectangles for the visible viewport.
 *
 * Renderer-agnostic: returns a list of world-space rectangles. The caller
 * (the PixiJS hook) is responsible for drawing them, keeping this pure
 * library free of any rendering dependency.
 *
 * Each line is snapped to a whole screen pixel (the line width is exactly one
 * screen pixel, so a fractional screen position would split it across two
 * pixels and antialias it to near-invisibility at the grid's low alpha).
 *
 * @param view     - Visible viewport rectangle in world space.
 * @param cellSize - World-unit size of each visual cell.
 * @param zoom     - Current zoom level (affects line width).
 * @returns The list of grid-line rectangles covering the viewport (plus a
 *          margin), and the computed line width.
 */
export function computeGridLines(
  view: ViewRect,
  cellSize: number,
  zoom: number
): { rects: GridRect[]; lineWidth: number } {
  const lineWidth = 1 / zoom
  const m = cellSize * 2
  const x0 = Math.floor((view.left - m) / cellSize) * cellSize
  const y0 = Math.floor((view.top - m) / cellSize) * cellSize
  const x1 = view.right + m
  const y1 = view.bottom + m
  const hSpan = view.bottom - view.top + m * 2
  const wSpan = view.right - view.left + m * 2

  const rects: GridRect[] = []
  for (let x = x0; x <= x1; x += cellSize) {
    const sx = Math.round((x - view.left) * zoom)
    rects.push({ x: view.left + sx / zoom, y: view.top - m, width: lineWidth, height: hSpan })
  }
  for (let y = y0; y <= y1; y += cellSize) {
    const sy = Math.round((y - view.top) * zoom)
    rects.push({ x: view.left - m, y: view.top + sy / zoom, width: wSpan, height: lineWidth })
  }
  return { rects, lineWidth }
}

/**
 * Build a list of {@link BeadEntry} descriptors from the sparse cell map.
 *
 * Iterates all painted cells, buckets them by visual cell at the current LOD
 * scale, picks the dominant colour per bucket, and returns only the non-empty
 * entries that fall within the visible viewport.
 *
 * @param map     - The sparse cell map.
 * @param view    - Visible viewport rectangle in world space.
 * @param lodScale - LOD factor (1 = 1:1, higher values merge cells).
 * @param cellSize - World-unit size of each visual cell.
 * @param palette  - Palette used to resolve colour index → hex/code.
 * @returns Array of visual bead entries to draw.
 */
export function buildBeadEntries(
  map: Map<string, number>,
  view: ViewRect,
  lodScale: number,
  cellSize: number,
  palette: Palette
): BeadEntry[] {
  const margin = cellSize * 2
  const dc0 = Math.floor((view.left - margin) / CELL)
  const dc1 = Math.ceil((view.right + margin) / CELL)
  const dr0 = Math.floor((view.top - margin) / CELL)
  const dr1 = Math.ceil((view.bottom + margin) / CELL)

  const buckets = new Map<string, { vc: number; vr: number; counts: Map<number, number> }>()

  for (const [key, color] of map) {
    const [dc, dr] = parseCellKey(key)
    if (dc < dc0 || dc >= dc1 || dr < dr0 || dr >= dr1) continue

    const vc = Math.floor(dc / lodScale)
    const vr = Math.floor(dr / lodScale)
    const wx = vc * cellSize
    const wy = vr * cellSize
    if (wx + cellSize < view.left - margin || wx > view.right + margin) continue
    if (wy + cellSize < view.top - margin || wy > view.bottom + margin) continue

    const k = `${vc},${vr}`
    let slot = buckets.get(k)
    if (!slot) { slot = { vc, vr, counts: new Map() }; buckets.set(k, slot) }
    slot.counts.set(color, (slot.counts.get(color) ?? 0) + 1)
  }

  const entries: BeadEntry[] = []
  for (const slot of buckets.values()) {
    const best = dominant(slot.counts)
    if (best === EMPTY) continue
    const c = palette.colors[best - 1]
    if (!c) continue

    entries.push({
      worldX: slot.vc * cellSize,
      worldY: slot.vr * cellSize,
      size: cellSize,
      hex: c.hex,
      code: c.code,
    })
  }

  return entries
}

