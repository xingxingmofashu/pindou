/** Sentinel for an unpainted cell. */
export const EMPTY = 0

/** Safety cap for flood-fill (cells collected before abort). */
export const MAX_FILL = 100_000

/** Max Chebyshev distance from seed when filling empty space. */
export const FILL_RADIUS = 500

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

/**
 * Flood-fill connected cells starting from a seed coordinate.
 *
 * Uses iterative BFS. All modifications are applied atomically — if the fill
 * exceeds {@link MAX_FILL} the operation is aborted without touching any cell.
 *
 * When the seed cell is empty a bounding box of {@link FILL_RADIUS} cells
 * from the seed is enforced to prevent runaway expansion.
 *
 * @returns `true` if the fill was aborted (no cells modified).
 */
export function floodFill(
  map: Map<string, number>,
  startCol: number,
  startRow: number,
  replacement: number
): boolean {
  const startKey = cellKey(startCol, startRow)
  const target = map.get(startKey) ?? EMPTY
  if (target === replacement) return false

  const fillingEmpty = target === EMPTY
  const queue: [number, number][] = [[startCol, startRow]]
  const visited = new Set<string>([startKey])
  const collected: [number, number][] = []
  let head = 0

  while (head < queue.length) {
    const [c, r] = queue[head++]
    collected.push([c, r])

    if (collected.length > MAX_FILL) {
      console.warn("Flood fill aborted: exceeded max cells")
      return true
    }

    for (const [nc, nr] of [[c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]]) {
      if (
        fillingEmpty &&
        (Math.abs(nc - startCol) > FILL_RADIUS || Math.abs(nr - startRow) > FILL_RADIUS)
      ) {
        continue
      }
      const nk = cellKey(nc, nr)
      if (visited.has(nk)) continue
      if ((map.get(nk) ?? EMPTY) !== target) continue
      visited.add(nk)
      queue.push([nc, nr])
    }
  }

  for (const [c, r] of collected) {
    replacement === EMPTY ? map.delete(cellKey(c, r)) : map.set(cellKey(c, r), replacement)
  }

  return false
}
