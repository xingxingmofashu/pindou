import { MAX_GRID_DIMENSION } from "@pindou/shared/constants"
import type { Palette } from "@pindou/shared/types"
import { MostFrequent } from "../most-frequent"
import { CodeGrid } from "./code-grid"
import { Path } from "./path"
import type { BeadStats, GridBounds } from "./types"

/** Sentinel for an unpainted cell. */
export const EMPTY = 0

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
 * The editor's sparse, mutable grid: a `Map<"col,row", 1-based palette index>`
 * with unbounded coordinates (only painted cells consume memory).
 *
 * The instance is bound to a palette because {@link stats} and
 * {@link toCodeGrid} need the index → code mapping. Brand switches rebuild the
 * grid instead of remapping it, so a stale binding can never be observed.
 *
 * `Grid` and `CodeGrid` reference each other only from method bodies (the
 * conversion in each direction), so the module cycle is resolved before any
 * code runs.
 */
export class Grid {
  private readonly cells: Map<string, number>

  /**
   * @param palette - Palette resolving the 1‑based index stored in `cells` to
   *   a colour code and hex.
   * @param cells   - The sparse cell map, taken **by reference** (no copy) so
   *   the editor's hot path stays allocation-free. Callers must not mutate it
   *   afterwards except through this instance — see REFACTOR.md §4.6.
   */
  constructor(
    readonly palette: Palette,
    cells: Map<string, number> = new Map(),
  ) {
    this.cells = cells
  }

  /** Number of painted cells. */
  get size(): number {
    return this.cells.size
  }

