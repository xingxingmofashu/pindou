import type { Application, Container, Graphics } from "pixi.js"
import { CELL, MAX_GRID_DIMENSION, MIN_PX } from "./constants"
import type { Palette } from "./types"

/** Sentinel for an unpainted cell. */
export const EMPTY = 0

/** Identifies one of the drawing tools. */
export type ToolKind = "pen" | "eraser" | "fill" | "eyedropper"

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

/** One axis-aligned rectangle describing a grid line, in world units. */
export interface GridRect {
  x: number
  y: number
  width: number
  height: number
}

/** Per-colour bead counts plus the painted bounding-box size and total. */
export interface BeadStats {
  width: number
  height: number
  total: number
  rows: { code: string; count: number }[]
}

/** The canvas snapshot contract shared by the editor, export, and publish. */
export interface CellsData {
  grid: string[][]
  brandCode: string
  beadStats: string
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
 * Per-colour bead counts for a sparse grid (no dense grid allocation — unlike
 * {@link serializeGrid} + {@link serializeBeadStats}). Also returns the painted
 * bounding-box size and total bead count for the stats header.
 *
 * @param cells   - The sparse cell map.
 * @param palette - Palette used to resolve colour index → code.
 * @returns The dims/total and per-code counts, or null when the grid is empty.
 */
export function countBeadStats(
  cells: Map<string, number>,
  palette: Palette,
): BeadStats | null {
  if (cells.size === 0) return null
  const bounds = getGridBounds(cells)!
  const counts = new Map<string, number>()
  for (const [, color] of cells) {
    const code = palette.colors[color - 1]?.code
    if (code) counts.set(code, (counts.get(code) ?? 0) + 1)
  }
  return {
    width: bounds.maxC - bounds.minC + 1,
    height: bounds.maxR - bounds.minR + 1,
    total: cells.size,
    rows: Array.from(counts.entries(), ([code, count]) => ({ code, count })),
  }
}

/**
 * The world-unit extent of a painted region's bounding box.
 *
 * @param bounds - The bounding box of painted cells.
 * @returns `{ ww, wh }` — the width/height in world units.
 */
export function boundsWorldSize(bounds: GridBounds): { ww: number; wh: number } {
  return {
    ww: (bounds.maxC - bounds.minC + 1) * CELL,
    wh: (bounds.maxR - bounds.minR + 1) * CELL,
  }
}

/**
 * Position the world container so painted cells are centred in the viewport.
 *
 * @param world   - The PixiJS world Container (mutated in place).
 * @param bounds  - The bounding box of painted cells.
 * @param screenW - Viewport width in screen pixels.
 * @param screenH - Viewport height in screen pixels.
 * @param zoom    - Current zoom level.
 */
export function centerViewport(
  world: { x: number; y: number },
  bounds: GridBounds,
  screenW: number,
  screenH: number,
  zoom: number,
): void {
  const { ww, wh } = boundsWorldSize(bounds)
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
 * @param map      - The sparse cell map to write into.
 * @param c0       - Left column (inclusive).
 * @param r0       - Top row (inclusive).
 * @param c1       - Right column (exclusive).
 * @param r1       - Bottom row (exclusive).
 * @param colorIdx - 1‑based palette index, or {@link EMPTY} to erase.
 */
export function paintBlock(
  map: Map<string, number>,
  c0: number,
  r0: number,
  c1: number,
  r1: number,
  colorIdx: number,
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
 * Flood-fill a connected region of the sparse grid.
 *
 * Starting from the cell at `(c, r)`, every 4‑connected neighbour whose
 * current colour equals the start cell's colour is recoloured to `colorIdx`.
 * Empty start regions (colour {@link EMPTY}) are bounded by the painted
 * bounding box padded by one cell, so filling background can't escape to
 * infinity on the unbounded sparse grid; non‑empty regions are already closed
 * off by neighbouring colours. Passing {@link EMPTY} as `colorIdx` removes the
 * filled cells (erase a connected region).
 *
 * @param map      - The sparse cell map to write into.
 * @param c        - Start column.
 * @param r        - Start row.
 * @param colorIdx - 1‑based palette index, or {@link EMPTY} to erase.
 */
export function floodFill(
  map: Map<string, number>,
  c: number,
  r: number,
  colorIdx: number,
): void {
  const startKey = `${c},${r}`
  const startColor = map.get(startKey) ?? EMPTY
  if (startColor === colorIdx) return

  let minC = -Infinity
  let minR = -Infinity
  let maxC = Infinity
  let maxR = Infinity
  if (startColor === EMPTY) {
    const b = getGridBounds(map)
    if (b) {
      minC = b.minC - 1
      minR = b.minR - 1
      maxC = b.maxC + 1
      maxR = b.maxR + 1
    }
  }

  const queue: [number, number][] = [[c, r]]
  const seen = new Set<string>([startKey])
  while (queue.length > 0) {
    const [qc, qr] = queue.pop()!
    if (colorIdx === EMPTY) map.delete(`${qc},${qr}`)
    else map.set(`${qc},${qr}`, colorIdx)

    const neighbours: [number, number][] = [[qc + 1, qr], [qc - 1, qr], [qc, qr + 1], [qc, qr - 1]]
    for (const [nc, nr] of neighbours) {
      if (nc < minC || nc > maxC || nr < minR || nr > maxR) continue
      const k = `${nc},${nr}`
      if (seen.has(k)) continue
      if ((map.get(k) ?? EMPTY) !== startColor) continue
      seen.add(k)
      queue.push([nc, nr])
    }
  }
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
  fn: (x: number, y: number) => void,
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
 * Convert the sparse cell map into a compact 2D code grid suitable for
 * storage: `""` = empty, any other value is a brand colour code (e.g. "A1").
 * Colour codes are the stable identity of a palette colour, so a reordered
 * palette never reinterprets stored grids — unlike 1‑based index positions.
 *
 * Iterates the painted cells once to fill the grid, reusing
 * {@link getGridBounds} for the bounding box.
 *
 * @param cells   - The sparse cell map.
 * @param palette - Palette used to resolve index → colour code.
 * @returns A rectangular `string[][]`, or `null` if the canvas is empty or
 *          the bounding box exceeds {@link MAX_GRID_DIMENSION} in either axis.
 */
export function serializeGrid(
  cells: Map<string, number>,
  palette: Palette,
): string[][] | null {
  const bounds = getGridBounds(cells)
  if (!bounds) return null

  const w = bounds.maxC - bounds.minC + 1
  const h = bounds.maxR - bounds.minR + 1
  if (w > MAX_GRID_DIMENSION || h > MAX_GRID_DIMENSION) return null

  const grid: string[][] = Array.from({ length: h }, () => Array(w).fill(""))
  for (const [key, color] of cells) {
    const [c, r] = parseCellKey(key)
    const code = palette.colors[color - 1]?.code
    if (code) grid[r - bounds.minR][c - bounds.minC] = code
  }

  return grid
}

/**
 * The inverse of {@link serializeGrid} — rebuild a sparse cell map from a
 * compact 2D code grid. Colour codes are resolved to the palette's 1‑based
 * index (codes absent from the palette are skipped). Co-located with
 * {@link serializeGrid} so the sparse-grid key format (`"c,r"`) is owned in
 * one place.
 *
 * @param grid    - The rectangular `string[][]` ("" = empty) to load.
 * @param palette - Palette used to resolve colour code → index.
 * @returns A new sparse cell map.
 */
export function deserializeGrid(
  grid: string[][],
  palette: Palette,
): Map<string, number> {
  const map = new Map<string, number>()
  const indexByCode = new Map<string, number>()
  palette.colors.forEach((color, i) => indexByCode.set(color.code, i + 1))
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r]
    for (let c = 0; c < row.length; c++) {
      const code = row[c]
      if (code === "") continue
      const idx = indexByCode.get(code)
      if (idx === undefined) continue
      map.set(`${c},${r}`, idx)
    }
  }
  return map
}

/**
 * Resolve a serialized code grid's dimensions, or null when it is empty.
 *
 * @param grid - The rectangular `string[][]` ("" = empty).
 * @returns `{ rows, cols }`, or null when either axis has no cells.
 */
export function gridSize(grid: string[][]): { rows: number; cols: number } | null {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  return rows === 0 || cols === 0 ? null : { rows, cols }
}

/**
 * Count painted cells per colour code in a serialized code grid.
 *
 * @param grid - The rectangular `string[][]` to count ("" = empty).
 * @returns A map of colour code → bead count.
 */
export function countGridBeads(grid: string[][]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const row of grid) {
    for (const code of row) {
      if (code === "") continue
      counts.set(code, (counts.get(code) ?? 0) + 1)
    }
  }
  return counts
}

/**
 * Count beads per colour code for a serialized code grid, serialized as a JSON
 * string mapping colour code → bead count (e.g. `{"A1":12}`) — the
 * stored/published form of a pattern's usage stats.
 *
 * @param grid - The rectangular `string[][]` to count ("" = empty).
 * @returns The JSON string.
 */
export function serializeBeadStats(grid: string[][]): string {
  return JSON.stringify(Object.fromEntries(countGridBeads(grid)))
}

/**
 * Build a colour-code → hex lookup for a palette.
 *
 * @param palette - The palette to index.
 * @returns A map of colour code (e.g. "A1") → hex string.
 */
export function buildHexByCode(palette: Palette): Map<string, string> {
  const hexByCode = new Map<string, string>()
  for (const color of palette.colors) hexByCode.set(color.code, color.hex)
  return hexByCode
}

/**
 * Group items by the series letter each item maps to, preserving first-seen
 * order. Callers pass a `seriesOf` mapper (e.g. `(c) => c.series ?? "?"`).
 *
 * @param items    - The items to group.
 * @param seriesOf - Maps an item to its series key.
 * @returns The groups in first-seen order.
 */
export function groupColorsBySeries<T>(
  items: T[],
  seriesOf: (item: T) => string,
): { series: string; colors: T[] }[] {
  const groups: { series: string; colors: T[] }[] = []
  const bySeries = new Map<string, { series: string; colors: T[] }>()
  for (const item of items) {
    const series = seriesOf(item)
    let group = bySeries.get(series)
    if (!group) {
      group = { series, colors: [] }
      bySeries.set(series, group)
      groups.push(group)
    }
    group.colors.push(item)
  }
  return groups
}

/**
 * Visit every painted cell of a code grid, skipping empty cells.
 *
 * @param grid - The rectangular `string[][]` ("" = empty).
 * @param fn   - Called with the colour code and the cell's row/column.
 */
export function forEachPaintedCell(
  grid: string[][],
  fn: (code: string, row: number, col: number) => void,
): void {
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r]
    for (let c = 0; c < row.length; c++) {
      const code = row[c]
      if (code === "") continue
      fn(code, r, c)
    }
  }
}

