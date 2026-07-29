/** 编辑器画图工具：均返回受影响的 cell index 集合。 */

/**
 * Bresenham 直线插值：在两点之间沿途所有格子。
 * 返回值包含边界 → 调用方可按需去重（笔刷拖拽连续调用时）。
 */
export function bresenhamLine(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
  height: number
): Set<number> {
  const result = new Set<number>()
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  let x = x0
  let y = y0
  while (true) {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      result.add(y * width + x)
    }
    if (x === x1 && y === y1) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x += sx }
    if (e2 <= dx) { err += dx; y += sy }
  }
  return result
}

/** 笔刷涂抹两点间的格子（含去重，连续调用只需把新点追加到 set）。 */
export function brushStroke(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  width: number,
  height: number,
  into?: Set<number>
): Set<number> {
  return bresenhamLine(fromX, fromY, toX, toY, width, height)
}

/** 迭代 BFS 泛洪填充（不递归，防 65k 爆栈）。 */
export function floodFill(
  cells: Array<string | null>,
  width: number,
  height: number,
  startX: number,
  startY: number
): Set<number> {
  const target = cells[startY * width + startX]
  const result = new Set<number>()
  // 如果填充色与目标色相同则无操作
  // （调用方在外部判断 activeColorId !== target 才执行填充）

  const queue: [number, number][] = [[startX, startY]]
  const visited = new Uint8Array(width * height) // 0=未访问
  visited[startY * width + startX] = 1
  result.add(startY * width + startX)

  while (queue.length > 0) {
    const [x, y] = queue.pop()!
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
      const idx = ny * width + nx
      if (visited[idx]) continue
      if (cells[idx] !== target) continue
      visited[idx] = 1
      result.add(idx)
      queue.push([nx, ny])
    }
  }
  return result
}

/** 矩形区域（含边界）。 */
export function rect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width: number,
  height: number
): Set<number> {
  const result = new Set<number>()
  const minX = Math.max(0, Math.min(x0, x1))
  const maxX = Math.min(width - 1, Math.max(x0, x1))
  const minY = Math.max(0, Math.min(y0, y1))
  const maxY = Math.min(height - 1, Math.max(y0, y1))
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      result.add(y * width + x)
    }
  }
  return result
}

/** 吸管：取格子色号 id。 */
export function eyedropper(
  cells: Array<string | null>,
  width: number,
  x: number,
  y: number
): string | null {
  if (x < 0 || x >= width || y < 0 || y >= cells.length / width) return null
  return cells[y * width + x]
}