  /**
   * Compute the bounding box of a bare sparse map.
   *
   * @param cells - The sparse cell map.
   * @returns The bounding box, or `null` if the map is empty.
   */
  static boundsOf(cells: Map<string, number>): GridBounds | null {
    if (cells.size === 0) return null
    let minC = Infinity
    let maxC = -Infinity
    let minR = Infinity
    let maxR = -Infinity
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
   * Write a rectangular block of data cells into a bare sparse map.
   *
   * Passing {@link EMPTY} as `colorIdx` removes the cells from the map. This
   * static form exists for callers that hold a map without a palette binding;
   * {@link paintBlock} is the instance-level equivalent.
   *
   * @param cells    - The sparse cell map to write into.
   * @param c0       - Left column (inclusive).
   * @param r0       - Top row (inclusive).
   * @param c1       - Right column (exclusive).
   * @param r1       - Bottom row (exclusive).
   * @param colorIdx - 1‑based palette index, or {@link EMPTY} to erase.
   */
  static paintBlockIn(
    cells: Map<string, number>,
    c0: number,
    r0: number,
    c1: number,
    r1: number,
    colorIdx: number,
  ): void {
    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) {
        const k = `${c},${r}`
        if (colorIdx === EMPTY) cells.delete(k)
        else cells.set(k, colorIdx)
      }
    }
  }

  /**
   * Flood-fill a connected region of a bare sparse map.
   *
   * Starting from `(c, r)`, every 4‑connected neighbour whose current colour
   * equals the start cell's colour is recoloured to `colorIdx`. Empty start
   * regions are bounded by the painted bounding box padded by one cell, so
   * filling background can't escape to infinity; an entirely empty canvas has
   * no bounds to fill against and is a no-op.
   *
   * @param cells    - The sparse cell map to write into.
   * @param c        - Start column.
   * @param r        - Start row.
   * @param colorIdx - 1‑based palette index, or {@link EMPTY} to erase.
   */
  static floodFillIn(cells: Map<string, number>, c: number, r: number, colorIdx: number): void {
    const startKey = `${c},${r}`
    const startColor = cells.get(startKey) ?? EMPTY
    if (startColor === colorIdx) return

    let minC = -Infinity
    let minR = -Infinity
    let maxC = Infinity
    let maxR = Infinity
    if (startColor === EMPTY) {
      // Without painted bounds there is nothing to bound the BFS, so an empty
      // canvas would expand forever. Filling an empty canvas is a no-op.
      const b = Grid.boundsOf(cells)
      if (!b) return
      minC = b.minC - 1
      minR = b.minR - 1
      maxC = b.maxC + 1
      maxR = b.maxR + 1
    }

    const queue: [number, number][] = [[c, r]]
    const seen = new Set<string>([startKey])
    while (queue.length > 0) {
      const [qc, qr] = queue.pop()!
      if (colorIdx === EMPTY) cells.delete(`${qc},${qr}`)
      else cells.set(`${qc},${qr}`, colorIdx)

      const neighbours: [number, number][] = [
        [qc + 1, qr],
        [qc - 1, qr],
        [qc, qr + 1],
        [qc, qr - 1],
      ]
      for (const [nc, nr] of neighbours) {
        if (nc < minC || nc > maxC || nr < minR || nr > maxR) continue
        const k = `${nc},${nr}`
        if (seen.has(k)) continue
        if ((cells.get(k) ?? EMPTY) !== startColor) continue
        seen.add(k)
        queue.push([nc, nr])
      }
    }
  }

  /**
   * The 1‑based palette index at a cell.
   *
   * @param c - Column.
   * @param r - Row.
   * @returns The index, or {@link EMPTY} when the cell is not painted.
   */
  at(c: number, r: number): number {
    return this.cells.get(`${c},${r}`) ?? EMPTY
  }

  /**
   * Bounding box of all painted cells.
   *
   * @returns The bounding box, or `null` when the grid is empty.
   */
  bounds(): GridBounds | null {
    return Grid.boundsOf(this.cells)
  }

  /**
   * Per-colour bead counts plus the painted bounding-box size and total.
   *
   * Walks the sparse map once — no dense allocation. Cells whose index has no
   * colour in the palette still count towards `total` (they are painted, just
   * not renderable) but are skipped in `rows`.
   *
   * @returns The stats, or `null` when the grid is empty.
   */
  stats(): BeadStats | null {
    const bounds = this.bounds()
    if (!bounds) return null
    const counts = new Map<string, number>()
    for (const [, color] of this.cells) {
      const code = this.palette.colors[color - 1]?.code
      if (code) counts.set(code, (counts.get(code) ?? 0) + 1)
    }
    return {
      width: bounds.maxC - bounds.minC + 1,
      height: bounds.maxR - bounds.minR + 1,
      total: this.cells.size,
      rows: Array.from(counts.entries(), ([code, count]) => ({ code, count })),
    }
  }

  /**
   * Visit every painted cell with its palette index and coordinates.
   *
   * Iteration follows the sparse map's insertion order, which is the order
   * cells were first painted.
   *
   * @param fn - Callback receiving the 1‑based index, column, and row.
   */
  forEachPainted(fn: (colorIdx: number, c: number, r: number) => void): void {
    for (const [key, colorIdx] of this.cells) {
      const [c, r] = parseCellKey(key)
      fn(colorIdx, c, r)
    }
  }

  /**
   * The most frequent 1‑based colour index inside a half-open rectangle.
   *
   * Used by the eyedropper, so a zoomed-out sample matches the block a pen
   * press would paint. `EMPTY` is never stored in the map, so no skip is
   * needed.
   *
   * @param c0 - Left column (inclusive).
   * @param r0 - Top row (inclusive).
   * @param c1 - Right column (exclusive).
   * @param r1 - Bottom row (exclusive).
   * @returns The dominant index, or `undefined` when every cell is empty.
   */
  dominant(c0: number, r0: number, c1: number, r1: number): number | undefined {
    const counts = new Map<number, number>()
    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) {
        const value = this.cells.get(`${c},${r}`)
        if (value === undefined) continue
        counts.set(value, (counts.get(value) ?? 0) + 1)
      }
    }
    return MostFrequent.of(counts)
  }

  /**
   * Write a rectangular block of data cells.
   *
   * Passing {@link EMPTY} as `colorIdx` erases the block.
   *
   * @param c0       - Left column (inclusive).
   * @param r0       - Top row (inclusive).
   * @param c1       - Right column (exclusive).
   * @param r1       - Bottom row (exclusive).
   * @param colorIdx - 1‑based palette index, or {@link EMPTY} to erase.
   */
  paintBlock(c0: number, r0: number, c1: number, r1: number, colorIdx: number): void {
    Grid.paintBlockIn(this.cells, c0, r0, c1, r1, colorIdx)
  }

  /**
   * Flood-fill a connected region of the grid.
   *
   * @param c        - Start column.
   * @param r        - Start row.
   * @param colorIdx - 1‑based palette index, or {@link EMPTY} to erase.
   */
  floodFill(c: number, r: number, colorIdx: number): void {
    Grid.floodFillIn(this.cells, c, r, colorIdx)
  }

  /**
   * Paint a straight line between two cells (Bresenham), with a block size of
   * `scale` data cells per visited point — the editor's LOD brush.
   *
   * @param c0       - Start column (in visual-cell units).
   * @param r0       - Start row (in visual-cell units).
   * @param c1       - End column (in visual-cell units).
   * @param r1       - End row (in visual-cell units).
   * @param colorIdx - 1‑based palette index, or {@link EMPTY} to erase.
   * @param scale    - Block size in data cells (defaults to 1).
   */
  paintLine(
    c0: number,
    r0: number,
    c1: number,
    r1: number,
    colorIdx: number,
    scale = 1,
  ): void {
    Path.walk(c0, r0, c1, r1, (c, r) => {
      this.paintBlock(c * scale, r * scale, (c + 1) * scale, (r + 1) * scale, colorIdx)
    })
  }

  /** Remove every painted cell, keeping the same map instance. */
  clear(): void {
    this.cells.clear()
  }

  /**
   * Deep-copy the cells. The palette is shared (not cloned).
   *
   * @returns A new grid with its own map.
   */
  clone(): Grid {
    return new Grid(this.palette, new Map(this.cells))
  }

  /**
   * Whether two grids hold identical cells. Only coordinates and 1‑based
   * indices are compared — the palettes are not.
   *
   * @param other - The grid to compare against.
   * @returns `true` when both maps hold the same keys and values.
   */
  equals(other: Grid): boolean {
    if (this.cells.size !== other.cells.size) return false
    for (const [key, value] of this.cells) {
      if (other.cells.get(key) !== value) return false
    }
    return true
  }

  /**
   * Convert to a dense code grid, cropped to the painted bounding box.
   *
   * Colour codes are the stable identity of a palette colour, so a reordered
   * palette never reinterprets stored grids.
   *
   * @returns The code grid, or `null` when the canvas is empty or the bounding
   *          box exceeds `MAX_GRID_DIMENSION` in either axis.
   */
  toCodeGrid(): CodeGrid | null {
    const bounds = this.bounds()
    if (!bounds) return null

    const w = bounds.maxC - bounds.minC + 1
    const h = bounds.maxR - bounds.minR + 1
    if (w > MAX_GRID_DIMENSION || h > MAX_GRID_DIMENSION) return null

    const codes: string[][] = Array.from({ length: h }, () => Array<string>(w).fill(""))
    for (const [key, colorIdx] of this.cells) {
      const [c, r] = parseCellKey(key)
      const code = this.palette.colors[colorIdx - 1]?.code
      if (code) codes[r - bounds.minR][c - bounds.minC] = code
    }

    return CodeGrid.from(codes)
  }
}
