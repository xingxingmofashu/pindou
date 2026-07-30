import { Graphics } from "pixi.js"
import type { BeadPalette } from "@/types/palette"
import { EMPTY } from "./data"

/** World units per data cell. */
export const CELL = 10
/** Minimum screen pixels per visual cell — drives the LOD threshold. */
export const MIN_PX = 10

/**
 * Compute LOD parameters for a given zoom level.
 *
 * The visual cell size is chosen so that each visual cell is at least
 * {@link MIN_PX} screen pixels wide.
 */
export function lodParams(zoom: number): { scale: number; size: number } {
  const px = zoom * CELL
  const scale = Math.max(1, Math.ceil(MIN_PX / px))
  return { scale, size: scale * CELL }
}

/**
 * Return the colour with the highest frequency in a colour→count map,
 * skipping {@link EMPTY}.
 */
export function dominant(counts: Map<number, number>): number {
  let best = 0
  let bestN = 0
  for (const [c, n] of counts) {
    if (n > bestN) { bestN = n; best = c }
  }
  return best
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

/**
 * Draw grid lines onto a PixiJS Graphics object.
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