/**
 * Visit every painted cell inside a half-open window of a code grid, skipping
 * empty cells. Only rows within the window's row range are scanned, and each
 * scanned row only walks its column slice — so split-export windows cost
 * O(window) instead of O(whole grid) per sheet.
 *
 * @param grid - The rectangular `string[][]` ("" = empty).
 * @param win  - Half-open window bounds (`colStart ≤ c < colEnd`, same for rows).
 * @param fn   - Called with the colour code and the cell's row/column.
 */
export function forEachPaintedCellInWindow(
  grid: string[][],
  win: { colStart: number; colEnd: number; rowStart: number; rowEnd: number },
  fn: (code: string, row: number, col: number) => void,
): void {
  const rowStart = Math.max(0, win.rowStart)
  const rowEnd = Math.min(grid.length, win.rowEnd)
  for (let r = rowStart; r < rowEnd; r++) {
    const row = grid[r]
    const colStart = Math.max(0, win.colStart)
    const colEnd = Math.min(row.length, win.colEnd)
    for (let c = colStart; c < colEnd; c++) {
      const code = row[c]
      if (code === "") continue
      fn(code, r, c)
    }
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
  zoom: number,
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
 * Return the key with the highest count in a frequency map.
 *
 * @param counts - Map from key to occurrence count.
 * @param skip   - Optional predicate for keys to ignore (e.g. {@link EMPTY}).
 * @returns The most frequent key, or `undefined` when the map is empty (or
 *          every entry is skipped).
 */
export function mostFrequent<K>(
  counts: Map<K, number>,
  skip?: (key: K) => boolean,
): K | undefined {
  let best: K | undefined
  let bestN = 0
  for (const [key, n] of counts) {
    if (skip?.(key)) continue
    if (n > bestN) {
      bestN = n
      best = key
    }
  }
  return best
}

/**
 * Build a list of {@link BeadEntry} descriptors from the sparse cell map.
 *
 * Iterates all painted cells, buckets them by visual cell at the current LOD
 * scale, picks the dominant colour per bucket, and returns only the non-empty
 * entries that fall within the visible viewport.
 *
 * @param map      - The sparse cell map.
 * @param view     - Visible viewport rectangle in world space.
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
  palette: Palette,
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
    const best = mostFrequent(slot.counts, (c) => c === EMPTY)
    if (best === undefined) continue
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
