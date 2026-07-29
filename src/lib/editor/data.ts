/** Sentinel for an unpainted cell. */
export const EMPTY = 0

/**
 * Encode a data-cell coordinate pair as a string key.
 */
export function cellKey(col: number, row: number): string {
  return `${col},${row}`
}

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
      const k = cellKey(c, r)
      colorIdx === EMPTY ? map.delete(k) : map.set(k, colorIdx)
    }
  }
}
