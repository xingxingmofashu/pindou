import { CELL } from "@pindou/shared/constants"
import { MostFrequent } from "../most-frequent"
import { EMPTY } from "./grid"
import type { Grid } from "./grid"
import type { BeadEntry, ViewRect } from "./types"

/**
 * Builds the draw list for the bead layer: one entry per painted cell (or per
 * LOD bucket), culled to the viewport.
 *
 * Descriptors only — the caller owns the PixiJS graphics object, keeping this
 * module free of rendering dependencies.
 */
export class BeadRenderer {
  /**
   * Build bead descriptors for the part of the grid inside the viewport.
   *
   * Cells are bucketed by visual cell at `lodScale`; when several colours land
   * in one bucket, the most frequent one wins. Colours come from
   * `grid.palette` — the renderer never holds a second palette.
   *
   * @param grid     - The sparse grid to draw.
   * @param view     - Visible viewport rectangle in world space.
   * @param lodScale - LOD factor (1 = 1:1, higher values merge cells).
   * @param cellSize - World-unit size of each visual cell.
   * @returns The visual beads to draw, in first-seen bucket order.
   */
  static entries(grid: Grid, view: ViewRect, lodScale: number, cellSize: number): BeadEntry[] {
    const margin = cellSize * 2
    const dc0 = Math.floor((view.left - margin) / CELL)
    const dc1 = Math.ceil((view.right + margin) / CELL)
    const dr0 = Math.floor((view.top - margin) / CELL)
    const dr1 = Math.ceil((view.bottom + margin) / CELL)

    const buckets = new Map<string, { vc: number; vr: number; counts: Map<number, number> }>()

    grid.forEachPainted((color, dc, dr) => {
      if (dc < dc0 || dc >= dc1 || dr < dr0 || dr >= dr1) return

      const vc = Math.floor(dc / lodScale)
      const vr = Math.floor(dr / lodScale)
      const wx = vc * cellSize
      const wy = vr * cellSize
      if (wx + cellSize < view.left - margin || wx > view.right + margin) return
      if (wy + cellSize < view.top - margin || wy > view.bottom + margin) return

      const k = `${vc},${vr}`
      let slot = buckets.get(k)
      if (!slot) {
        slot = { vc, vr, counts: new Map() }
        buckets.set(k, slot)
      }
      slot.counts.set(color, (slot.counts.get(color) ?? 0) + 1)
    })

    const entries: BeadEntry[] = []
    for (const slot of buckets.values()) {
      const best = MostFrequent.of(slot.counts, (color) => color === EMPTY)
      if (best === undefined) continue
      const color = grid.palette.colors[best - 1]
      if (!color) continue

      entries.push({
        worldX: slot.vc * cellSize,
        worldY: slot.vr * cellSize,
        size: cellSize,
        hex: color.hex,
        code: color.code,
      })
    }

    return entries
  }
}
