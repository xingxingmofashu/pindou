import type { Palette } from "@pindou/shared/palettes"
import { PaletteIndex } from "../palette/palette-index"

/**
 * A dense, immutable code grid: `codes[row][col]` is `""` (empty) or a
 * palette colour code (e.g. `"A1"`).
 *
 * This is the storage / wire representation. Codes are stable across palette
 * reordering, unlike the sparse grid's 1‑based indices.
 */
export class CodeGrid {
  /**
   * @param codes - The underlying rows, wrapped by reference (no copy).
   */
  private constructor(readonly codes: string[][]) {}

  /**
   * Wrap a dense code grid.
   *
   * Empty grids (no rows, or a first row with no columns) return `null` — the
   * same contract the legacy `gridSize` had. Ragged rows are **not** padded or
   * rejected: every consumer iterates each row at its own length, which is how
   * the legacy `deserializeGrid` / `forEachPaintedCell` behaved.
   *
   * @param codes - The rectangular `string[][]` (`""` = empty).
   * @returns The wrapper, or `null` when the grid has no cells.
   */
  static from(codes: string[][]): CodeGrid | null {
    const cols = codes[0]?.length ?? 0
    return codes.length === 0 || cols === 0 ? null : new CodeGrid(codes)
  }

  /** Number of rows. */
  get rows(): number {
    return this.codes.length
  }

  /** Number of columns, taken from the first row. */
  get cols(): number {
    return this.codes[0]?.length ?? 0
  }

  /**
   * Grid dimensions, or `null` when either axis has no cells — the legacy
   * `gridSize` contract.
   */
  get size(): { rows: number; cols: number } | null {
    return this.rows === 0 || this.cols === 0 ? null : { rows: this.rows, cols: this.cols }
  }

  /**
   * The colour code at a cell.
   *
   * @param c - Column.
   * @param r - Row.
   * @returns The code, or `""` when the cell is empty or out of bounds.
   */
  at(c: number, r: number): string {
    return this.codes[r]?.[c] ?? ""
  }

  /**
   * Visit every painted cell, row-major, skipping empty cells.
   *
   * @param fn - Callback receiving the colour code, column, and row.
   */
  forEachPainted(fn: (code: string, c: number, r: number) => void): void {
    for (let r = 0; r < this.codes.length; r++) {
      const row = this.codes[r]
      for (let c = 0; c < row.length; c++) {
        const code = row[c]
        if (code === "") continue
        fn(code, c, r)
      }
    }
  }

  /**
   * Visit every painted cell inside a half-open window, skipping empty cells.
   *
   * Only rows within the window's row range are scanned, and each scanned row
   * only walks its column slice — so split-export windows cost O(window)
   * instead of O(whole grid) per sheet. The window is clamped to the grid.
   *
   * @param win - Half-open bounds (`colStart ≤ c < colEnd`, same for rows).
   * @param fn  - Callback receiving the colour code, column, and row.
   */
  forEachPaintedInWindow(
    win: { colStart: number; colEnd: number; rowStart: number; rowEnd: number },
    fn: (code: string, c: number, r: number) => void,
  ): void {
    const rowStart = Math.max(0, win.rowStart)
    const rowEnd = Math.min(this.codes.length, win.rowEnd)
    for (let r = rowStart; r < rowEnd; r++) {
      const row = this.codes[r]
      const colStart = Math.max(0, win.colStart)
      const colEnd = Math.min(row.length, win.colEnd)
      for (let c = colStart; c < colEnd; c++) {
        const code = row[c]
        if (code === "") continue
        fn(code, c, r)
      }
    }
  }

  /**
   * Count painted cells per colour code.
   *
   * @returns A map of colour code → bead count.
   */
  counts(): Map<string, number> {
    const counts = new Map<string, number>()
    this.forEachPainted((code) => {
      counts.set(code, (counts.get(code) ?? 0) + 1)
    })
    return counts
  }

  /**
   * The bead counts serialised as a JSON object (e.g. `{"A1":12}`) — the
   * stored/published form of a pattern's usage stats.
   *
   * @returns The JSON string.
   */
  beadStatsJson(): string {
    return JSON.stringify(Object.fromEntries(this.counts()))
  }

  /**
   * Rebuild a bare sparse cell map from these codes.
   *
   * Codes absent from the palette are skipped, so a pattern published with a
   * colour that has since been removed still loads everything else.
   *
   * @param palette - Palette resolving colour code → 1‑based index.
   * @returns A new sparse map.
   */
  toCells(palette: Palette): Map<string, number> {
    const index = new PaletteIndex(palette)
    const cells = new Map<string, number>()
    this.forEachPainted((code, c, r) => {
      const colorIdx = index.indexOf(code)
      if (colorIdx === undefined) return
      cells.set(`${c},${r}`, colorIdx)
    })
    return cells
  }
}
