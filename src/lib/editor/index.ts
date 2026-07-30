import { Graphics } from "pixi.js"
import type { BeadPalette } from "@/types/palette"

/** Sentinel for an unpainted cell. */
export const EMPTY = 0

/** Grid dimensions are limited to prevent abuse. */
export const MAX_GRID_DIMENSION = 256

/** World units per data cell. */
export const CELL = 10

/** Minimum screen pixels per visual cell — drives the LOD threshold. */
export const MIN_PX = 10

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
 * Computes the bounding box of all painted cells and produces a `number[][]`
 * where 0 = empty.
 *
 * @param cells - The sparse cell map.
 * @returns A rectangular `number[][]`, or `null` if the canvas is empty or
 *          the bounding box exceeds {@link MAX_GRID_DIMENSION} in either axis.
 */
export function serializeGrid(cells: Map<string, number>): number[][] | null {
  if (cells.size === 0) return null

  let minC = Infinity, maxC = -Infinity
  let minR = Infinity, maxR = -Infinity

  for (const key of cells.keys()) {
    const [c, r] = key.split(",").map(Number)
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
    const [c, r] = key.split(",").map(Number)
    grid[r - minR][c - minC] = color
  }

  return grid
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
export function dominant(counts: Map<number, number>): number {
  let best = 0
  let bestN = 0
  for (const [c, n] of counts) {
    if (c === EMPTY) continue
    if (n > bestN) { bestN = n; best = c }
  }
  return best
}

/**
 * Draw grid lines onto a PixiJS Graphics object.
 *
 * @param gfx      - Target Graphics object (cleared before drawing).
 * @param view     - Visible viewport rectangle in world space.
 * @param cellSize - World-unit size of each visual cell.
 * @param zoom     - Current zoom level (affects line width).
 * @param color    - Fill colour of the grid lines.
 * @param alpha    - Alpha value of the grid lines.
 */
export function drawGrid(
  gfx: Graphics,
  view: ViewRect,
  cellSize: number,
  zoom: number,
  color: number,
  alpha: number
): void {
  const lw = 1 / zoom
  const m = cellSize * 2
  const x0 = Math.floor((view.left - m) / cellSize) * cellSize
  const y0 = Math.floor((view.top - m) / cellSize) * cellSize
  const x1 = view.right + m
  const y1 = view.bottom + m

  gfx.clear()
  for (let x = x0; x <= x1; x += cellSize) {
    gfx.rect(x, view.top - m, lw, view.bottom - view.top + m * 2)
  }
  for (let y = y0; y <= y1; y += cellSize) {
    gfx.rect(view.left - m, y, view.right - view.left + m * 2, lw)
  }
  gfx.fill({ color, alpha })
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
  palette: BeadPalette
): BeadEntry[] {
  const margin = cellSize * 2
  const dc0 = Math.floor((view.left - margin) / CELL)
  const dc1 = Math.ceil((view.right + margin) / CELL)
  const dr0 = Math.floor((view.top - margin) / CELL)
  const dr1 = Math.ceil((view.bottom + margin) / CELL)

  const buckets = new Map<string, { vc: number; vr: number; counts: Map<number, number> }>()

  for (const [key, color] of map) {
    const [dc, dr] = key.split(",").map(Number) as [number, number]
    if (!Number.isFinite(dc) || !Number.isFinite(dr)) continue
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

