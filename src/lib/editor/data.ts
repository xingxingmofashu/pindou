/** Sentinel for an unpainted cell. */
export const EMPTY = 0

/** Grid dimensions are limited to prevent abuse. */
export const MAX_GRID_DIMENSION = 256

/**
 * Write a rectangular block of data cells to the sparse grid.
 *
 * Passing {@link EMPTY} as `colorIdx` removes the cells from the map.
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
 * Computes the bounding box of all painted cells and produces a
 * `number[][]` where 0 = empty. Returns `null` if the canvas is empty
 * or the bounding box exceeds {@link MAX_GRID_DIMENSION} in either axis.
 */
export function serializeGrid(
  cells: Map<string, number>
): number[][] | null {
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
